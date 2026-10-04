package domain

import "time"

// EventType defines the type of event emitted by an agent.
type EventType string

const (
	EventStatusChange      EventType = "status_change"
	EventMessageChunk      EventType = "message_chunk"
	EventMessageComplete   EventType = "message_complete"
	EventToolStart         EventType = "tool_start"
	EventToolProgress      EventType = "tool_progress"
	EventToolEnd           EventType = "tool_end"
	EventPermissionRequest EventType = "permission_request"
	EventQuestion          EventType = "question"
	EventPlan              EventType = "plan"
	EventDiff              EventType = "diff"
	EventError             EventType = "error"
)

// AgentStatus represents the high-level operational state of the agent.
type AgentStatus string

const (
	StatusIdle       AgentStatus = "idle"
	StatusThinking   AgentStatus = "thinking"
	StatusWorking    AgentStatus = "working"
	StatusWaiting    AgentStatus = "waiting_for_user"
	StatusDone       AgentStatus = "done"
	StatusFailed     AgentStatus = "failed"
	StatusTerminated AgentStatus = "terminated"
)

// Event is the envelope for all normalized events sent from backend to frontend.
type Event struct {
	ID        string      `json:"id"`
	SessionID string      `json:"sessionId"`
	Type      EventType   `json:"type"`
	Timestamp time.Time   `json:"timestamp"`
	Payload   interface{} `json:"payload"`
}

// StatusPayload carries status transition data.
type StatusPayload struct {
	Status  AgentStatus `json:"status"`
	Message string      `json:"message,omitempty"`
}

// MessageChunkPayload represents a chunk of streamed text.
type MessageChunkPayload struct {
	Content string `json:"content"`
}

// MessageCompletePayload indicates the full message has finished streaming.
type MessageCompletePayload struct {
	Content string `json:"content"`
}

// ToolCallPayload describes a tool the agent is invoking.
type ToolCallPayload struct {
	ToolID   string                 `json:"toolId"`
	ToolName string                 `json:"toolName"`
	Input    map[string]interface{} `json:"input,omitempty"`
	Output   string                 `json:"output,omitempty"`
	Status   string                 `json:"status"` // running, completed, failed
}

// PermissionRequestPayload represents an action requiring explicit user approval.
type PermissionRequestPayload struct {
	RequestID   string                 `json:"requestId"`
	Action      string                 `json:"action"`
	Description string                 `json:"description"`
	Details     map[string]interface{} `json:"details,omitempty"`
}

// QuestionOption represents a suggested answer in a multiple-choice question.
type QuestionOption struct {
	ID    string `json:"id"`
	Label string `json:"label"`
}

// QuestionPayload carries a question from the agent to the user.
type QuestionPayload struct {
	QuestionID  string           `json:"questionId"`
	Question    string           `json:"question"`
	Options     []QuestionOption `json:"options,omitempty"`
	AllowCustom bool             `json:"allowCustom"`
}

// PlanStep represents a single step in an execution plan.
type PlanStep struct {
	Index       int    `json:"index"`
	Description string `json:"description"`
	Status      string `json:"status"` // pending, in_progress, completed, failed
}

// PlanPayload carries a plan proposed by the agent.
type PlanPayload struct {
	PlanID string     `json:"planId"`
	Title  string     `json:"title"`
	Steps  []PlanStep `json:"steps"`
}

// FileDiff represents changes to a single file.
type FileDiff struct {
	FilePath string `json:"filePath"`
	OldPath  string `json:"oldPath,omitempty"`
	NewPath  string `json:"newPath,omitempty"`
	Status   string `json:"status"` // modified, added, deleted
	DiffText string `json:"diffText"`
}

// DiffPayload carries one or more file diffs for code review.
type DiffPayload struct {
	DiffID string     `json:"diffId"`
	Files  []FileDiff `json:"files"`
}

// ErrorPayload describes an error condition.
type ErrorPayload struct {
	Code    string `json:"code"`
	Message string `json:"message"`
	Details string `json:"details,omitempty"`
}
