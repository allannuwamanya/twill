package domain

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sync"
)

// ProjectPermissions tracks allowed actions for a specific project directory.
type ProjectPermissions struct {
	ProjectDir    string          `json:"projectDir"`
	AllowedActions map[string]bool `json:"allowedActions"`
}

// PermissionStore manages persistence of per-project allowed permissions.
type PermissionStore struct {
	mu      sync.RWMutex
	baseDir string
}

// NewPermissionStore initializes a permission store in ~/.twill/permissions/.
func NewPermissionStore(customDir ...string) (*PermissionStore, error) {
	var dir string
	if len(customDir) > 0 && customDir[0] != "" {
		dir = customDir[0]
	} else {
		home, err := os.UserHomeDir()
		if err != nil {
			return nil, err
		}
		dir = filepath.Join(home, ".twill", "permissions")
	}

	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, err
	}

	return &PermissionStore{baseDir: dir}, nil
}

func (s *PermissionStore) fileName(projectDir string) string {
	clean := filepath.Clean(projectDir)
	// Replace slashes with underscores for a safe filename
	safeName := ""
	for _, r := range clean {
		if r == '/' || r == '\\' || r == ':' {
			safeName += "_"
		} else {
			safeName += string(r)
		}
	}
	return filepath.Join(s.baseDir, safeName+".json")
}

// IsActionAllowed checks if an action has been marked as "always allow" for the project.
func (s *PermissionStore) IsActionAllowed(projectDir string, action string) bool {
	s.mu.RLock()
	defer s.mu.RUnlock()

	data, err := os.ReadFile(s.fileName(projectDir))
	if err != nil {
		return false
	}

	var perm ProjectPermissions
	if err := json.Unmarshal(data, &perm); err != nil {
		return false
	}

	return perm.AllowedActions[action]
}

// AllowAction records an action as always allowed for the project.
func (s *PermissionStore) AllowAction(projectDir string, action string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	path := s.fileName(projectDir)
	perm := ProjectPermissions{
		ProjectDir:    projectDir,
		AllowedActions: make(map[string]bool),
	}

	if data, err := os.ReadFile(path); err == nil {
		_ = json.Unmarshal(data, &perm)
		if perm.AllowedActions == nil {
			perm.AllowedActions = make(map[string]bool)
		}
	}

	perm.AllowedActions[action] = true

	data, err := json.MarshalIndent(perm, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(path, data, 0644)
}

// GetAllowedActions returns the list of allowed actions for a project.
func (s *PermissionStore) GetAllowedActions(projectDir string) []string {
	s.mu.RLock()
	defer s.mu.RUnlock()

	data, err := os.ReadFile(s.fileName(projectDir))
	if err != nil {
		return nil
	}

	var perm ProjectPermissions
	if err := json.Unmarshal(data, &perm); err != nil {
		return nil
	}

	var list []string
	for act, allowed := range perm.AllowedActions {
		if allowed {
			list = append(list, act)
		}
	}
	return list
}
