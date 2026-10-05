package claude

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"twill/internal/domain"
)

// diffContextLines is how many unchanged lines surround each change in a hunk.
const diffContextLines = 3

// maxDiffLines bounds the LCS table. Beyond this the edit is almost always a
// whole-file rewrite, where a full replacement is both cheaper and just as useful.
const maxDiffLines = 20000

// buildFileDiff renders a real unified diff between two file versions.
//
// The previous implementation emitted the entire old and new contents as one
// replacement hunk, which made a single-line edit render as if every line changed.
func buildFileDiff(id, path, status, oldText, newText string) (domain.FileDiff, bool) {
	if path == "" {
		return domain.FileDiff{}, false
	}

	additions, deletions := countChanges(oldText, newText)
	if oldText == newText {
		return domain.FileDiff{}, false
	}

	return domain.FileDiff{
		FilePath:  path,
		OldPath:   path,
		NewPath:   path,
		Status:    status,
		Additions: additions,
		Deletions: deletions,
		DiffText:  unifiedDiff(path, oldText, newText),
	}, true
}

// splitLinesForDiff normalizes text into diffable lines. A trailing newline does
// not produce a spurious empty final line.
func splitLinesForDiff(s string) []string {
	if s == "" {
		return nil
	}
	s = strings.TrimSuffix(s, "\n")
	if s == "" {
		return nil
	}
	return strings.Split(s, "\n")
}

// unifiedDiff produces git-style unified diff text with 3 lines of context.
func unifiedDiff(path, oldText, newText string) string {
	oldLines := splitLinesForDiff(oldText)
	newLines := splitLinesForDiff(newText)

	if len(oldLines) > maxDiffLines || len(newLines) > maxDiffLines {
		return wholeFileDiff(path, oldLines, newLines)
	}

	ops := diffOps(oldLines, newLines)

	var sb strings.Builder
	fmt.Fprintf(&sb, "--- a/%s\n", path)
	fmt.Fprintf(&sb, "+++ b/%s\n", path)
	writeHunks(&sb, ops, oldLines, newLines)
	return sb.String()
}

// op is one edit-script instruction: how many lines to copy, delete, or insert.
type op struct {
	kind   byte // 'e' equal, 'd' delete, 'i' insert
	oldLen int
	newLen int
}

// diffOps computes a line-level edit script via longest common subsequence.
func diffOps(a, b []string) []op {
	// lcs[i][j] = length of the LCS of a[i:] and b[j:]
	lcs := make([][]int, len(a)+1)
	for i := range lcs {
		lcs[i] = make([]int, len(b)+1)
	}
	for i := len(a) - 1; i >= 0; i-- {
		for j := len(b) - 1; j >= 0; j-- {
			if a[i] == b[j] {
				lcs[i][j] = lcs[i+1][j+1] + 1
			} else if lcs[i+1][j] >= lcs[i][j+1] {
				lcs[i][j] = lcs[i+1][j]
			} else {
				lcs[i][j] = lcs[i][j+1]
			}
		}
	}

	var ops []op
	add := func(kind byte, oldLen, newLen int) {
		if oldLen == 0 && newLen == 0 {
			return
		}
		// Merge with the previous op when it is the same kind.
		if n := len(ops); n > 0 && ops[n-1].kind == kind {
			ops[n-1].oldLen += oldLen
			ops[n-1].newLen += newLen
			return
		}
		ops = append(ops, op{kind: kind, oldLen: oldLen, newLen: newLen})
	}

	i, j := 0, 0
	for i < len(a) && j < len(b) {
		switch {
		case a[i] == b[j]:
			add('e', 1, 1)
			i++
			j++
		case lcs[i+1][j] >= lcs[i][j+1]:
			add('d', 1, 0)
			i++
		default:
			add('i', 0, 1)
			j++
		}
	}
	add('d', len(a)-i, 0)
	add('i', 0, len(b)-j)
	return ops
}

// writeHunks renders the edit script as unified-diff hunks, merging changes that
// are close together and omitting runs of unchanged lines beyond the context window.
func writeHunks(sb *strings.Builder, ops []op, oldLines, newLines []string) {
	// Walk the script, tracking the source position of each op.
	type positioned struct {
		op       op
		oldStart int
		newStart int
	}
	var positionedOps []positioned
	oldPos, newPos := 0, 0
	for _, o := range ops {
		positionedOps = append(positionedOps, positioned{op: o, oldStart: oldPos, newStart: newPos})
		oldPos += o.oldLen
		newPos += o.newLen
	}

	// Group changes (deletes/inserts) with their surrounding context.
	type group struct {
		from, to int // op indices, inclusive
	}
	var groups []group
	for idx, p := range positionedOps {
		if p.op.kind == 'e' {
			continue
		}
		if len(groups) == 0 || idx-groups[len(groups)-1].to > 2*diffContextLines {
			groups = append(groups, group{from: idx, to: idx})
		} else {
			groups[len(groups)-1].to = idx
		}
	}

	for _, g := range groups {
		from := max(0, g.from-diffContextLines)
		to := min(len(positionedOps)-1, g.to+diffContextLines)

		oldCount, newCount := 0, 0
		for idx := from; idx <= to; idx++ {
			oldCount += positionedOps[idx].op.oldLen
			newCount += positionedOps[idx].op.newLen
		}

		oldLineNo := positionedOps[from].oldStart + 1
		newLineNo := positionedOps[from].newStart + 1
		fmt.Fprintf(sb, "@@ -%d,%d +%d,%d @@\n", oldLineNo, oldCount, newLineNo, newCount)

		oldIdx, newIdx := positionedOps[from].oldStart, positionedOps[from].newStart
		for idx := from; idx <= to; idx++ {
			o := positionedOps[idx].op
			switch o.kind {
			case 'e':
				for k := 0; k < o.oldLen; k++ {
					sb.WriteString(" " + oldLines[oldIdx+k] + "\n")
				}
			case 'd':
				for k := 0; k < o.oldLen; k++ {
					sb.WriteString("-" + oldLines[oldIdx+k] + "\n")
				}
			case 'i':
				for k := 0; k < o.newLen; k++ {
					sb.WriteString("+" + newLines[newIdx+k] + "\n")
				}
			}
			oldIdx += o.oldLen
			newIdx += o.newLen
		}
	}
}

// wholeFileDiff is the fallback for very large inputs: one replacement hunk.
func wholeFileDiff(path string, oldLines, newLines []string) string {
	var sb strings.Builder
	fmt.Fprintf(&sb, "--- a/%s\n+++ b/%s\n", path, path)
	fmt.Fprintf(&sb, "@@ -1,%d +1,%d @@\n", len(oldLines), len(newLines))
	for _, l := range oldLines {
		sb.WriteString("-" + l + "\n")
	}
	for _, l := range newLines {
		sb.WriteString("+" + l + "\n")
	}
	return sb.String()
}

// countChanges reports how many lines were added and removed.
func countChanges(oldText, newText string) (additions, deletions int) {
	for _, o := range diffOps(splitLinesForDiff(oldText), splitLinesForDiff(newText)) {
		switch o.kind {
		case 'i':
			additions += o.newLen
		case 'd':
			deletions += o.oldLen
		}
	}
	return additions, deletions
}

// applyEdits performs the old_string -> new_string replacements of a MultiEdit
// call in sequence, returning the resulting text. Edits whose anchor text is not
// found are skipped rather than aborting the whole batch.
func applyEdits(content string, edits []map[string]interface{}) string {
	for _, edit := range edits {
		oldStr, _ := edit["old_string"].(string)
		newStr, _ := edit["new_string"].(string)
		if oldStr == "" {
			continue
		}
		content = strings.Replace(content, oldStr, newStr, 1)
	}
	return content
}

// buildEditDiffs turns one tool call into diff payloads it should produce.
// MultiEdit is treated as one edit of the file's final content rather than one
// diff per individual replacement.
func buildEditDiffs(b contentBlock, projectDir ...string) []*domain.DiffPayload {
	path, _ := b.Input["file_path"].(string)

	switch b.Name {
	case "Edit":
		oldStr, _ := b.Input["old_string"].(string)
		newStr, _ := b.Input["new_string"].(string)
		if diff, ok := buildFileDiff(b.ID, path, "modified", oldStr, newStr); ok {
			return []*domain.DiffPayload{{DiffID: b.ID, Files: []domain.FileDiff{diff}}}
		}

	case "Write":
		newStr, _ := b.Input["content"].(string)
		status := "added"
		oldStr := ""
		diskPath := path
		var dir string
		if len(projectDir) > 0 {
			dir = projectDir[0]
		}
		if dir != "" && !filepath.IsAbs(diskPath) {
			diskPath = filepath.Join(dir, diskPath)
		}
		if diskPath != "" {
			if data, err := os.ReadFile(diskPath); err == nil {
				status = "modified"
				oldStr = string(data)
			}
		}
		if diff, ok := buildFileDiff(b.ID, path, status, oldStr, newStr); ok {
			return []*domain.DiffPayload{{DiffID: b.ID, Files: []domain.FileDiff{diff}}}
		}

	case "MultiEdit":
		edits, _ := b.Input["edits"].([]interface{})
		if len(edits) == 0 {
			return nil
		}
		batch := make([]map[string]interface{}, 0, len(edits))
		for _, raw := range edits {
			if edit, ok := raw.(map[string]interface{}); ok {
				batch = append(batch, edit)
			}
		}
		original, _ := b.Input["original"].(string)
		final := applyEdits(original, batch)
		if diff, ok := buildFileDiff(b.ID, path, "modified", original, final); ok {
			return []*domain.DiffPayload{{DiffID: b.ID, Files: []domain.FileDiff{diff}}}
		}
	}

	return nil
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
