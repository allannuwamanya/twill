package adapter

import (
	"fmt"
	"sync"

	"twill/internal/adapter/claude"
	"twill/internal/adapter/mock"
	"twill/internal/domain"
)

// Registry manages available agent adapters.
type Registry struct {
	mu       sync.RWMutex
	adapters map[string]domain.AgentAdapter
	active   string
}

// NewRegistry initializes an adapter registry with default mock and claude adapters.
func NewRegistry() *Registry {
	r := &Registry{
		adapters: make(map[string]domain.AgentAdapter),
	}

	mockAdapter := mock.NewMockAdapter()
	claudeAdapter := claude.NewClaudeAdapter()

	r.Register(mockAdapter)
	r.Register(claudeAdapter)

	// Default to mock for offline / safety, can switch to claude
	r.active = mockAdapter.ID()

	return r
}

func (r *Registry) Register(a domain.AgentAdapter) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.adapters[a.ID()] = a
}

func (r *Registry) SetActive(id string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if _, exists := r.adapters[id]; !exists {
		return fmt.Errorf("adapter with id %s not found", id)
	}
	r.active = id
	return nil
}

func (r *Registry) Active() domain.AgentAdapter {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.adapters[r.active]
}

func (r *Registry) List() []map[string]string {
	r.mu.RLock()
	defer r.mu.RUnlock()

	var list []map[string]string
	for id, a := range r.adapters {
		list = append(list, map[string]string{
			"id":     id,
			"name":   a.Name(),
			"active": fmt.Sprintf("%t", id == r.active),
		})
	}
	return list
}
