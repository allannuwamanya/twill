package jsonstore

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"

	"twill/internal/domain"
)

// FileStore implements domain.SessionRepository using local JSON files.
type FileStore struct {
	mu      sync.RWMutex
	baseDir string
}

// NewFileStore initializes local JSON storage in ~/.twill/sessions/ or custom directory.
func NewFileStore(customDir ...string) (*FileStore, error) {
	var dir string
	if len(customDir) > 0 && customDir[0] != "" {
		dir = customDir[0]
	} else {
		home, err := os.UserHomeDir()
		if err != nil {
			return nil, err
		}
		dir = filepath.Join(home, ".twill", "sessions")
	}

	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create session directory: %w", err)
	}

	return &FileStore{baseDir: dir}, nil
}

func (s *FileStore) filePath(id string) string {
	return filepath.Join(s.baseDir, fmt.Sprintf("%s.json", id))
}

func (s *FileStore) Save(session *domain.Session) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	data, err := json.MarshalIndent(session, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(s.filePath(session.ID), data, 0644)
}

func (s *FileStore) Get(id string) (*domain.Session, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	data, err := os.ReadFile(s.filePath(id))
	if err != nil {
		return nil, err
	}

	var session domain.Session
	if err := json.Unmarshal(data, &session); err != nil {
		return nil, err
	}

	return &session, nil
}

func (s *FileStore) List(projectDir string) ([]*domain.Session, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	entries, err := os.ReadDir(s.baseDir)
	if err != nil {
		return nil, err
	}

	var results []*domain.Session
	for _, entry := range entries {
		if filepath.Ext(entry.Name()) != ".json" {
			continue
		}

		data, err := os.ReadFile(filepath.Join(s.baseDir, entry.Name()))
		if err != nil {
			continue
		}

		var session domain.Session
		if err := json.Unmarshal(data, &session); err == nil {
			if projectDir == "" || session.ProjectDir == projectDir {
				results = append(results, &session)
			}
		}
	}

	return results, nil
}

func (s *FileStore) Delete(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	return os.Remove(s.filePath(id))
}
