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
}

// SessionRepository defines the storage interface for persisting sessions.
type SessionRepository interface {
	Save(session *Session) error
	Get(id string) (*Session, error)
	List(projectDir string) ([]*Session, error)
	Delete(id string) error
}
