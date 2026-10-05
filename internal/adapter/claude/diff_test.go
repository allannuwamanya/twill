package claude

import (
	"strings"
	"testing"
)

func lines(s string) []string { return strings.Split(strings.TrimSuffix(s, "\n"), "\n") }

func TestUnifiedDiffShowsOnlyChangedLines(t *testing.T) {
	// This is the case the old implementation got wrong: a one-line change in a
	// large file must not render as a full-file replacement.
	var oldLines []string
	for i := 1; i <= 40; i++ {
		oldLines = append(oldLines, "line "+string(rune('a'+i%26))+" "+itoa(i))
	}
	newLines := append([]string{}, oldLines...)
	newLines[19] = "CHANGED"

	got := unifiedDiff("f.go", strings.Join(oldLines, "\n"), strings.Join(newLines, "\n"))

	deletes := countPrefix(t, got, "-")
	adds := countPrefix(t, got, "+")

	if deletes != 1 || adds != 1 {
		t.Fatalf("want 1 deletion and 1 addition, got %d and %d\n%s", deletes, adds, got)
	}
	if strings.Contains(got, "-line a 21") {
		t.Error("an unchanged line was rendered as removed")
	}
}

func TestUnifiedDiffHunkHeaders(t *testing.T) {
	got := unifiedDiff("f.go", "a\nb\nc", "a\nB\nc")
	// Change on line 2 of 3, with one line of context each side.
	if !strings.Contains(got, "@@ -1,3 +1,3 @@") {
		t.Fatalf("unexpected hunk header in:\n%s", got)
	}
	if !strings.HasPrefix(got, "--- a/f.go\n+++ b/f.go\n") {
		t.Fatalf("missing file headers in:\n%s", got)
	}
}

func TestUnifiedDiffSeparatesDistantChanges(t *testing.T) {
	oldText := strings.Join([]string{"1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15", "16", "17", "18", "19", "20"}, "\n")
	newText := strings.Replace(oldText, "2", "two", 1)
	newText = strings.Replace(newText, "19", "nineteen", 1)

	got := unifiedDiff("f.go", oldText, newText)
	if n := strings.Count(got, "@@"); n != 2 {
		t.Fatalf("distant changes should form 2 hunks, got %d:\n%s", n, got)
	}
}

func TestUnifiedDiffEdgeCases(t *testing.T) {
	t.Run("identical produces no hunk", func(t *testing.T) {
		if got := unifiedDiff("f", "a\nb", "a\nb"); strings.Contains(got, "@@") {
			t.Fatalf("identical text should produce no hunk:\n%s", got)
		}
	})
	t.Run("empty to content is all additions", func(t *testing.T) {
		got := unifiedDiff("f", "", "a\nb")
		if countPrefix(t, got, "+") != 2 || countPrefix(t, got, "-") != 0 {
			t.Fatalf("unexpected diff:\n%s", got)
		}
	})
	t.Run("content to empty is all deletions", func(t *testing.T) {
		got := unifiedDiff("f", "a\nb", "")
		if countPrefix(t, got, "-") != 2 || countPrefix(t, got, "+") != 0 {
			t.Fatalf("unexpected diff:\n%s", got)
		}
	})
	t.Run("trailing newline is not a change", func(t *testing.T) {
		if got := unifiedDiff("f", "a\nb\n", "a\nb"); strings.Contains(got, "@@") {
			t.Fatalf("trailing newline should not register as a change:\n%s", got)
		}
	})
	t.Run("reordering", func(t *testing.T) {
		got := unifiedDiff("f", "a\nb\nc", "c\nb\na")
		if countPrefix(t, got, "+")+countPrefix(t, got, "-") == 0 {
			t.Fatalf("reordering should produce changes:\n%s", got)
		}
	})
}

func TestBuildEditDiffsHandlesEachTool(t *testing.T) {
	t.Run("Edit", func(t *testing.T) {
		diffs := buildEditDiffs(contentBlock{Name: "Edit", ID: "t1", Input: map[string]interface{}{
			"file_path": "a.go", "old_string": "x", "new_string": "y\nz",
		}})
		if len(diffs) != 1 || diffs[0].Files[0].Additions != 2 || diffs[0].Files[0].Deletions != 1 {
			t.Fatalf("unexpected diffs: %+v", diffs)
		}
	})

	t.Run("Write", func(t *testing.T) {
		diffs := buildEditDiffs(contentBlock{Name: "Write", ID: "t2", Input: map[string]interface{}{
			"file_path": "new.txt", "content": "hello\nworld",
		}})
		if len(diffs) != 1 {
			t.Fatalf("Write produced no diff: %+v", diffs)
		}
		f := diffs[0].Files[0]
		if f.Status != "added" || f.Additions != 2 {
			t.Fatalf("unexpected file diff: %+v", f)
		}
	})

	t.Run("MultiEdit applies edits in sequence", func(t *testing.T) {
		diffs := buildEditDiffs(contentBlock{Name: "MultiEdit", ID: "t3", Input: map[string]interface{}{
			"file_path": "m.go",
			"original":  "alpha\nbeta\ngamma",
			"edits": []interface{}{
				map[string]interface{}{"old_string": "beta", "new_string": "BETA"},
				map[string]interface{}{"old_string": "gamma", "new_string": "GAMMA"},
			},
		}})
		if len(diffs) != 1 {
			t.Fatalf("MultiEdit produced no diff: %+v", diffs)
		}
		f := diffs[0].Files[0]
		if f.Additions != 2 || f.Deletions != 2 {
			t.Fatalf("want 2/2, got +%d -%d\n%s", f.Additions, f.Deletions, f.DiffText)
		}
	})

	t.Run("no-op edit produces no diff", func(t *testing.T) {
		if diffs := buildEditDiffs(contentBlock{Name: "Edit", ID: "t4", Input: map[string]interface{}{
			"file_path": "a.go", "old_string": "same", "new_string": "same",
		}}); len(diffs) != 0 {
			t.Fatalf("identical strings should produce no diff: %+v", diffs)
		}
	})

	t.Run("non-editing tool produces no diff", func(t *testing.T) {
		if diffs := buildEditDiffs(contentBlock{Name: "Read", ID: "t5", Input: map[string]interface{}{
			"file_path": "a.go",
		}}); len(diffs) != 0 {
			t.Fatalf("Read should not produce a diff: %+v", diffs)
		}
	})
}

func TestApplyEditsSkipsMissingAnchors(t *testing.T) {
	got := applyEdits("keep me", []map[string]interface{}{
		{"old_string": "not present", "new_string": "x"},
		{"old_string": "keep", "new_string": "kept"},
	})
	if got != "kept me" {
		t.Fatalf("got %q", got)
	}
}

func TestLargeEditFallsBackWithoutHanging(t *testing.T) {
	var oldLines, newLines []string
	for i := 0; i < maxDiffLines+10; i++ {
		oldLines = append(oldLines, "old "+itoa(i))
		newLines = append(newLines, "new "+itoa(i))
	}
	got := unifiedDiff("big.txt", strings.Join(oldLines, "\n"), strings.Join(newLines, "\n"))
	if !strings.Contains(got, "@@ -1,") {
		t.Fatalf("expected a whole-file hunk, got:\n%s", got[:200])
	}
}

// helpers

// countPrefix counts changed lines, ignoring the "---"/"+++" file headers.
func countPrefix(t *testing.T, diff, prefix string) int {
	t.Helper()
	n := 0
	for _, l := range lines(diff) {
		if strings.HasPrefix(l, "---") || strings.HasPrefix(l, "+++") {
			continue
		}
		if strings.HasPrefix(l, prefix) {
			n++
		}
	}
	return n
}

func itoa(i int) string {
	if i == 0 {
		return "0"
	}
	var b []byte
	for i > 0 {
		b = append([]byte{byte('0' + i%10)}, b...)
		i /= 10
	}
	return string(b)
}
