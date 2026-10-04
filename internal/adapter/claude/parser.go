package claude

import (
	"encoding/json"
	"fmt"
	"strings"

	"twill/internal/domain"
)

// ParsedEvent is a normalized event produced from one stream-json line.
type ParsedEvent struct {
	Type    domain.EventType
	Payload interface{}
}

// ParseResult holds the events parsed from a line plus protocol-level data.
type ParseResult struct {
	Events []ParsedEvent
	// ClaudeSessionID is set on system/init lines.
	ClaudeSessionID string
	// PermissionRequestID / PermissionInput are set for can_use_tool control requests,
	// so the adapter can answer them later.
	PermissionRequestID string
	PermissionInput     map[string]interface{}
	// Finished is true on the terminal "result" line.
	Finished bool
}

type rawLine struct {
	Type      string          `json:"type"`
	Subtype   string          `json:"subtype"`
	SessionID string          `json:"session_id"`
	Event     json.RawMessage `json:"event"`
	Message   json.RawMessage `json:"message"`
	RequestID string          `json:"request_id"`
	Request   json.RawMessage `json:"request"`
	IsError   bool            `json:"is_error"`
	Result    string          `json:"result"`
}

type contentBlock struct {
	Type      string                 `json:"type"`
	ID        string                 `json:"id"`
	Name      string                 `json:"name"`
	Input     map[string]interface{} `json:"input"`
	ToolUseID string                 `json:"tool_use_id"`
	Content   json.RawMessage        `json:"content"`
	IsError   bool                   `json:"is_error"`
}

type messageBody struct {
	Content json.RawMessage `json:"content"`
}

// ParseLine converts a single NDJSON line from `claude -p --output-format stream-json`.
func ParseLine(line string) (ParseResult, error) {
	var res ParseResult
	line = strings.TrimSpace(line)
	if line == "" {
		return res, nil
	}
	var raw rawLine
	if err := json.Unmarshal([]byte(line), &raw); err != nil {
		return res, fmt.Errorf("invalid stream-json line: %w", err)
	}

	switch raw.Type {
	case "system":
		if raw.Subtype == "init" {
			res.ClaudeSessionID = raw.SessionID
			res.Events = append(res.Events, ParsedEvent{domain.EventStatusChange,
				domain.StatusPayload{Status: domain.StatusThinking, Message: "Session started"}})
		}
	case "stream_event":
		var ev struct {
			Type  string `json:"type"`
			Delta struct {
				Type     string `json:"type"`
				Text     string `json:"text"`
				Thinking string `json:"thinking"`
			} `json:"delta"`
		}
		if err := json.Unmarshal(raw.Event, &ev); err != nil {
			return res, nil
		}
		if ev.Type == "content_block_delta" && ev.Delta.Type == "text_delta" && ev.Delta.Text != "" {
			res.Events = append(res.Events, ParsedEvent{domain.EventMessageChunk,
				domain.MessageChunkPayload{Content: ev.Delta.Text}})
		}
	case "assistant":
		// Text is already streamed via deltas; only surface tool calls here.
		for _, b := range parseBlocks(raw.Message) {
			if b.Type != "tool_use" {
				continue
			}
			res.Events = append(res.Events, ParsedEvent{domain.EventToolStart, domain.ToolCallPayload{
				ToolID: b.ID, ToolName: b.Name, Input: b.Input, Status: "running",
			}})
			if d := buildEditDiff(b); d != nil {
				res.Events = append(res.Events, ParsedEvent{domain.EventDiff, *d})
			}
		}
	case "user":
		for _, b := range parseBlocks(raw.Message) {
			if b.Type != "tool_result" {
				continue
			}
			status := "completed"
			if b.IsError {
				status = "failed"
			}
			res.Events = append(res.Events, ParsedEvent{domain.EventToolEnd, domain.ToolCallPayload{
				ToolID: b.ToolUseID, Output: blockText(b.Content), Status: status,
			}})
		}
	case "control_request":
		var req struct {
			Subtype  string                 `json:"subtype"`
			ToolName string                 `json:"tool_name"`
			Input    map[string]interface{} `json:"input"`
			Desc     string                 `json:"description"`
			Title    string                 `json:"title"`
		}
		if err := json.Unmarshal(raw.Request, &req); err != nil || req.Subtype != "can_use_tool" {
			return res, nil
		}
		desc := req.Title
		if desc == "" {
			desc = req.Desc
		}
		if desc == "" {
			desc = "Claude wants to use " + req.ToolName
		}
		res.PermissionRequestID = raw.RequestID
		res.PermissionInput = req.Input
		res.Events = append(res.Events,
			ParsedEvent{domain.EventStatusChange, domain.StatusPayload{Status: domain.StatusWaiting}},
			ParsedEvent{domain.EventPermissionRequest, domain.PermissionRequestPayload{
				RequestID: raw.RequestID, Action: req.ToolName, Description: desc, Details: req.Input,
			}})
	case "result":
		res.Finished = true
		if raw.IsError {
			res.Events = append(res.Events, ParsedEvent{domain.EventError,
				domain.ErrorPayload{Code: raw.Subtype, Message: raw.Result}})
			res.Events = append(res.Events, ParsedEvent{domain.EventStatusChange,
				domain.StatusPayload{Status: domain.StatusFailed, Message: raw.Result}})
		} else {
			res.Events = append(res.Events,
				ParsedEvent{domain.EventMessageComplete, domain.MessageCompletePayload{Content: raw.Result}},
				ParsedEvent{domain.EventStatusChange, domain.StatusPayload{Status: domain.StatusDone}})
		}
	}
	return res, nil
}

func parseBlocks(msg json.RawMessage) []contentBlock {
	var body messageBody
	if err := json.Unmarshal(msg, &body); err != nil {
		return nil
	}
	var blocks []contentBlock
	if err := json.Unmarshal(body.Content, &blocks); err != nil {
		return nil // content may be a plain string
	}
	return blocks
}

// blockText flattens tool_result content (string or array of text blocks).
func blockText(raw json.RawMessage) string {
	var s string
	if err := json.Unmarshal(raw, &s); err == nil {
		return s
	}
	var parts []struct {
		Text string `json:"text"`
	}
	if err := json.Unmarshal(raw, &parts); err == nil {
		var sb strings.Builder
		for _, p := range parts {
			sb.WriteString(p.Text)
		}
		return sb.String()
	}
	return ""
}

// buildEditDiff synthesizes a unified diff from an Edit tool call.
func buildEditDiff(b contentBlock) *domain.DiffPayload {
	if b.Name != "Edit" {
		return nil
	}
	path, _ := b.Input["file_path"].(string)
	oldS, _ := b.Input["old_string"].(string)
	newS, _ := b.Input["new_string"].(string)
	if path == "" {
		return nil
	}
	oldLines := splitLines(oldS)
	newLines := splitLines(newS)
	var sb strings.Builder
	fmt.Fprintf(&sb, "--- a/%s\n+++ b/%s\n@@ -1,%d +1,%d @@\n", path, path, len(oldLines), len(newLines))
	for _, l := range oldLines {
		sb.WriteString("-" + l + "\n")
	}
	for _, l := range newLines {
		sb.WriteString("+" + l + "\n")
	}
	return &domain.DiffPayload{
		DiffID: b.ID,
		Files: []domain.FileDiff{{
			FilePath: path, OldPath: path, NewPath: path, Status: "modified",
			Additions: len(newLines), Deletions: len(oldLines), DiffText: sb.String(),
		}},
	}
}

func splitLines(s string) []string {
	if s == "" {
		return nil
	}
	return strings.Split(strings.TrimSuffix(s, "\n"), "\n")
}
