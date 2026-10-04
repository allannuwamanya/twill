package domain

import "time"

// MessageRole defines who authored the message.
type MessageRole string

const (
	RoleUser      MessageRole = "user"
	RoleAssistant MessageRole = "assistant"
	RoleSystem    MessageRole = "system"
)

// Message represents a persisted chat message.
type Message struct {
	ID        string      `json:"id"`
	Role      MessageRole `json:"role"`
	Content   string      `json:"content"`
	Timestamp time.Time   `json:"timestamp"`
}

// Session represents a work session associated with a local project folder.
type Session struct {
	ID         string    `json:"id"`
	ProjectDir string    `json:"projectDir"`
	Title      string    `json:"title"`
	CreatedAt  time.Time `json:"createdAt"`
	UpdatedAt  time.Time `json:"updatedAt"`
	Messages   []Message `json:"messages"`
	// Timeline is the UI timeline (messages, tool cards, diffs, ...) serialized as JSON,
	// so a resumed session looks exactly as it did when it was saved.
	Timeline string `json:"timeline,omitempty"`
	// AdapterID is the agent adapter used (e.g. "claude").
	AdapterID string `json:"adapterId,omitempty"`
	// AgentSessionID is the underlying agent's own session ID, used to resume its context.
	AgentSessionID string `json:"agentSessionId,omitempty"`
}

// SessionSummary is a lightweight view of a session for the history sidebar.
type SessionSummary struct {
	ID           string    `json:"id"`
	ProjectDir   string    `json:"projectDir"`
	Title        string    `json:"title"`
	UpdatedAt    time.Time `json:"updatedAt"`
	MessageCount int       `json:"messageCount"`
}

// Summary builds the sidebar summary for a session.
func (s *Session) Summary() SessionSummary {
	return SessionSummary{
		ID:           s.ID,
		ProjectDir:   s.ProjectDir,
		Title:        s.Title,
		UpdatedAt:    s.UpdatedAt,
		MessageCount: len(s.Messages),
	}
}

// SessionRepository defines the storage interface for persisting sessions.
type SessionRepository interface {
	Save(session *Session) error
	Get(id string) (*Session, error)
	// List returns sessions for projectDir ("" = all projects), newest first.
	List(projectDir string) ([]*Session, error)
	Delete(id string) error
}
