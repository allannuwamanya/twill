package main

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"

	"twill/internal/adapter"
	"twill/internal/domain"
	"twill/internal/storage/jsonstore"
	"twill/internal/sys"
)

// App coordinates Wails frontend events with Go backend domain services.
type App struct {
	ctx         context.Context
	registry    *adapter.Registry
	store       domain.SessionRepository
	permissions *domain.PermissionStore
	projectDir  string
	// agentSessions maps Twill session ID -> underlying agent session ID (for resume).
	agentSessions map[string]string
	mu            sync.RWMutex
}

// NewApp creates a new App application struct.
func NewApp() *App {
	sys.EnsurePathHasNode()

	reg := adapter.NewRegistry()
	store, _ := jsonstore.NewFileStore()
	permStore, _ := domain.NewPermissionStore()

	return &App{
		registry:      reg,
		store:         store,
		permissions:   permStore,
		agentSessions: map[string]string{},
	}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods.
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx

	// Start background forwarder for all adapter events
	go a.listenToAdapterEvents()
}

// listenToAdapterEvents forwards events from the active adapter to the Wails frontend event bus.
func (a *App) listenToAdapterEvents() {
	for {
		active := a.registry.Active()
		if active == nil {
			time.Sleep(100 * time.Millisecond)
			continue
		}

		select {
		case evt, ok := <-active.Events():
			if !ok {
				time.Sleep(100 * time.Millisecond)
				continue
			}
			if sp, ok := evt.Payload.(domain.StatusPayload); ok && sp.AgentSessionID != "" {
				a.mu.Lock()
				a.agentSessions[evt.SessionID] = sp.AgentSessionID
				a.mu.Unlock()
			}
			if a.ctx != nil {
				runtime.EventsEmit(a.ctx, "agent:event", evt)
			}
		case <-time.After(50 * time.Millisecond):
		}
	}
}

// SelectProjectDirectory opens a native OS dialog to select a folder.
func (a *App) SelectProjectDirectory() (string, error) {
	selectedDir, err := runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Select Project Directory",
	})
	if err != nil {
		return "", err
	}
	if selectedDir != "" {
		a.mu.Lock()
		a.projectDir = selectedDir
		a.mu.Unlock()
	}
	return selectedDir, nil
}

// GetProjectDirectory returns the currently selected project folder.
func (a *App) GetProjectDirectory() string {
	a.mu.RLock()
	defer a.mu.RUnlock()
	return a.projectDir
}

// SetProjectDirectory manually sets the active project folder.
func (a *App) SetProjectDirectory(dir string) {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.projectDir = dir
}

// StartTask dispatches a task to the active agent adapter.
func (a *App) StartTask(sessionID string, prompt string) error {
	a.mu.RLock()
	dir := a.projectDir
	a.mu.RUnlock()

	if dir == "" {
		return fmt.Errorf("no project directory selected")
	}

	active := a.registry.Active()
	if active == nil {
		return fmt.Errorf("no active agent adapter configured")
	}

	a.mu.RLock()
	agentID := a.agentSessions[sessionID]
	a.mu.RUnlock()
	if r, ok := active.(resumable); ok {
		r.SetResumeID(agentID)
	}

	return active.Start(a.ctx, sessionID, dir, prompt)
}

// StopTask cancels the current running agent task.
func (a *App) StopTask() error {
	active := a.registry.Active()
	if active == nil {
		return nil
	}
	return active.Stop()
}

// SendApproval submits a user approval decision.
func (a *App) SendApproval(requestID string, approved bool, alwaysAllow bool) error {
	active := a.registry.Active()
	if active == nil {
		return fmt.Errorf("no active agent adapter")
	}

	if alwaysAllow && a.permissions != nil {
		a.mu.RLock()
		dir := a.projectDir
		a.mu.RUnlock()
		if dir != "" {
			_ = a.permissions.AllowAction(dir, requestID)
		}
	}

	return active.SendApproval(requestID, approved, alwaysAllow)
}

// SendAnswer submits a user response to an agent question.
func (a *App) SendAnswer(questionID string, answer string) error {
	active := a.registry.Active()
	if active == nil {
		return fmt.Errorf("no active agent adapter")
	}
	return active.SendAnswer(questionID, answer)
}

// SendPlanDecision submits a user review decision on an agent's plan.
func (a *App) SendPlanDecision(planID string, approved bool, feedback string) error {
	active := a.registry.Active()
	if active == nil {
		return fmt.Errorf("no active agent adapter")
	}
	return active.SendPlanDecision(planID, approved, feedback)
}

// SendDiffDecision submits per-file acceptance/rejection decisions on code diffs.
func (a *App) SendDiffDecision(diffID string, decisions map[string]bool) error {
	active := a.registry.Active()
	if active == nil {
		return fmt.Errorf("no active agent adapter")
	}
	return active.SendDiffDecision(diffID, decisions)
}

// GetAllowedActions returns remembered allowed permissions for the given project.
func (a *App) GetAllowedActions(projectDir string) []string {
	if a.permissions == nil {
		return nil
	}
	return a.permissions.GetAllowedActions(projectDir)
}

// ListAdapters returns all available adapters.
func (a *App) ListAdapters() []map[string]string {
	return a.registry.List()
}

// SetActiveAdapter switches the active adapter (e.g. "mock" vs "claude").
func (a *App) SetActiveAdapter(id string) error {
	return a.registry.SetActive(id)
}

// GetActiveAdapter returns the current active adapter ID.
func (a *App) GetActiveAdapter() string {
	return a.registry.Active().ID()
}

// resumable is implemented by adapters that can continue a prior agent session.
type resumable interface {
	SetResumeID(id string)
}

// SaveSession persists the UI timeline for a session plus the agent's own session ID.
func (a *App) SaveSession(id string, title string, messageCount int, timelineJSON string) error {
	if a.store == nil {
		return fmt.Errorf("session storage unavailable")
	}
	if id == "" {
		return fmt.Errorf("session id is required")
	}

	a.mu.RLock()
	dir := a.projectDir
	agentID := a.agentSessions[id]
	a.mu.RUnlock()

	now := time.Now()
	sess, err := a.store.Get(id)
	if err != nil {
		sess = &domain.Session{ID: id, CreatedAt: now}
	}
	sess.ProjectDir = dir
	if title != "" {
		sess.Title = title
	}
	sess.UpdatedAt = now
	sess.Timeline = timelineJSON
	if agentID != "" {
		sess.AgentSessionID = agentID
	}
	if active := a.registry.Active(); active != nil {
		sess.AdapterID = active.ID()
	}
	// Messages is kept as a lightweight count placeholder for summaries.
	sess.Messages = make([]domain.Message, messageCount)
	return a.store.Save(sess)
}

// ListSessions returns saved sessions for the current project (all projects if none selected), newest first.
func (a *App) ListSessions() ([]domain.SessionSummary, error) {
	if a.store == nil {
		return nil, nil
	}
	a.mu.RLock()
	dir := a.projectDir
	a.mu.RUnlock()

	sessions, err := a.store.List(dir)
	if err != nil {
		return nil, err
	}
	out := make([]domain.SessionSummary, 0, len(sessions))
	for _, s := range sessions {
		out = append(out, s.Summary())
	}
	return out, nil
}

// LoadSession returns a saved session, switches the active project to it and
// primes the agent adapter to resume its prior context.
func (a *App) LoadSession(id string) (*domain.Session, error) {
	if a.store == nil {
		return nil, fmt.Errorf("session storage unavailable")
	}
	sess, err := a.store.Get(id)
	if err != nil {
		return nil, err
	}
	a.mu.Lock()
	if sess.ProjectDir != "" {
		a.projectDir = sess.ProjectDir
	}
	if sess.AgentSessionID != "" {
		a.agentSessions[id] = sess.AgentSessionID
	}
	a.mu.Unlock()
	return sess, nil
}

// DeleteSession removes a saved session from disk.
func (a *App) DeleteSession(id string) error {
	if a.store == nil {
		return fmt.Errorf("session storage unavailable")
	}
	a.mu.Lock()
	delete(a.agentSessions, id)
	a.mu.Unlock()
	return a.store.Delete(id)
}
