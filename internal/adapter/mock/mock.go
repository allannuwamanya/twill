package mock

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"time"

	"twill/internal/domain"
)

type planDecision struct {
	approved bool
	feedback string
}

// MockAdapter provides a deterministic simulation of an agent for offline UI development and testing.
type MockAdapter struct {
	mu            sync.Mutex
	eventsChan    chan domain.Event
	cancelFunc    context.CancelFunc
	activeTask    bool
	approvals     map[string]chan bool
	answers       map[string]chan string
	planDecisions map[string]chan planDecision
}

// NewMockAdapter initializes a new MockAdapter.
func NewMockAdapter() *MockAdapter {
	return &MockAdapter{
		eventsChan:    make(chan domain.Event, 200),
		approvals:     make(map[string]chan bool),
		answers:       make(map[string]chan string),
		planDecisions: make(map[string]chan planDecision),
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

func (m *MockAdapter) SendPlanDecision(planID string, approved bool, feedback string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if ch, exists := m.planDecisions[planID]; exists {
		ch <- planDecision{approved: approved, feedback: feedback}
		delete(m.planDecisions, planID)
		return nil
	}
	return fmt.Errorf("no pending plan with ID %s", planID)
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

	lower := strings.ToLower(prompt)

	// 1. Thinking state
	m.emit(sessionID, domain.EventStatusChange, domain.StatusPayload{
		Status:  domain.StatusThinking,
		Message: "Analyzing task requirements...",
	})

	select {
	case <-ctx.Done():
		m.emit(sessionID, domain.EventStatusChange, domain.StatusPayload{Status: domain.StatusTerminated, Message: "Stopped by user"})
		return
	case <-time.After(400 * time.Millisecond):
	}

	// Branch based on prompt intent to demonstrate each Phase 2 interactive capability:
	if strings.Contains(lower, "question") || strings.Contains(lower, "auth") || strings.Contains(lower, "choose") {
		m.runQuestionFlow(ctx, sessionID, prompt)
		return
	}

	if strings.Contains(lower, "plan") || strings.Contains(lower, "refactor") {
		m.runPlanFlow(ctx, sessionID, projectDir, prompt)
		return
	}

	if strings.Contains(lower, "perm") || strings.Contains(lower, "bash") || strings.Contains(lower, "delete") || strings.Contains(lower, "install") {
		m.runPermissionFlow(ctx, sessionID, projectDir, prompt)
		return
	}

	// Default flow: standard token streaming with tool execution
	m.runStandardFlow(ctx, sessionID, projectDir, prompt)
}

func (m *MockAdapter) runStandardFlow(ctx context.Context, sessionID string, projectDir string, prompt string) {
	m.emit(sessionID, domain.EventStatusChange, domain.StatusPayload{
		Status:  domain.StatusWorking,
		Message: "Inspecting workspace...",
	})

	introText := fmt.Sprintf("I received your task: **\"%s\"**\n\nLet me start by inspecting the project files in `%s`.\n\n", prompt, projectDir)
	if !m.streamWords(ctx, sessionID, introText, 30*time.Millisecond) {
		m.emit(sessionID, domain.EventStatusChange, domain.StatusPayload{Status: domain.StatusTerminated, Message: "Stopped by user"})
		return
	}

	// Tool call: read_file
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
	case <-time.After(500 * time.Millisecond):
	}

	m.emit(sessionID, domain.EventToolEnd, domain.ToolCallPayload{
		ToolID:   toolID,
		ToolName: "read_file",
		Output:   "Read 160 lines from README.md successfully.",
		Status:   "completed",
	})

	bodyText := `Here is what I found in the workspace:

- **Project:** Twill
- **Tagline:** *"Same coding CLI agents. Better interface."*
- **Status:** All systems ready.

` + "```typescript" + `
// Twill maps every event into typed UI components:
wailsBridge.onAgentEvent((evt) => {
  renderComponent(evt);
});
` + "```" + `

Try typing:
- *"ask me a question"* to test the question prompt.
- *"propose a plan"* to test the plan review flow.
- *"run bash command"* to test the permission approval dialog.`

	if !m.streamWords(ctx, sessionID, bodyText, 25*time.Millisecond) {
		m.emit(sessionID, domain.EventStatusChange, domain.StatusPayload{Status: domain.StatusTerminated, Message: "Stopped by user"})
		return
	}

	m.emit(sessionID, domain.EventMessageComplete, domain.MessageCompletePayload{Content: "Done"})
	m.emit(sessionID, domain.EventStatusChange, domain.StatusPayload{Status: domain.StatusDone, Message: "Task completed"})
}

func (m *MockAdapter) runPermissionFlow(ctx context.Context, sessionID string, projectDir string, prompt string) {
	m.emit(sessionID, domain.EventStatusChange, domain.StatusPayload{
		Status:  domain.StatusWorking,
		Message: "Preparing command execution...",
	})

	intro := "To proceed with this task, I need to execute a shell command to install dependencies.\n\n"
	if !m.streamWords(ctx, sessionID, intro, 30*time.Millisecond) {
		return
	}

	reqID := fmt.Sprintf("req_%d", time.Now().UnixNano())
	ch := make(chan bool, 1)

	m.mu.Lock()
	m.approvals[reqID] = ch
	m.mu.Unlock()

	// Emit Permission Request
	m.emit(sessionID, domain.EventPermissionRequest, domain.PermissionRequestPayload{
		RequestID:   reqID,
		Action:      "Execute Bash Command",
		Description: "The agent wants to run a package installation command in your workspace.",
		Details: map[string]interface{}{
			"command":   "npm install --save-dev @types/node",
			"directory": projectDir,
		},
	})

	m.emit(sessionID, domain.EventStatusChange, domain.StatusPayload{
		Status:  domain.StatusWaiting,
		Message: "Waiting for your approval...",
	})

	var approved bool
	select {
	case <-ctx.Done():
		m.emit(sessionID, domain.EventStatusChange, domain.StatusPayload{Status: domain.StatusTerminated})
		return
	case res := <-ch:
		approved = res
	}

	if !approved {
		m.emit(sessionID, domain.EventStatusChange, domain.StatusPayload{Status: domain.StatusWorking, Message: "Permission denied"})
		m.streamWords(ctx, sessionID, "\n\n❌ **Action rejected by user.** Halting command execution.", 25*time.Millisecond)
		m.emit(sessionID, domain.EventMessageComplete, domain.MessageCompletePayload{Content: "Rejected"})
		m.emit(sessionID, domain.EventStatusChange, domain.StatusPayload{Status: domain.StatusDone, Message: "Ready"})
		return
	}

	// User approved: proceed with execution
	m.emit(sessionID, domain.EventStatusChange, domain.StatusPayload{Status: domain.StatusWorking, Message: "Executing approved command..."})
	m.streamWords(ctx, sessionID, "\n\n✅ **Permission granted.** Executing `npm install --save-dev @types/node`...\n\n", 25*time.Millisecond)

	toolID := fmt.Sprintf("tool_%d", time.Now().UnixNano())
	m.emit(sessionID, domain.EventToolStart, domain.ToolCallPayload{
		ToolID:   toolID,
		ToolName: "bash",
		Input:    map[string]interface{}{"command": "npm install --save-dev @types/node"},
		Status:   "running",
	})

	time.Sleep(700 * time.Millisecond)

	m.emit(sessionID, domain.EventToolEnd, domain.ToolCallPayload{
		ToolID:   toolID,
		ToolName: "bash",
		Output:   "added 1 package, and audited 239 packages in 650ms\nfound 0 vulnerabilities",
		Status:   "completed",
	})

	m.streamWords(ctx, sessionID, "Installation completed successfully.", 25*time.Millisecond)
	m.emit(sessionID, domain.EventMessageComplete, domain.MessageCompletePayload{Content: "Done"})
	m.emit(sessionID, domain.EventStatusChange, domain.StatusPayload{Status: domain.StatusDone, Message: "Ready"})
}

func (m *MockAdapter) runQuestionFlow(ctx context.Context, sessionID string, prompt string) {
	m.emit(sessionID, domain.EventStatusChange, domain.StatusPayload{
		Status:  domain.StatusWorking,
		Message: "Clarifying architectural choices...",
	})

	intro := "Before I proceed, I need to know which architecture or tooling you would like to use:\n\n"
	if !m.streamWords(ctx, sessionID, intro, 30*time.Millisecond) {
		return
	}

	qID := fmt.Sprintf("q_%d", time.Now().UnixNano())
	ch := make(chan string, 1)

	m.mu.Lock()
	m.answers[qID] = ch
	m.mu.Unlock()

	// Emit question
	m.emit(sessionID, domain.EventQuestion, domain.QuestionPayload{
		QuestionID:  qID,
		Question:    "Which authentication strategy do you want to implement for this application?",
		AllowCustom: true,
		Options: []domain.QuestionOption{
			{ID: "jwt", Label: "JWT Bearer Tokens (Stateless)"},
			{ID: "session", Label: "HttpOnly Session Cookies (Stateful)"},
			{ID: "oauth", Label: "OAuth 2.0 / OpenID Connect"},
		},
	})

	m.emit(sessionID, domain.EventStatusChange, domain.StatusPayload{
		Status:  domain.StatusWaiting,
		Message: "Waiting for your answer...",
	})

	var answer string
	select {
	case <-ctx.Done():
		m.emit(sessionID, domain.EventStatusChange, domain.StatusPayload{Status: domain.StatusTerminated})
		return
	case res := <-ch:
		answer = res
	}

	m.emit(sessionID, domain.EventStatusChange, domain.StatusPayload{Status: domain.StatusWorking, Message: "Applying your choice..."})
	response := fmt.Sprintf("\n\nGreat choice! Proceeding with: **%s**.\nConfiguring auth middleware now...", answer)
	m.streamWords(ctx, sessionID, response, 25*time.Millisecond)

	m.emit(sessionID, domain.EventMessageComplete, domain.MessageCompletePayload{Content: "Done"})
	m.emit(sessionID, domain.EventStatusChange, domain.StatusPayload{Status: domain.StatusDone, Message: "Ready"})
}

func (m *MockAdapter) runPlanFlow(ctx context.Context, sessionID string, projectDir string, prompt string) {
	m.emit(sessionID, domain.EventStatusChange, domain.StatusPayload{
		Status:  domain.StatusThinking,
		Message: "Formulating execution plan...",
	})

	intro := "I have designed a step-by-step plan for your task. Please review the plan below before execution begins:\n\n"
	if !m.streamWords(ctx, sessionID, intro, 30*time.Millisecond) {
		return
	}

	planID := fmt.Sprintf("plan_%d", time.Now().UnixNano())
	ch := make(chan planDecision, 1)

	m.mu.Lock()
	m.planDecisions[planID] = ch
	m.mu.Unlock()

	steps := []domain.PlanStep{
		{Index: 1, Description: "Analyze existing configuration and dependencies", Status: "pending"},
		{Index: 2, Description: "Refactor core modules to support streaming events", Status: "pending"},
		{Index: 3, Description: "Run test suite and verify end-to-end functionality", Status: "pending"},
	}

	m.emit(sessionID, domain.EventPlan, domain.PlanPayload{
		PlanID: planID,
		Title:  "Refactoring & Implementation Plan",
		Steps:  steps,
	})

	m.emit(sessionID, domain.EventStatusChange, domain.StatusPayload{
		Status:  domain.StatusWaiting,
		Message: "Waiting for plan approval...",
	})

	var decision planDecision
	select {
	case <-ctx.Done():
		m.emit(sessionID, domain.EventStatusChange, domain.StatusPayload{Status: domain.StatusTerminated})
		return
	case res := <-ch:
		decision = res
	}

	if !decision.approved {
		m.emit(sessionID, domain.EventStatusChange, domain.StatusPayload{Status: domain.StatusWorking, Message: "Plan rejected"})
		feedbackMsg := "\n\n❌ **Plan rejected.** "
		if decision.feedback != "" {
			feedbackMsg += fmt.Sprintf("Feedback: *\"%s\"*. Adjusting strategy...", decision.feedback)
		} else {
			feedbackMsg += "Execution cancelled."
		}
		m.streamWords(ctx, sessionID, feedbackMsg, 25*time.Millisecond)
		m.emit(sessionID, domain.EventMessageComplete, domain.MessageCompletePayload{Content: "Rejected"})
		m.emit(sessionID, domain.EventStatusChange, domain.StatusPayload{Status: domain.StatusDone, Message: "Ready"})
		return
	}

	// Plan approved: execute each step with progress updates
	m.emit(sessionID, domain.EventStatusChange, domain.StatusPayload{Status: domain.StatusWorking, Message: "Executing approved plan..."})
	m.streamWords(ctx, sessionID, "\n\n🚀 **Plan approved.** Beginning execution:\n\n", 25*time.Millisecond)

	for i := range steps {
		steps[i].Status = "in_progress"
		m.emit(sessionID, domain.EventPlan, domain.PlanPayload{
			PlanID: planID,
			Title:  "Refactoring & Implementation Plan",
			Steps:  steps,
		})

		time.Sleep(600 * time.Millisecond)

		steps[i].Status = "completed"
		m.emit(sessionID, domain.EventPlan, domain.PlanPayload{
			PlanID: planID,
			Title:  "Refactoring & Implementation Plan",
			Steps:  steps,
		})
	}

	m.streamWords(ctx, sessionID, "All plan steps completed successfully.", 25*time.Millisecond)
	m.emit(sessionID, domain.EventMessageComplete, domain.MessageCompletePayload{Content: "Done"})
	m.emit(sessionID, domain.EventStatusChange, domain.StatusPayload{Status: domain.StatusDone, Message: "Ready"})
}
