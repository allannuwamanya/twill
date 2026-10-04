package mock

import (
	"context"
	"testing"
	"time"

	"twill/internal/domain"
)

func TestMockAdapterStream(t *testing.T) {
	adapter := NewMockAdapter()
	ctx := context.Background()

	err := adapter.Start(ctx, "test_session", "/tmp/test_project", "Create a hello world program")
	if err != nil {
		t.Fatalf("failed to start mock adapter: %v", err)
	}

	var events []domain.Event
	done := make(chan struct{})

	go func() {
		for evt := range adapter.Events() {
			events = append(events, evt)
			if evt.Type == domain.EventStatusChange {
				payload, ok := evt.Payload.(domain.StatusPayload)
				if ok && payload.Status == domain.StatusDone {
					close(done)
					return
				}
			}
		}
	}()

	select {
	case <-done:
		// Success
	case <-time.After(5 * time.Second):
		t.Fatalf("timed out waiting for mock adapter to complete stream")
	}

	if len(events) < 5 {
		t.Errorf("expected at least 5 events, got %d", len(events))
	}

	var hasChunks bool
	var hasTool bool
	for _, e := range events {
		if e.Type == domain.EventMessageChunk {
			hasChunks = true
		}
		if e.Type == domain.EventToolStart {
			hasTool = true
		}
	}

	if !hasChunks {
		t.Errorf("expected message_chunk events, but none received")
	}
	if !hasTool {
		t.Errorf("expected tool_start event, but none received")
	}
}

func TestMockAdapterCancellation(t *testing.T) {
	adapter := NewMockAdapter()
	ctx := context.Background()

	err := adapter.Start(ctx, "test_session_cancel", "/tmp/test_project", "Long task to cancel")
	if err != nil {
		t.Fatalf("failed to start mock adapter: %v", err)
	}

	time.Sleep(100 * time.Millisecond)
	err = adapter.Stop()
	if err != nil {
		t.Fatalf("failed to stop adapter: %v", err)
	}

	time.Sleep(200 * time.Millisecond)
	if adapter.activeTask {
		t.Errorf("expected activeTask to be false after Stop()")
	}
}

func TestMockAdapterPermissionApproval(t *testing.T) {
	adapter := NewMockAdapter()
	ctx := context.Background()

	err := adapter.Start(ctx, "test_session_perm", "/tmp/test_project", "Please run bash command to install package")
	if err != nil {
		t.Fatalf("failed to start mock adapter: %v", err)
	}

	done := make(chan struct{})
	var approvalReqID string

	go func() {
		for evt := range adapter.Events() {
			if evt.Type == domain.EventPermissionRequest {
				payload := evt.Payload.(domain.PermissionRequestPayload)
				approvalReqID = payload.RequestID
				// Approve permission
				_ = adapter.SendApproval(approvalReqID, true, false)
			}
			if evt.Type == domain.EventStatusChange {
				payload, ok := evt.Payload.(domain.StatusPayload)
				if ok && payload.Status == domain.StatusDone {
					close(done)
					return
				}
			}
		}
	}()

	select {
	case <-done:
		if approvalReqID == "" {
			t.Errorf("expected permission request event, but got none")
		}
	case <-time.After(5 * time.Second):
		t.Fatalf("timed out waiting for permission flow")
	}
}

func TestMockAdapterQuestionAnswer(t *testing.T) {
	adapter := NewMockAdapter()
	ctx := context.Background()

	err := adapter.Start(ctx, "test_session_q", "/tmp/test_project", "Help me choose an auth strategy")
	if err != nil {
		t.Fatalf("failed to start mock adapter: %v", err)
	}

	done := make(chan struct{})
	var questionID string

	go func() {
		for evt := range adapter.Events() {
			if evt.Type == domain.EventQuestion {
				payload := evt.Payload.(domain.QuestionPayload)
				questionID = payload.QuestionID
				// Answer question
				_ = adapter.SendAnswer(questionID, "JWT Bearer Tokens (Stateless)")
			}
			if evt.Type == domain.EventStatusChange {
				payload, ok := evt.Payload.(domain.StatusPayload)
				if ok && payload.Status == domain.StatusDone {
					close(done)
					return
				}
			}
		}
	}()

	select {
	case <-done:
		if questionID == "" {
			t.Errorf("expected question event, but got none")
		}
	case <-time.After(5 * time.Second):
		t.Fatalf("timed out waiting for question flow")
	}
}

func TestMockAdapterPlanReview(t *testing.T) {
	adapter := NewMockAdapter()
	ctx := context.Background()

	err := adapter.Start(ctx, "test_session_plan", "/tmp/test_project", "Propose a refactoring plan")
	if err != nil {
		t.Fatalf("failed to start mock adapter: %v", err)
	}

	done := make(chan struct{})
	var planID string

	go func() {
		for evt := range adapter.Events() {
			if evt.Type == domain.EventPlan {
				payload := evt.Payload.(domain.PlanPayload)
				if planID == "" {
					planID = payload.PlanID
					// Approve plan
					_ = adapter.SendPlanDecision(planID, true, "")
				}
			}
			if evt.Type == domain.EventStatusChange {
				payload, ok := evt.Payload.(domain.StatusPayload)
				if ok && payload.Status == domain.StatusDone {
					close(done)
					return
				}
			}
		}
	}()

	select {
	case <-done:
		if planID == "" {
			t.Errorf("expected plan event, but got none")
		}
	case <-time.After(5 * time.Second):
		t.Fatalf("timed out waiting for plan review flow")
	}
}
