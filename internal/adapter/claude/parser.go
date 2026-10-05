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
	// PermissionRequestID / PermissionInput / PermissionToolName are set for
	// can_use_tool control requests, so the adapter can answer them later and
	// check whether this exact action was already granted.
	PermissionRequestID string
	PermissionInput     map[string]interface{}
	PermissionToolName  string
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
func ParseLine(line string, projectDir ...string) (ParseResult, error) {
	var res ParseResult
	line = strings.TrimSpace(line)
	if line == "" {
		return res, nil
	}
	var raw rawLine
	if err := json.Unmarshal([]byte(line), &raw); err != nil {
		return res, fmt.Errorf("invalid stream-json line: %w", err)
	}

	var dir string
	if len(projectDir) > 0 {
		dir = projectDir[0]
	}

	switch raw.Type {
	case "system":
		if raw.Subtype == "init" {
			res.ClaudeSessionID = raw.SessionID
			res.Events = append(res.Events, ParsedEvent{domain.EventStatusChange,
				domain.StatusPayload{Status: domain.StatusThinking, Message: "Session started", AgentSessionID: raw.SessionID}})
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
		// Text is already streamed via deltas; only surface tool calls and question prompts here.
		for _, b := range parseBlocks(raw.Message) {
			if b.Type != "tool_use" {
				continue
			}
			if isQuestionTool(b.Name) {
				q := parseQuestion(b.ID, b.Input, "", "")
				res.Events = append(res.Events,
					ParsedEvent{domain.EventStatusChange, domain.StatusPayload{Status: domain.StatusWaiting}},
					ParsedEvent{domain.EventQuestion, q},
				)
				continue
			}
			res.Events = append(res.Events, ParsedEvent{domain.EventToolStart, domain.ToolCallPayload{
				ToolID: b.ID, ToolName: b.Name, Input: b.Input, Status: "running",
			}})
			if d := buildEditDiffs(b, dir); len(d) > 0 {
				for _, payload := range d {
					res.Events = append(res.Events, ParsedEvent{domain.EventDiff, *payload})
				}
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
		res.PermissionRequestID = raw.RequestID
		res.PermissionInput = req.Input
		res.PermissionToolName = req.ToolName

		// A plan review arrives as an ordinary can_use_tool request, but it gets the
		// plan UI rather than the generic approval dialog.
		if req.ToolName == planToolName {
			plan, _ := req.Input["plan"].(string)
			res.PermissionRequestID = raw.RequestID
			res.Events = append(res.Events,
				ParsedEvent{domain.EventStatusChange, domain.StatusPayload{Status: domain.StatusWaiting}},
				ParsedEvent{domain.EventPlan, parsePlan(raw.RequestID, plan)})
			return res, nil
		}

		// Interactive questions route directly to the Question UI rather than generic approvals.
		if isQuestionTool(req.ToolName) {
			res.PermissionRequestID = raw.RequestID
			q := parseQuestion(raw.RequestID, req.Input, req.Title, req.Desc)
			res.Events = append(res.Events,
				ParsedEvent{domain.EventStatusChange, domain.StatusPayload{Status: domain.StatusWaiting}},
				ParsedEvent{domain.EventQuestion, q})
			return res, nil
		}

		desc := req.Title
		if desc == "" {
			desc = req.Desc
		}
		if desc == "" {
			desc = "Claude wants to use " + req.ToolName
		}
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

func isQuestionTool(name string) bool {
	switch strings.ToLower(name) {
	case "askfollowupquestion", "askuserquestion", "askquestion", "questionprompt", "promptuser", "askuser", "question":
		return true
	default:
		return false
	}
}

func parseQuestion(id string, input map[string]interface{}, title, desc string) domain.QuestionPayload {
	text := ""
	if input != nil {
		for _, key := range []string{"question", "prompt", "message", "text"} {
			if val, ok := input[key].(string); ok && strings.TrimSpace(val) != "" {
				text = strings.TrimSpace(val)
				break
			}
		}
	}
	if text == "" {
		if title != "" {
			text = title
		} else if desc != "" {
			text = desc
		} else {
			text = "The agent is asking for clarification."
		}
	}

	var options []domain.QuestionOption
	if input != nil {
		if rawOpts, ok := input["options"].([]interface{}); ok {
			for idx, opt := range rawOpts {
				switch o := opt.(type) {
				case string:
					if strings.TrimSpace(o) != "" {
						options = append(options, domain.QuestionOption{
							ID:    fmt.Sprintf("opt_%d", idx+1),
							Label: strings.TrimSpace(o),
						})
					}
				case map[string]interface{}:
					label, _ := o["label"].(string)
					if label == "" {
						label, _ = o["text"].(string)
					}
					optID, _ := o["id"].(string)
					if optID == "" {
						optID = fmt.Sprintf("opt_%d", idx+1)
					}
					if strings.TrimSpace(label) != "" {
						options = append(options, domain.QuestionOption{
							ID:    optID,
							Label: strings.TrimSpace(label),
						})
					}
				}
			}
		}
	}

	allowCustom := true
	if input != nil {
		if ac, ok := input["allowCustom"].(bool); ok {
			allowCustom = ac
		} else if ac, ok := input["allow_custom"].(bool); ok {
			allowCustom = ac
		}
	}

	return domain.QuestionPayload{
		QuestionID:  id,
		Question:    text,
		Options:     options,
		AllowCustom: allowCustom,
	}
}
