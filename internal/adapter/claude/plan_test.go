package claude

import (
	"encoding/json"
	"testing"

	"twill/internal/domain"
)

// realPlanMarkdown mirrors the markdown the CLI submits with ExitPlanMode.
const realPlanMarkdown = "# Create hello.txt containing \"hi\"\n" +
	"\n## Context\n\nThe user wants a new file.\n\n" +
	"## Steps\n\n1. Use the Write tool to create hello.txt\n2. Verify the file exists.\n\n" +
	"## Verification\n\nRead the file back.\n"

// planControlRequest builds the control_request the CLI emits for a plan.
func planControlRequest(t *testing.T, requestID, markdown string) string {
	t.Helper()
	raw, err := json.Marshal(map[string]interface{}{
		"type":       "control_request",
		"request_id": requestID,
		"request": map[string]interface{}{
			"subtype":                   "can_use_tool",
			"tool_name":                 planToolName,
			"display_name":              planToolName,
			"input":                     map[string]interface{}{"plan": markdown, "planFilePath": "/home/x/.claude/plans/x.md"},
			"tool_use_id":               "0f6ad",
			"requires_user_interaction": true,
		},
	})
	if err != nil {
		t.Fatal(err)
	}
	return string(raw)
}

// TestParsePlanFromRealCLIOutput uses the control_request shape captured from
// `claude --permission-mode plan --permission-prompt-tool=stdio`, so the parser is
// pinned to the wire format the CLI actually produces rather than a guess.
func TestParsePlanFromRealCLIOutput(t *testing.T) {
	line := planControlRequest(t, "11b3d45a-18c2-4658-b38e-5c9353838972", realPlanMarkdown)

	res, err := ParseLine(line)
	if err != nil {
		t.Fatal(err)
	}
	if res.PermissionRequestID != "11b3d45a-18c2-4658-b38e-5c9353838972" {
		t.Fatalf("plan request must be answerable by ID, got %q", res.PermissionRequestID)
	}
	if res.PermissionToolName != planToolName {
		t.Fatalf("got tool %q", res.PermissionToolName)
	}

	var plan domain.PlanPayload
	var waiting bool
	for _, ev := range res.Events {
		switch ev.Type {
		case domain.EventPlan:
			plan = ev.Payload.(domain.PlanPayload)
		case domain.EventStatusChange:
			waiting = ev.Payload.(domain.StatusPayload).Status == domain.StatusWaiting
		}
	}

	if !waiting {
		t.Error("agent should be marked as waiting for the user")
	}
	if plan.Title != `Create hello.txt containing "hi"` {
		t.Errorf("title = %q", plan.Title)
	}
	if len(plan.Steps) != 2 {
		t.Fatalf("want 2 steps from the Steps section, got %d: %+v", len(plan.Steps), plan.Steps)
	}
	if plan.Steps[0].Index != 1 || plan.Steps[1].Index != 2 {
		t.Errorf("steps should be 1-indexed: %+v", plan.Steps)
	}
	if plan.Steps[0].Status != "pending" {
		t.Errorf("steps should start pending: %+v", plan.Steps)
	}
}

// A plan request must render as a plan, never as the generic approval dialog.
func TestPlanRequestDoesNotEmitPermissionRequest(t *testing.T) {
	line := planControlRequest(t, "r1", "# T\n\n1. step")
	res, _ := ParseLine(line)
	for _, ev := range res.Events {
		if ev.Type == domain.EventPermissionRequest {
			t.Fatal("a plan must not raise a generic permission prompt")
		}
	}
}

func TestParsePlanTitleFallback(t *testing.T) {
	t.Run("no heading uses first line", func(t *testing.T) {
		if got := planTitle("Just a sentence.\n\nmore"); got != "Just a sentence." {
			t.Errorf("got %q", got)
		}
	})
	t.Run("empty plan still yields a step", func(t *testing.T) {
		p := parsePlan("id", "")
		if len(p.Steps) != 1 || p.Steps[0].Description == "" {
			t.Errorf("empty plan should degrade to one step: %+v", p)
		}
	})
}

func TestPlanStepsParsing(t *testing.T) {
	t.Run("prefers the Steps section", func(t *testing.T) {
		md := "# T\n\n## Context\n\n- a context bullet\n\n## Steps\n\n1. real step\n2. another\n\n## Notes\n\n- a note\n"
		steps := planSteps(md)
		if len(steps) != 2 {
			t.Fatalf("want the 2 Steps items, got %d: %+v", len(steps), steps)
		}
		if steps[0].Description != "real step" {
			t.Errorf("got %q", steps[0].Description)
		}
	})

	t.Run("falls back to any list when there is no Steps heading", func(t *testing.T) {
		steps := planSteps("# T\n\n- one\n- two\n")
		if len(steps) != 2 {
			t.Fatalf("got %d: %+v", len(steps), steps)
		}
	})

	t.Run("prose-only plan degrades to a single step", func(t *testing.T) {
		steps := planSteps("# T\n\nJust prose, no list.\n")
		if len(steps) != 1 || steps[0].Description != "# T\n\nJust prose, no list." {
			t.Errorf("got %+v", steps)
		}
	})

	t.Run("handles bullets and varied markers", func(t *testing.T) {
		steps := planSteps("## Steps\n\n- dash\n* star\n+ plus\n1) paren\n")
		if len(steps) != 4 {
			t.Errorf("got %d: %+v", len(steps), steps)
		}
	})

	t.Run("ignores empty list items", func(t *testing.T) {
		steps := planSteps("## Steps\n\n1. \n2. real\n")
		if len(steps) != 1 {
			t.Errorf("got %+v", steps)
		}
	})
}

func TestPlanStepsAreTruncatedOnRuneBoundary(t *testing.T) {
	long := ""
	for i := 0; i < 400; i++ {
		long += "é"
	}
	steps := planSteps("## Steps\n\n- " + long)
	if len(steps) != 1 {
		t.Fatalf("got %+v", steps)
	}
	// A byte slice would split a multi-byte rune and produce invalid UTF-8.
	for _, r := range steps[0].Description {
		if r == '�' {
			t.Fatal("truncation split a multi-byte character")
		}
	}
}
