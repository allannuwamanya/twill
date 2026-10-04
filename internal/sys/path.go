package sys

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

// FindExecutable searches for an executable binary in system PATH as well as
// common user directories (NVM, ~/.local/bin, /usr/local/bin, etc.).
func FindExecutable(name string) (string, error) {
	// First try standard LookPath
	if path, err := exec.LookPath(name); err == nil {
		return path, nil
	}

	homeDir, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}

	// Search common paths on Unix/Linux
	candidates := []string{
		filepath.Join(homeDir, ".local", "bin", name),
		filepath.Join("/usr", "local", "bin", name),
		filepath.Join("/opt", "homebrew", "bin", name),
	}

	// Search NVM node versions if applicable
	nvmDir := filepath.Join(homeDir, ".nvm", "versions", "node")
	if entries, err := os.ReadDir(nvmDir); err == nil {
		for _, entry := range entries {
			if entry.IsDir() {
				candidates = append(candidates, filepath.Join(nvmDir, entry.Name(), "bin", name))
			}
		}
	}

	for _, candidate := range candidates {
		if info, err := os.Stat(candidate); err == nil && !info.IsDir() {
			return candidate, nil
		}
	}

	return "", exec.ErrNotFound
}

// EnsurePathHasNode ensures that common Node/npm binary paths are included in the process PATH.
func EnsurePathHasNode() {
	currentPath := os.Getenv("PATH")
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return
	}

	var extraPaths []string
	nvmDir := filepath.Join(homeDir, ".nvm", "versions", "node")
	if entries, err := os.ReadDir(nvmDir); err == nil {
		for _, entry := range entries {
			if entry.IsDir() {
				binPath := filepath.Join(nvmDir, entry.Name(), "bin")
				if !strings.Contains(currentPath, binPath) {
					extraPaths = append(extraPaths, binPath)
				}
			}
		}
	}

	localBin := filepath.Join(homeDir, ".local", "bin")
	if !strings.Contains(currentPath, localBin) {
		extraPaths = append(extraPaths, localBin)
	}

	if len(extraPaths) > 0 {
		newPath := strings.Join(extraPaths, string(os.PathListSeparator)) + string(os.PathListSeparator) + currentPath
		os.Setenv("PATH", newPath)
	}
}
