package mock

import (
	"context"
	"fmt"
	"sync"
	"time"

	"twill/internal/domain"
)

// MockAdapter provides a deterministic simulation of an agent for offline UI development and testing.
type MockAdapter struct {
	mu           sync.Mutex
	eventsChan   chan domain.Event
	cancelFunc   context.CancelFunc
	activeTask   bool
	approvals    map[string]chan bool
	answers      map[string]chan string
}

// NewMockAdapter initializes a new MockAdapter.
func NewMockAdapter() *MockAdapter {
	return &MockAdapter{
		eventsChan: make(chan domain.Event, 100),
		approvals:  make(map[string]chan bool),
		answers:    make(map[string]chan string),
	}
}

func (m *MockAdapter) ID() string {
	return "mock"
}

func (m *MockAdapter) Name() string {
	return "Mock Simulator (Offline / Dev)"
}

func (m *MockAdapter) Events() <-chan domain.Event {
	return m.eventsChan
}

func (m *MockAdapter) Start(parentCtx context.Context, sessionID string, projectDir string, prompt string) error {
	m.mu.Lock()
	if m.activeTask {
		m.mu.Unlock()
		return fmt.Errorf("a task is already in progress")
	}

	ctx, cancel := context.WithCancel(parentCtx)
	m.cancelFunc = cancel
	m.activeTask = true
	m.mu.Unlock()

	go m.simulateRun(ctx, sessionID, projectDir, prompt)
	return nil
}

func (m *MockAdapter) Stop() error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.cancelFunc != nil {
		m.cancelFunc()
		m.cancelFunc = nil
	}
	m.activeTask = false
	return nil
}

func (m *MockAdapter) SendApproval(requestID string, approved bool, alwaysAllow bool) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if ch, exists := m.approvals[requestID]; exists {
		ch <- approved
		delete(m.approvals, requestID)
		return nil
	}
	return fmt.Errorf("no pending approval with ID %s", requestID)
}

func (m *MockAdapter) SendAnswer(questionID string, answer string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if ch, exists := m.answers[questionID]; exists {
		ch <- answer
		delete(m.answers, questionID)
		return nil
	}
	return fmt.Errorf("no pending question with ID %s", questionID)
}

func (m *MockAdapter) emit(sessionID string, eventType domain.EventType, payload interface{}) {
	m.eventsChan <- domain.Event{
		ID:        fmt.Sprintf("evt_%d", time.Now().UnixNano()),
		SessionID: sessionID,
		Type:      eventType,
		Timestamp: time.Now(),
		Payload:   payload,
	}
}

func (m *MockAdapter) simulateRun(ctx context.Context, sessionID string, projectDir string, prompt string) {
	defer func() {
		m.mu.Lock()
		m.activeTask = false
		m.mu.Unlock()
	}()

	// 1. Thinking
	m.emit(sessionID, domain.EventStatusChange, domain.StatusPayload{
		Status:  domain.StatusThinking,
		Message: "Analyzing task...",
	})

	select {
	case <-ctx.Done():
		m.emit(sessionID, domain.EventStatusChange, domain.StatusPayload{Status: domain.StatusTerminated})
		return
	case <-time.After(600 * time.Millisecond):
	}

	// 2. Stream intro response
	intro := fmt.Sprintf("I received your prompt: \"%s\". Let me inspect the project directory at `%s`.\n\n", prompt, projectDir)
	words := []string{"I", " received", " your", " prompt.", " Let", " me", " check", " the", " local", " workspace", " structure..."}
	_ = intro

	m.emit(sessionID, domain.EventStatusChange, domain.StatusPayload{
		Status:  domain.StatusWorking,
		Message: "Streaming response...",
	})

	for _, word := range words {
		select {
		case <-ctx.Done():
			m.emit(sessionID, domain.EventStatusChange, domain.StatusPayload{Status: domain.StatusTerminated})
			return
		case <-time.After(80 * time.Millisecond):
			m.emit(sessionID, domain.EventMessageChunk, domain.MessageChunkPayload{Content: word})
		}
	}

	// 3. Simulate tool call: ReadFile
	toolID := fmt.Sprintf("tool_%d", time.Now().UnixNano())
	m.emit(sessionID, domain.EventToolStart, domain.ToolCallPayload{
		ToolID:   toolID,
		ToolName: "read_file",
		Input: map[string]interface{}{
			"path": "README.md",
		},
		Status: "running",
	})

	select {
	case <-ctx.Done():
		m.emit(sessionID, domain.EventStatusChange, domain.StatusPayload{Status: domain.StatusTerminated})
		return
	case <-time.After(700 * time.Millisecond):
	}

	m.emit(sessionID, domain.EventToolEnd, domain.ToolCallPayload{
		ToolID:   toolID,
		ToolName: "read_file",
		Output:   "Read 120 lines from README.md successfully.",
		Status:   "completed",
	})

	// 4. Stream follow-up text
	followUp := "\n\nI have read the `README.md` and verified the project setup. Ready for your next command!"
	for _, char := range followUp {
		select {
		case <-ctx.Done():
			m.emit(sessionID, domain.EventStatusChange, domain.StatusPayload{Status: domain.StatusTerminated})
			return
		case <-time.After(15 * time.Millisecond):
			m.emit(sessionID, domain.EventMessageChunk, domain.MessageChunkPayload{Content: string(char)})
		}
	}

	m.emit(sessionID, domain.EventMessageComplete, domain.MessageCompletePayload{
		Content: "Task finished.",
	})

	// 5. Done
	m.emit(sessionID, domain.EventStatusChange, domain.StatusPayload{
		Status:  domain.StatusDone,
		Message: "Ready",
	})
}
