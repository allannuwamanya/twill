package domain

import (
	"context"
)

// AgentAdapter defines the contract for any agent runner (Mock, Claude Code, etc.).
// All events emitted by the adapter must be normalized to domain.Event.
type AgentAdapter interface {
	// ID returns the unique identifier for this adapter (e.g., "mock", "claude").
	ID() string

	// Name returns a human-friendly display name.
	Name() string

	// Start begins a task execution in the specified project directory with the given prompt.
	Start(ctx context.Context, sessionID string, projectDir string, prompt string) error

	// Stop requests immediate termination of the currently running task.
	Stop() error

	// SendApproval submits the user's decision for a pending permission request.
	SendApproval(requestID string, approved bool, alwaysAllow bool) error

	// SendAnswer submits the user's answer to a pending question.
	SendAnswer(questionID string, answer string) error

	// SendPlanDecision submits the user's review decision for a proposed plan.
	SendPlanDecision(planID string, approved bool, feedback string) error

	// SendDiffDecision submits per-file accept/reject choices for code changes.
	SendDiffDecision(diffID string, decisions map[string]bool) error

	// Events returns a receive-only channel yielding normalized domain events.
	Events() <-chan Event
}
