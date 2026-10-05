package claude

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"os/exec"
	"strings"
	"sync"
	"time"

	"twill/internal/domain"
	"twill/internal/sys"
)

// ClaudeAdapter integrates with the Claude Code CLI via structured JSON streaming.
type ClaudeAdapter struct {
	mu         sync.Mutex
	eventsChan chan domain.Event
	cmd        *exec.Cmd
	stdin      io.WriteCloser
	cancelFunc context.CancelFunc
	activeTask bool
	cliPath    string
	// sessionID and projectDir describe the running task; Stop needs the former to
	// emit a terminal event and permission checks need the latter.
	sessionID  string
	projectDir string
	// pending maps permission request IDs to the tool input to echo back on approval.
	pending map[string]map[string]interface{}
	// resumeID is the Claude session to resume on the next Start ("" = fresh session).
	resumeID string
	// permissions holds per-project "always allow" grants. May be nil.
	permissions *domain.PermissionStore
}

// SetResumeID sets the Claude session ID that the next Start will resume.
func (c *ClaudeAdapter) SetResumeID(id string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.resumeID = id
}

// NewClaudeAdapter initializes a new ClaudeAdapter. The permission store may be nil,
// in which case every tool request is escalated to the user.
func NewClaudeAdapter(permissions *domain.PermissionStore) *ClaudeAdapter {
	return &ClaudeAdapter{
		eventsChan:  make(chan domain.Event, 256),
		permissions: permissions,
	}
}

func (c *ClaudeAdapter) ID() string {
	return "claude"
}

func (c *ClaudeAdapter) Name() string {
	return "Claude Code CLI"
}

func (c *ClaudeAdapter) Events() <-chan domain.Event {
	return c.eventsChan
}

// locateCLI finds the claude binary, caching the result.
// Caller must hold c.mu (it mutates cliPath).
func (c *ClaudeAdapter) locateCLI() (string, error) {
	if c.cliPath != "" {
		return c.cliPath, nil
	}
	path, err := sys.FindExecutable("claude")
	if err != nil {
		return "", fmt.Errorf("claude executable not found in PATH or standard paths: %w", err)
	}
	c.cliPath = path
	return path, nil
}

func (c *ClaudeAdapter) Start(parentCtx context.Context, sessionID string, projectDir string, prompt string) error {
	c.mu.Lock()
	if c.activeTask {
		c.mu.Unlock()
		return fmt.Errorf("a task is already in progress")
	}

	cliPath, err := c.locateCLI()
	if err != nil {
		c.mu.Unlock()
		return err
	}

	ctx, cancel := context.WithCancel(parentCtx)
	c.cancelFunc = cancel
	c.activeTask = true
	c.sessionID = sessionID
	c.projectDir = projectDir

	// Headless structured streaming; permission prompts are routed to us over stdio.
	args := []string{
		"-p",
		"--verbose",
		"--output-format=stream-json",
		"--input-format=stream-json",
		"--include-partial-messages",
		"--permission-prompt-tool=stdio",
	}
	if c.resumeID != "" {
		args = append(args, "--resume", c.resumeID)
	}
	cmd := exec.CommandContext(ctx, cliPath, args...)
	cmd.Dir = projectDir

	// abortStart undoes everything set above and releases c.mu. Every failure path
	// below must go through it: leaving activeTask set would make the adapter
	// reject every future Start for the lifetime of the process.
	abortStart := func() {
		cancel()
		if cmd.Process != nil {
			_ = cmd.Process.Kill()
		}
		c.activeTask = false
		c.cancelFunc = nil
		c.cmd = nil
		c.stdin = nil
		c.mu.Unlock()
	}

	stdin, err := cmd.StdinPipe()
	if err != nil {
		abortStart()
		return fmt.Errorf("failed to open stdin pipe: %w", err)
	}
	c.stdin = stdin

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		abortStart()
		return fmt.Errorf("failed to open stdout pipe: %w", err)
	}

	stderr, err := cmd.StderrPipe()
	if err != nil {
		abortStart()
		return fmt.Errorf("failed to open stderr pipe: %w", err)
	}

	if err := cmd.Start(); err != nil {
		abortStart()
		return fmt.Errorf("failed to start claude process: %w", err)
	}
	c.cmd = cmd
	c.pending = map[string]map[string]interface{}{}

	if err := c.writeJSON(userMessage(prompt)); err != nil {
		abortStart()
		return fmt.Errorf("failed to send prompt: %w", err)
	}
	c.mu.Unlock()

	// Read stdout stream concurrently
	go c.readStream(sessionID, stdout)
	// Read stderr for error logging
	go c.readErrors(sessionID, stderr)
	// Wait for process exit
	go c.waitForExit(sessionID)

	return nil
}

func (c *ClaudeAdapter) Stop() error {
	c.mu.Lock()
	wasActive := c.activeTask
	sessionID := c.sessionID

	if c.cancelFunc != nil {
		c.cancelFunc()
		c.cancelFunc = nil
	}
	if c.cmd != nil && c.cmd.Process != nil {
		_ = c.cmd.Process.Kill()
	}
	c.activeTask = false
	c.mu.Unlock()

	// The process is gone, so no terminal event will arrive on stdout. Without this
	// the frontend stays in "working" forever and the composer never re-enables.
	if wasActive {
		c.emit(sessionID, domain.EventStatusChange, domain.StatusPayload{
			Status: domain.StatusTerminated, Message: "Stopped by user",
		})
	}
	return nil
}

func (c *ClaudeAdapter) SendApproval(requestID string, approved bool, alwaysAllow bool) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	input := c.pending[requestID]
	delete(c.pending, requestID)

	var decision map[string]interface{}
	if approved {
		if input == nil {
			input = map[string]interface{}{}
		}
		decision = map[string]interface{}{"behavior": "allow", "updatedInput": input}
	} else {
		decision = map[string]interface{}{"behavior": "deny", "message": "The user denied this action in Twill."}
	}
	return c.writeJSON(map[string]interface{}{
		"type": "control_response",
		"response": map[string]interface{}{
			"subtype":    "success",
			"request_id": requestID,
			"response":   decision,
		},
	})
}

func (c *ClaudeAdapter) SendAnswer(questionID string, answer string) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.writeJSON(userMessage(answer))
}

// SendPlanDecision approves or rejects a submitted plan. Plan approval arrives as
// a can_use_tool control request, so it is answered on the same channel as any
// other tool rather than by chatting about it.
func (c *ClaudeAdapter) SendPlanDecision(planID string, approved bool, feedback string) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	var decision map[string]interface{}
	if approved {
		decision = map[string]interface{}{"behavior": "allow"}
	} else {
		reason := feedback
		if reason == "" {
			reason = "The user rejected this plan in Twill."
		}
		decision = map[string]interface{}{"behavior": "deny", "message": reason}
	}

	delete(c.pending, planID)
	return c.writeJSON(map[string]interface{}{
		"type": "control_response",
		"response": map[string]interface{}{
			"subtype":    "success",
			"request_id": planID,
			"response":   decision,
		},
	})
}

func (c *ClaudeAdapter) SendDiffDecision(diffID string, decisions map[string]bool) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	var rejected []string
	for path, ok := range decisions {
		if !ok {
			rejected = append(rejected, path)
		}
	}
	if len(rejected) == 0 {
		return nil
	}
	return c.writeJSON(userMessage("The user rejected your changes to: " + strings.Join(rejected, ", ") + ". Please revert them."))
}

// emit publishes an event, dropping it if the consumer is not keeping up.
// Blocking here would stall the stdout reader and, behind it, the agent process.
func (c *ClaudeAdapter) emit(sessionID string, eventType domain.EventType, payload interface{}) {
	select {
	case c.eventsChan <- domain.Event{
		ID:        fmt.Sprintf("evt_%d", time.Now().UnixNano()),
		SessionID: sessionID,
		Type:      eventType,
		Timestamp: time.Now(),
		Payload:   payload,
	}:
	default:
	}
}

func (c *ClaudeAdapter) readStream(sessionID string, stdout io.Reader) {
	scanner := bufio.NewScanner(stdout)
	scanner.Buffer(make([]byte, 64*1024), 16*1024*1024)
	for scanner.Scan() {
		res, err := ParseLine(scanner.Text())
		if err != nil {
			continue
		}
		if res.PermissionRequestID != "" {
			if c.autoApprove(sessionID, res) {
				continue
			}
			c.mu.Lock()
			if c.pending == nil {
				c.pending = map[string]map[string]interface{}{}
			}
			c.pending[res.PermissionRequestID] = res.PermissionInput
			c.mu.Unlock()
		}
		for _, ev := range res.Events {
			c.emit(sessionID, ev.Type, ev.Payload)
		}
		if res.Finished {
			// Turn finished: close stdin so the CLI exits cleanly.
			c.mu.Lock()
			if c.stdin != nil {
				_ = c.stdin.Close()
				c.stdin = nil
			}
			c.mu.Unlock()
		}
	}
}

// autoApprove answers a tool request immediately when the user previously chose
// "always allow" for this exact action in this project. It reports whether the
// request was handled, in which case no approval prompt is surfaced.
func (c *ClaudeAdapter) autoApprove(sessionID string, res ParseResult) bool {
	// Plan review is never skippable, whatever the user has previously granted.
	if res.PermissionToolName == planToolName {
		return false
	}

	key := domain.ActionKey(res.PermissionToolName, res.PermissionInput)

	c.mu.Lock()
	perms, projectDir := c.permissions, c.projectDir
	c.mu.Unlock()

	if perms == nil || projectDir == "" || !perms.IsActionAllowed(projectDir, key) {
		return false
	}

	// The tool_use block still reaches the timeline through the normal assistant
	// message, so the user still sees the action; only the modal is skipped.
	if err := c.SendApproval(res.PermissionRequestID, true, false); err != nil {
		return false
	}
	c.emit(sessionID, domain.EventStatusChange, domain.StatusPayload{
		Status: domain.StatusWorking, Message: "Auto-approved: " + key,
	})
	return true
}

// writeJSON writes one newline-terminated JSON message to the CLI's stdin.
// Caller must hold c.mu.
func (c *ClaudeAdapter) writeJSON(v interface{}) error {
	if c.stdin == nil {
		return fmt.Errorf("agent is not running")
	}
	b, err := json.Marshal(v)
	if err != nil {
		return err
	}
	_, err = c.stdin.Write(append(b, '\n'))
	return err
}

// userMessage builds a stream-json user message.
func userMessage(text string) map[string]interface{} {
	return map[string]interface{}{
		"type": "user",
		"message": map[string]interface{}{
			"role":    "user",
			"content": text,
		},
	}
}

func (c *ClaudeAdapter) readErrors(sessionID string, stderr io.Reader) {
	scanner := bufio.NewScanner(stderr)
	for scanner.Scan() {
		line := scanner.Text()
		c.emit(sessionID, domain.EventError, domain.ErrorPayload{
			Code:    "STDERR",
			Message: line,
		})
	}
}

func (c *ClaudeAdapter) waitForExit(sessionID string) {
	var err error
	if c.cmd != nil {
		err = c.cmd.Wait()
	}
	c.mu.Lock()
	wasActive := c.activeTask
	c.activeTask = false
	c.stdin = nil
	c.mu.Unlock()

	// A normal turn already emitted done/failed from the result line.
	// Only report an exit that happened without one (crash; Stop clears activeTask first).
	if wasActive && err != nil {
		c.emit(sessionID, domain.EventStatusChange, domain.StatusPayload{
			Status:  domain.StatusFailed,
			Message: "Claude process exited: " + err.Error(),
		})
	}
}
