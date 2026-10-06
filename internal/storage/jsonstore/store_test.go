package jsonstore

import (
	"os"
	"testing"
	"time"

	"twill/internal/domain"
)

func newStore(t *testing.T) *FileStore {
	t.Helper()
	s, err := NewFileStore(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	return s
}

func TestSaveGetRoundTrip(t *testing.T) {
	s := newStore(t)
	in := &domain.Session{
		ID: "sess_1", ProjectDir: "/p", Title: "Hello", UpdatedAt: time.Now(),
		Timeline: `[{"id":"a"}]`, AgentSessionID: "claude-123",
	}
	if err := s.Save(in); err != nil {
		t.Fatal(err)
	}
	out, err := s.Get("sess_1")
	if err != nil {
		t.Fatal(err)
	}
	if out.Timeline != in.Timeline || out.AgentSessionID != "claude-123" || out.Title != "Hello" {
		t.Fatalf("round trip mismatch: %+v", out)
	}
}

func TestListFiltersAndSortsNewestFirst(t *testing.T) {
	s := newStore(t)
	now := time.Now()
	_ = s.Save(&domain.Session{ID: "old", ProjectDir: "/a", UpdatedAt: now.Add(-time.Hour)})
	_ = s.Save(&domain.Session{ID: "new", ProjectDir: "/a", UpdatedAt: now})
	_ = s.Save(&domain.Session{ID: "other", ProjectDir: "/b", UpdatedAt: now})

	got, err := s.List("/a")
	if err != nil || len(got) != 2 {
		t.Fatalf("want 2 sessions, got %d (%v)", len(got), err)
	}
	if got[0].ID != "new" || got[1].ID != "old" {
		t.Fatalf("wrong order: %s, %s", got[0].ID, got[1].ID)
	}
	all, _ := s.List("")
	if len(all) != 3 {
		t.Fatalf("want 3 across projects, got %d", len(all))
	}
}

func TestDeleteAndMissing(t *testing.T) {
	s := newStore(t)
	_ = s.Save(&domain.Session{ID: "x"})
	if err := s.Delete("x"); err != nil {
		t.Fatal(err)
	}
	if _, err := s.Get("x"); err == nil {
		t.Fatal("expected error for deleted session")
	}
}

func TestSaveRequiresIDAndBlocksTraversal(t *testing.T) {
	s := newStore(t)
	if err := s.Save(&domain.Session{}); err == nil {
		t.Fatal("expected error for empty id")
	}
	if err := s.Save(&domain.Session{ID: "../../evil"}); err != nil {
		t.Fatal(err)
	}
	if _, err := s.Get("evil"); err != nil {
		t.Fatalf("traversal id should be confined to store dir: %v", err)
	}
}

func TestSessionStorageIsPrivate(t *testing.T) {
	base := t.TempDir()
	s, err := NewFileStore(base + "/sessions")
	if err != nil {
		t.Fatal(err)
	}
	if err := s.Save(&domain.Session{ID: "private"}); err != nil {
		t.Fatal(err)
	}

	dirInfo, err := os.Stat(s.baseDir)
	if err != nil {
		t.Fatal(err)
	}
	if dirInfo.Mode().Perm() != 0o700 {
		t.Fatalf("session directory mode = %o, want 700", dirInfo.Mode().Perm())
	}
	fileInfo, err := os.Stat(s.filePath("private"))
	if err != nil {
		t.Fatal(err)
	}
	if fileInfo.Mode().Perm() != 0o600 {
		t.Fatalf("session file mode = %o, want 600", fileInfo.Mode().Perm())
	}
}
