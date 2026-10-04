package mock

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"time"

	"twill/internal/domain"
)

// MockAdapter provides a deterministic simulation of an agent for offline UI development and testing.
type MockAdapter struct {
	mu         sync.Mutex
	eventsChan chan domain.Event
	cancelFunc context.CancelFunc
	activeTask bool
	approvals  map[string]chan bool
	answers    map[string]chan string
}

// NewMockAdapter initializes a new MockAdapter.
func NewMockAdapter() *MockAdapter {
	return &MockAdapter{
		eventsChan: make(chan domain.Event, 200),
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

func (m *MockAdapter) streamWords(ctx context.Context, sessionID string, text string, delay time.Duration) bool {
	words := strings.Split(text, " ")
	for i, word := range words {
		select {
		case <-ctx.Done():
			return false
		case <-time.After(delay):
			chunk := word
			if i < len(words)-1 {
				chunk += " "
			}
			m.emit(sessionID, domain.EventMessageChunk, domain.MessageChunkPayload{Content: chunk})
		}
	}
	return true
}

func (m *MockAdapter) simulateRun(ctx context.Context, sessionID string, projectDir string, prompt string) {
	defer func() {
		m.mu.Lock()
		m.activeTask = false
		m.mu.Unlock()
	}()

	// 1. Thinking state
	m.emit(sessionID, domain.EventStatusChange, domain.StatusPayload{
		Status:  domain.StatusThinking,
		Message: "Analyzing task...",
	})

	select {
	case <-ctx.Done():
		m.emit(sessionID, domain.EventStatusChange, domain.StatusPayload{Status: domain.StatusTerminated, Message: "Stopped by user"})
		return
	case <-time.After(400 * time.Millisecond):
	}

	// 2. Transition to Working state
	m.emit(sessionID, domain.EventStatusChange, domain.StatusPayload{
		Status:  domain.StatusWorking,
		Message: "Inspecting workspace...",
	})

	introText := fmt.Sprintf("I received your task: **\"%s\"**\n\nLet me start by inspecting the project files in `%s`.\n\n", prompt, projectDir)
	if !m.streamWords(ctx, sessionID, introText, 35*time.Millisecond) {
		m.emit(sessionID, domain.EventStatusChange, domain.StatusPayload{Status: domain.StatusTerminated, Message: "Stopped by user"})
		return
	}

	// 3. Tool execution: list_files / read_file
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
		m.emit(sessionID, domain.EventStatusChange, domain.StatusPayload{Status: domain.StatusTerminated, Message: "Stopped by user"})
		return
	case <-time.After(600 * time.Millisecond):
	}

	m.emit(sessionID, domain.EventToolEnd, domain.ToolCallPayload{
		ToolID:   toolID,
		ToolName: "read_file",
		Output:   "Read 160 lines from README.md successfully.",
		Status:   "completed",
	})

	// 4. Stream response body with code snippet
	bodyText := `Here is what I found in the workspace:

- **Project:** Twill
- **Tagline:** *"Same coding CLI agents. Better interface."*
- **Status:** All systems ready.

Here is an example snippet showing how the adapter maps events:

` + "```typescript" + `
interface AgentEvent {
  type: 'message_chunk' | 'tool_start' | 'permission_request';
  payload: unknown;
}

// Events are mapped to UI components in real time:
wailsBridge.onAgentEvent((evt) => {
  renderComponent(evt);
});
` + "```" + `

Everything is set up and streaming is functioning smoothly!`

	if !m.streamWords(ctx, sessionID, bodyText, 30*time.Millisecond) {
		m.emit(sessionID, domain.EventStatusChange, domain.StatusPayload{Status: domain.StatusTerminated, Message: "Stopped by user"})
		return
	}

	// 5. Complete message
	m.emit(sessionID, domain.EventMessageComplete, domain.MessageCompletePayload{
		Content: "Done",
	})

	// 6. Return to Idle / Done state
	m.emit(sessionID, domain.EventStatusChange, domain.StatusPayload{
		Status:  domain.StatusDone,
		Message: "Task completed",
	})
}
