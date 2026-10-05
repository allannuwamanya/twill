package domain

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"sync"
)

// ActionKey derives a stable identity for a tool invocation.
//
// Permission grants must outlive the individual request that created them, so they
// cannot be keyed on request IDs (unique per request) or raw arguments (which vary
// in whitespace). Callers use this both when granting and when checking.
func ActionKey(toolName string, input map[string]interface{}) string {
	switch toolName {
	case "Bash":
		if cmd, ok := input["command"].(string); ok {
			return "Bash:" + strings.Join(strings.Fields(cmd), " ")
		}
	case "WebFetch":
		if url, ok := input["url"].(string); ok {
			return "WebFetch:" + url
		}
	case "Read", "Write", "Edit", "MultiEdit", "NotebookEdit":
		if path, ok := input["file_path"].(string); ok {
			return toolName + ":" + filepath.Clean(path)
		}
	}
	return toolName
}

// ProjectPermissions tracks allowed actions for a specific project directory.
type ProjectPermissions struct {
	ProjectDir     string          `json:"projectDir"`
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

// fileName maps a project directory to a filename. Sanitizing alone is not enough:
// "/a/b" and "/a\b" both reduce to "_a_b", so two projects would share one file.
// The sanitized path is kept as a readable prefix and a hash of the full path
// disambiguates.
func (s *PermissionStore) fileName(projectDir string) string {
	clean := filepath.Clean(projectDir)

	var safe strings.Builder
	for _, r := range clean {
		switch {
		case r >= 'a' && r <= 'z', r >= 'A' && r <= 'Z', r >= '0' && r <= '9',
			r == '-', r == '_', r == '.':
			safe.WriteRune(r)
		default:
			safe.WriteRune('_')
		}
	}

	prefix := safe.String()
	if len(prefix) > 40 {
		prefix = prefix[:40]
	}
	if prefix == "" {
		prefix = "project"
	}

	sum := sha256.Sum256([]byte(clean))
	return filepath.Join(s.baseDir, prefix+"-"+hex.EncodeToString(sum[:])[:12]+".json")
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
		ProjectDir:     projectDir,
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
