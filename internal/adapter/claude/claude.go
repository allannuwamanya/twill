package claude

import (
	"bufio"
	"context"
	"fmt"
	"io"
	"os/exec"
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
}

// NewClaudeAdapter initializes a new ClaudeAdapter.
func NewClaudeAdapter() *ClaudeAdapter {
	return &ClaudeAdapter{
		eventsChan: make(chan domain.Event, 100),
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

// LocateCLI attempts to find the claude binary.
func (c *ClaudeAdapter) LocateCLI() (string, error) {
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

	cliPath, err := c.LocateCLI()
	if err != nil {
		c.mu.Unlock()
		return err
	}

	ctx, cancel := context.WithCancel(parentCtx)
	c.cancelFunc = cancel
	c.activeTask = true

	// Spawns claude in headless/json streaming mode
	// (Flags to be tuned based on Claude Code CLI specifications: e.g. claude --print / json stream)
	cmd := exec.CommandContext(ctx, cliPath, "-p", prompt)
	cmd.Dir = projectDir

	stdin, err := cmd.StdinPipe()
	if err != nil {
		c.activeTask = false
		c.mu.Unlock()
		return fmt.Errorf("failed to open stdin pipe: %w", err)
	}
	c.stdin = stdin

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		c.activeTask = false
		c.mu.Unlock()
		return fmt.Errorf("failed to open stdout pipe: %w", err)
	}

	stderr, err := cmd.StderrPipe()
	if err != nil {
		c.activeTask = false
		c.mu.Unlock()
		return fmt.Errorf("failed to open stderr pipe: %w", err)
	}

	if err := cmd.Start(); err != nil {
		c.activeTask = false
		c.mu.Unlock()
		return fmt.Errorf("failed to start claude process: %w", err)
	}
	c.cmd = cmd
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
	defer c.mu.Unlock()

	if c.cancelFunc != nil {
		c.cancelFunc()
		c.cancelFunc = nil
	}
	if c.cmd != nil && c.cmd.Process != nil {
		_ = c.cmd.Process.Kill()
	}
	c.activeTask = false
	return nil
}

func (c *ClaudeAdapter) SendApproval(requestID string, approved bool, alwaysAllow bool) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.stdin == nil {
		return fmt.Errorf("agent is not running")
	}

	var answer string
	if approved {
		answer = "y\n"
	} else {
		answer = "n\n"
	}
	_, err := io.WriteString(c.stdin, answer)
	return err
}

func (c *ClaudeAdapter) SendAnswer(questionID string, answer string) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.stdin == nil {
		return fmt.Errorf("agent is not running")
	}

	_, err := io.WriteString(c.stdin, answer+"\n")
	return err
}

func (c *ClaudeAdapter) emit(sessionID string, eventType domain.EventType, payload interface{}) {
	c.eventsChan <- domain.Event{
		ID:        fmt.Sprintf("evt_%d", time.Now().UnixNano()),
		SessionID: sessionID,
		Type:      eventType,
		Timestamp: time.Now(),
		Payload:   payload,
	}
}

func (c *ClaudeAdapter) readStream(sessionID string, stdout io.Reader) {
	scanner := bufio.NewScanner(stdout)
	for scanner.Scan() {
		line := scanner.Text()
		// Emit line chunk (future: parse structured JSON stream)
		c.emit(sessionID, domain.EventMessageChunk, domain.MessageChunkPayload{
			Content: line + "\n",
		})
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
	if c.cmd != nil {
		_ = c.cmd.Wait()
	}
	c.mu.Lock()
	c.activeTask = false
	c.mu.Unlock()

	c.emit(sessionID, domain.EventStatusChange, domain.StatusPayload{
		Status:  domain.StatusDone,
		Message: "Process exited",
	})
}
