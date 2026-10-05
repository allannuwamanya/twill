package claude

import (
	"context"
	"strings"
	"testing"

	"twill/internal/domain"
)

// TestStopEmitsTerminated guards the UI-lock bug: killing the process produces no
// terminal event on stdout, so without this the frontend stays "working" forever.
func TestStopEmitsTerminated(t *testing.T) {
	c := NewClaudeAdapter(nil)
	c.mu.Lock()
	c.activeTask = true
	c.sessionID = "sess_1"
	c.mu.Unlock()

	if err := c.Stop(); err != nil {
		t.Fatal(err)
	}

	evt := <-c.Events()
	if evt.Type != domain.EventStatusChange {
		t.Fatalf("want status_change, got %s", evt.Type)
	}
	if evt.SessionID != "sess_1" {
		t.Fatalf("want session sess_1, got %q", evt.SessionID)
	}
	if got := evt.Payload.(domain.StatusPayload).Status; got != domain.StatusTerminated {
		t.Fatalf("want terminated, got %s", got)
	}
}

// TestStopWhenIdleIsSilent avoids a spurious terminal event on a task that never ran.
func TestStopWhenIdleIsSilent(t *testing.T) {
	c := NewClaudeAdapter(nil)
	if err := c.Stop(); err != nil {
		t.Fatal(err)
	}
	select {
	case evt := <-c.Events():
		t.Fatalf("unexpected event while idle: %+v", evt)
	default:
	}
}

// TestStartFailureDoesNotWedgeAdapter covers the bug where a failed start left
// activeTask set, making every later Start return "a task is already in progress".
func TestStartFailureDoesNotWedgeAdapter(t *testing.T) {
	c := NewClaudeAdapter(nil)
	// A cached path to a binary that cannot be executed fails at cmd.Start().
	c.cliPath = "/nonexistent/claude-binary"

	const busy = "a task is already in progress"

	for attempt := 1; attempt <= 2; attempt++ {
		err := c.Start(context.Background(), "sess_1", t.TempDir(), "hello")
		if err == nil {
			t.Fatal("expected Start to fail")
		}
		if strings.Contains(err.Error(), busy) {
			t.Fatalf("attempt %d reported a wedged adapter: %v", attempt, err)
		}
	}

	c.mu.Lock()
	active := c.activeTask
	c.mu.Unlock()
	if active {
		t.Fatal("activeTask left set after a failed start")
	}
}

func TestStartRejectsConcurrentTask(t *testing.T) {
	c := NewClaudeAdapter(nil)
	c.mu.Lock()
	c.activeTask = true
	c.mu.Unlock()

	if err := c.Start(context.Background(), "sess_1", t.TempDir(), "hi"); err == nil ||
		!strings.Contains(err.Error(), "already in progress") {
		t.Fatalf("want busy error, got %v", err)
	}
}

func TestAutoApproveSkipsPromptOnlyForGrantedActions(t *testing.T) {
	store, err := domain.NewPermissionStore(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	projectDir := t.TempDir()
	if err := store.AllowAction(projectDir, "Bash:git status"); err != nil {
		t.Fatal(err)
	}

	c := NewClaudeAdapter(store)
	c.mu.Lock()
	c.projectDir = projectDir
	c.mu.Unlock()

	granted := ParseResult{
		PermissionRequestID: "r1",
		PermissionToolName:  "Bash",
		PermissionInput:     map[string]interface{}{"command": " git  status "},
	}
	// Nothing is pending on stdin, so the write fails and the request is not
	// consumed -- but it must not be treated as auto-approved either.
	if c.autoApprove("sess_1", granted) {
		t.Fatal("auto-approve reported success despite the failed write")
	}

	other := ParseResult{
		PermissionRequestID: "r2",
		PermissionToolName:  "Bash",
		PermissionInput:     map[string]interface{}{"command": "rm -rf /"},
	}
	if c.autoApprove("sess_1", other) {
		t.Fatal("an ungranted action must still be escalated")
	}
}

func TestAutoApproveWithoutStoreEscalates(t *testing.T) {
	c := NewClaudeAdapter(nil)
	c.mu.Lock()
	c.projectDir = t.TempDir()
	c.mu.Unlock()

	res := ParseResult{
		PermissionRequestID: "r1",
		PermissionToolName:  "Bash",
		PermissionInput:     map[string]interface{}{"command": "ls"},
	}
	if c.autoApprove("sess_1", res) {
		t.Fatal("nil permission store must escalate everything")
	}
}
