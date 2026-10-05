package claude

import (
	"regexp"
	"strings"

	"twill/internal/domain"
)

// planToolName is the tool Claude Code calls to submit a plan for review.
// Its control request is an ordinary can_use_tool request, so approving or
// rejecting a plan goes through the same response channel as any other tool.
const planToolName = "ExitPlanMode"

// Plan requests must never be auto-approved: reviewing the plan is the whole point.
var listItemRe = regexp.MustCompile(`^\s*(?:\d+[.)]|[-*+])\s+(.*)$`)

var headingRe = regexp.MustCompile(`^\s*(#{1,6})\s+(.*)$`)

// parsePlan builds a PlanPayload from the markdown Claude submits with ExitPlanMode.
//
// The shape observed from the CLI is a markdown document with a leading "# Title",
// then sections such as "## Context", "## Steps" and "## Verification", where the
// steps are an ordered list. Anything unparseable degrades to a single step holding
// the raw text rather than showing nothing.
func parsePlan(planID, markdown string) domain.PlanPayload {
	markdown = strings.TrimSpace(markdown)
	if markdown == "" {
		return domain.PlanPayload{PlanID: planID, Title: "Proposed plan", Steps: []domain.PlanStep{{Index: 0, Description: "No plan details provided", Status: "pending"}}}
	}

	return domain.PlanPayload{
		PlanID: planID,
		Title:  planTitle(markdown),
		Steps:  planSteps(markdown),
	}
}

// planTitle uses the first heading as the title, falling back to the opening line.
func planTitle(markdown string) string {
	for _, line := range strings.Split(markdown, "\n") {
		if m := headingRe.FindStringSubmatch(line); m != nil {
			if title := strings.TrimSpace(m[2]); title != "" {
				return truncate(title, 80)
			}
		}
	}
	for _, line := range strings.Split(markdown, "\n") {
		if text := strings.TrimSpace(line); text != "" {
			return truncate(text, 80)
		}
	}
	return "Proposed plan"
}

// planSteps collects list items, preferring those under a "Steps"-like heading.
// If no such section exists, list items from anywhere in the document are used.
func planSteps(markdown string) []domain.PlanStep {
	var scoped, fallback []domain.PlanStep
	inStepSection := false
	seenHeading := false

	for _, line := range strings.Split(markdown, "\n") {
		if m := headingRe.FindStringSubmatch(line); m != nil {
			seenHeading = true
			// A new heading ends the current section.
			inStepSection = strings.Contains(strings.ToLower(m[2]), "step")
			continue
		}

		m := listItemRe.FindStringSubmatch(line)
		if m == nil {
			continue
		}
		description := strings.TrimSpace(m[1])
		if description == "" {
			continue
		}

		step := domain.PlanStep{Description: truncate(description, 300), Status: "pending"}
		fallback = append(fallback, step)
		if inStepSection || !seenHeading {
			scoped = append(scoped, step)
		}
	}

	steps := scoped
	if len(steps) == 0 {
		steps = fallback
	}
	if len(steps) == 0 {
		// No list to extract; show the plan text itself rather than an empty card.
		steps = []domain.PlanStep{{Description: truncate(strings.TrimSpace(markdown), 300), Status: "pending"}}
	}

	for i := range steps {
		steps[i].Index = i + 1
	}
	return steps
}

func truncate(s string, max int) string {
	if len(s) <= max {
		return s
	}
	// Cut on a rune boundary so multi-byte text is never split mid-character.
	runes := []rune(s)
	if len(runes) <= max {
		return s
	}
	return strings.TrimRight(string(runes[:max]), " ") + "…"
}
