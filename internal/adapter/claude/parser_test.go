package claude

import (
	"testing"

	"twill/internal/domain"
)

func TestParseInit(t *testing.T) {
	r, err := ParseLine(`{"type":"system","subtype":"init","session_id":"abc"}`)
	if err != nil || r.ClaudeSessionID != "abc" || len(r.Events) != 1 {
		t.Fatalf("unexpected: %+v %v", r, err)
	}
}

func TestParseTextDelta(t *testing.T) {
	r, _ := ParseLine(`{"type":"stream_event","event":{"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hi"}}}`)
	if len(r.Events) != 1 || r.Events[0].Type != domain.EventMessageChunk {
		t.Fatalf("unexpected: %+v", r)
	}
	if r.Events[0].Payload.(domain.MessageChunkPayload).Content != "Hi" {
		t.Fatal("wrong content")
	}
}

func TestParseToolUseAndResult(t *testing.T) {
	r, _ := ParseLine(`{"type":"assistant","message":{"content":[{"type":"tool_use","id":"t1","name":"Read","input":{"file_path":"/a"}}]}}`)
	if len(r.Events) != 1 || r.Events[0].Type != domain.EventToolStart {
		t.Fatalf("unexpected: %+v", r)
	}
	r, _ = ParseLine(`{"type":"user","message":{"content":[{"type":"tool_result","tool_use_id":"t1","content":"ok"}]}}`)
	p := r.Events[0].Payload.(domain.ToolCallPayload)
	if r.Events[0].Type != domain.EventToolEnd || p.ToolID != "t1" || p.Output != "ok" {
		t.Fatalf("unexpected: %+v", r)
	}
}

func TestParseEditProducesDiff(t *testing.T) {
	r, _ := ParseLine(`{"type":"assistant","message":{"content":[{"type":"tool_use","id":"t2","name":"Edit","input":{"file_path":"/a.go","old_string":"x","new_string":"y\nz"}}]}}`)
	if len(r.Events) != 2 || r.Events[1].Type != domain.EventDiff {
		t.Fatalf("unexpected: %+v", r)
	}
	d := r.Events[1].Payload.(domain.DiffPayload)
	if d.Files[0].Additions != 2 || d.Files[0].Deletions != 1 {
		t.Fatalf("bad stats: %+v", d.Files[0])
	}
}

func TestParsePermissionRequest(t *testing.T) {
	r, _ := ParseLine(`{"type":"control_request","request_id":"r1","request":{"subtype":"can_use_tool","tool_name":"Bash","input":{"command":"ls"},"tool_use_id":"t3"}}`)
	if r.PermissionRequestID != "r1" || len(r.Events) != 2 || r.Events[1].Type != domain.EventPermissionRequest {
		t.Fatalf("unexpected: %+v", r)
	}
}

func TestParseQuestionToolInControlRequest(t *testing.T) {
	line := `{"type":"control_request","request_id":"q1","request":{"subtype":"can_use_tool","tool_name":"AskFollowupQuestion","input":{"question":"Which DB?","options":["Postgres","SQLite"],"allowCustom":true}}}`
	r, err := ParseLine(line)
	if err != nil {
		t.Fatal(err)
	}
	if r.PermissionRequestID != "q1" {
		t.Fatalf("want request ID q1, got %q", r.PermissionRequestID)
	}
	if len(r.Events) != 2 {
		t.Fatalf("want 2 events, got %d", len(r.Events))
	}
	if r.Events[0].Type != domain.EventStatusChange {
		t.Fatalf("want status change first, got %s", r.Events[0].Type)
	}
	if r.Events[1].Type != domain.EventQuestion {
		t.Fatalf("want question event, got %s", r.Events[1].Type)
	}
	q, ok := r.Events[1].Payload.(domain.QuestionPayload)
	if !ok || q.Question != "Which DB?" || len(q.Options) != 2 || !q.AllowCustom {
		t.Fatalf("unexpected question payload: %+v", q)
	}
}

func TestParseQuestionToolInAssistant(t *testing.T) {
	line := `{"type":"assistant","message":{"content":[{"type":"tool_use","id":"q2","name":"AskUserQuestion","input":{"question":"Proceed?","options":[{"id":"y","label":"Yes"},{"id":"n","label":"No"}]}}]}}`
	r, err := ParseLine(line)
	if err != nil {
		t.Fatal(err)
	}
	if len(r.Events) != 2 || r.Events[1].Type != domain.EventQuestion {
		t.Fatalf("want question event, got %+v", r.Events)
	}
	q := r.Events[1].Payload.(domain.QuestionPayload)
	if q.Question != "Proceed?" || len(q.Options) != 2 || q.Options[0].Label != "Yes" {
		t.Fatalf("unexpected question payload: %+v", q)
	}
}

func TestParseResult(t *testing.T) {
	r, _ := ParseLine(`{"type":"result","subtype":"success","is_error":false,"result":"done"}`)
	if !r.Finished || len(r.Events) != 2 {
		t.Fatalf("unexpected: %+v", r)
	}
	r, _ = ParseLine(`{"type":"result","subtype":"error_during_execution","is_error":true,"result":"boom"}`)
	if !r.Finished || r.Events[0].Type != domain.EventError {
		t.Fatalf("unexpected: %+v", r)
	}
}

func TestParseInvalid(t *testing.T) {
	if _, err := ParseLine("not json"); err == nil {
		t.Fatal("expected error")
	}
	if r, err := ParseLine("  "); err != nil || len(r.Events) != 0 {
		t.Fatal("blank line should be ignored")
	}
}
