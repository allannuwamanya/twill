package adapter

import (
	"fmt"
	"sync"

	"twill/internal/adapter/claude"
	"twill/internal/domain"
)

// Registry manages available agent adapters and fans their events out to subscribers.
type Registry struct {
	mu       sync.RWMutex
	adapters map[string]domain.AgentAdapter
	active   string
	subs     []chan domain.Event
}

// NewRegistry initializes an adapter registry with the Claude Code CLI adapter.
func NewRegistry(permissions *domain.PermissionStore) *Registry {
	r := &Registry{
		adapters: make(map[string]domain.AgentAdapter),
	}

	claudeAdapter := claude.NewClaudeAdapter(permissions)
	r.Register(claudeAdapter)
	r.active = claudeAdapter.ID()

	return r
}

// Register adds an adapter and starts pumping its events into the fan-in.
func (r *Registry) Register(a domain.AgentAdapter) {
	r.mu.Lock()
	r.adapters[a.ID()] = a
	r.mu.Unlock()

	go func() {
		// Adapter event channels are never closed; this goroutine lives as long as the registry.
		for evt := range a.Events() {
			r.publish(evt)
		}
	}()
}

// Subscribe returns a channel receiving events from every registered adapter.
// Subscribers receive events from all adapters, not just the active one, so that
// switching adapters mid-task cannot strand a running agent's events.
func (r *Registry) Subscribe() <-chan domain.Event {
	r.mu.Lock()
	defer r.mu.Unlock()

	ch := make(chan domain.Event, 256)
	r.subs = append(r.subs, ch)
	return ch
}

// publish fans an event out to all subscribers, skipping any that are not keeping up.
// Blocking here would stall the adapter's stdout reader and ultimately the agent process.
func (r *Registry) publish(evt domain.Event) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	for _, ch := range r.subs {
		select {
		case ch <- evt:
		default:
		}
	}
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
