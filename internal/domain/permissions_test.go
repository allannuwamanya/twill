package domain

import (
	"os"
	"path/filepath"
	"testing"
)

func TestActionKeyIsStableAcrossEquivalentInputs(t *testing.T) {
	// Whitespace differences must not create a different permission.
	a := ActionKey("Bash", map[string]interface{}{"command": "git  status"})
	b := ActionKey("Bash", map[string]interface{}{"command": " git status "})
	if a != b {
		t.Fatalf("whitespace should not change the key: %q vs %q", a, b)
	}

	// Trailing flags are part of the command and must stay distinct.
	if ActionKey("Bash", map[string]interface{}{"command": "rm -rf /tmp/x"}) ==
		ActionKey("Bash", map[string]interface{}{"command": "rm -rf /tmp/y"}) {
		t.Fatal("different commands must not share a key")
	}
}

func TestActionKeyCoversEachToolFamily(t *testing.T) {
	cases := []struct {
		tool, inputKey, inputVal, wantPrefix string
	}{
		{"Bash", "command", "ls -la", "Bash:ls -la"},
		{"Edit", "file_path", "/a/b.go", "Edit:/a/b.go"},
		{"Edit", "file_path", "/a/./b.go", "Edit:/a/b.go"}, // cleaned
		{"Read", "file_path", "/a/b.go", "Read:/a/b.go"},
		{"WebFetch", "url", "https://x.dev", "WebFetch:https://x.dev"},
	}
	for _, c := range cases {
		got := ActionKey(c.tool, map[string]interface{}{c.inputKey: c.inputVal})
		if got != c.wantPrefix {
			t.Errorf("ActionKey(%s) = %q, want %q", c.tool, got, c.wantPrefix)
		}
	}
}

func TestActionKeyFallsBackToToolName(t *testing.T) {
	// Unknown tools, and known tools with unrecognized input, degrade to the
	// bare tool name rather than granting something overly broad.
	if got := ActionKey("Grep", map[string]interface{}{"pattern": "x"}); got != "Grep" {
		t.Errorf("got %q, want Grep", got)
	}
	if got := ActionKey("Edit", map[string]interface{}{"wrong_key": "x"}); got != "Edit" {
		t.Errorf("got %q, want Edit", got)
	}
}

func TestPermissionFilesDoNotCollide(t *testing.T) {
	s, err := NewPermissionStore(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}

	// These reduce to the same string under naive slash replacement.
	if s.fileName(`/a/b`) == s.fileName(`/a\b`) {
		t.Fatal("distinct project paths must not share a permission file")
	}
}

func TestAllowActionRoundTripAndIsolation(t *testing.T) {
	dir := t.TempDir()
	a, _ := NewPermissionStore(dir)
	b, _ := NewPermissionStore(dir)

	if err := a.AllowAction("/proj/one", "Bash:ls"); err != nil {
		t.Fatal(err)
	}

	if !a.IsActionAllowed("/proj/one", "Bash:ls") {
		t.Fatal("grant should be readable")
	}
	if a.IsActionAllowed("/proj/one", "Bash:rm") {
		t.Fatal("unrelated action must not be granted")
	}
	// A different project must not inherit the grant.
	if b.IsActionAllowed("/proj/two", "Bash:ls") {
		t.Fatal("grant leaked across projects")
	}
	if got := a.GetAllowedActions("/proj/one"); len(got) != 1 || got[0] != "Bash:ls" {
		t.Fatalf("unexpected allowed actions: %v", got)
	}
}

func TestPermissionStorageIsPrivate(t *testing.T) {
	base := filepath.Join(t.TempDir(), "permissions")
	s, err := NewPermissionStore(base)
	if err != nil {
		t.Fatal(err)
	}
	projectDir := filepath.Join(base, "project")
	if err := s.AllowAction(projectDir, "Bash:ls"); err != nil {
		t.Fatal(err)
	}

	dirInfo, err := os.Stat(base)
	if err != nil {
		t.Fatal(err)
	}
	if dirInfo.Mode().Perm() != 0o700 {
		t.Fatalf("permission directory mode = %o, want 700", dirInfo.Mode().Perm())
	}

	entries, err := os.ReadDir(base)
	if err != nil || len(entries) != 1 {
		t.Fatalf("permission files = %d (%v), want one", len(entries), err)
	}
	fileInfo, err := entries[0].Info()
	if err != nil {
		t.Fatal(err)
	}
	if fileInfo.Mode().Perm() != 0o600 {
		t.Fatalf("permission file mode = %o, want 600", fileInfo.Mode().Perm())
	}
}

func TestPermissionFileStaysInsideStoreDir(t *testing.T) {
	base := t.TempDir()
	s, err := NewPermissionStore(base)
	if err != nil {
		t.Fatal(err)
	}
	name := s.fileName("../../escape")
	if filepath.Dir(name) != base {
		t.Fatalf("permission file escaped the store dir: %s", name)
	}
}
