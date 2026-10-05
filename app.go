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
	// permissionKeys maps a permission request ID -> the stable action key the
	// user would be granting, so a grant outlives the one-shot request ID.
	permissionKeys map[string]string
	mu             sync.RWMutex
}

// NewApp creates a new App application struct.
func NewApp() *App {
	sys.EnsurePathHasNode()

	permStore, _ := domain.NewPermissionStore()
	reg := adapter.NewRegistry(permStore)
	store, _ := jsonstore.NewFileStore()

	return &App{
		registry:       reg,
		store:          store,
		permissions:    permStore,
		agentSessions:  map[string]string{},
		permissionKeys: map[string]string{},
	}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods.
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx

	// Subscribe once; the registry fans in events from every adapter, so
	// switching adapters mid-task cannot strand a running agent's events.
	go a.forwardEvents(a.registry.Subscribe())
}

// forwardEvents relays adapter events to the Wails frontend event bus.
func (a *App) forwardEvents(events <-chan domain.Event) {
	for evt := range events {
		a.trackEvent(evt)
		if a.ctx != nil {
			runtime.EventsEmit(a.ctx, "agent:event", evt)
		}
	}
}

// trackEvent records the bits of an event that the frontend cannot send back later.
func (a *App) trackEvent(evt domain.Event) {
	a.mu.Lock()
	defer a.mu.Unlock()

	if sp, ok := evt.Payload.(domain.StatusPayload); ok && sp.AgentSessionID != "" {
		a.agentSessions[evt.SessionID] = sp.AgentSessionID
	}
	if pr, ok := evt.Payload.(domain.PermissionRequestPayload); ok {
		a.permissionKeys[pr.RequestID] = domain.ActionKey(pr.Action, pr.Details)
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
		a.mu.Lock()
		dir := a.projectDir
		key := a.permissionKeys[requestID]
		delete(a.permissionKeys, requestID)
		a.mu.Unlock()

		// An unknown key means we never saw the originating request, so there is
		// nothing safe to grant a blanket permission for.
		if dir != "" && key != "" {
			_ = a.permissions.AllowAction(dir, key)
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

// IsActionAllowed reports whether the user previously chose "always allow" for
// the action behind a pending permission request. The frontend cannot compute
// this itself: the action key is derived from the tool input, not the request ID.
func (a *App) IsActionAllowed(requestID string) bool {
	if a.permissions == nil {
		return false
	}
	a.mu.RLock()
	dir := a.projectDir
	key := a.permissionKeys[requestID]
	a.mu.RUnlock()

	if dir == "" || key == "" {
		return false
	}
	return a.permissions.IsActionAllowed(dir, key)
}

// ListAdapters returns all available adapters.
func (a *App) ListAdapters() []map[string]string {
	return a.registry.List()
}

// SetActiveAdapter switches the active adapter.
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
	// The messages themselves live in Timeline; only the count is kept separately
	// so the history sidebar can render a summary without parsing the timeline.
	sess.MessageCount = messageCount
	return a.store.Save(sess)
}

// ListSessions returns all saved sessions across projects, newest first.
func (a *App) ListSessions() ([]domain.SessionSummary, error) {
	if a.store == nil {
		return nil, nil
	}
	sessions, err := a.store.List("")
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

// WindowMinimise minimizes the application window.
func (a *App) WindowMinimise() {
	if a.ctx != nil {
		runtime.WindowMinimise(a.ctx)
	}
}

// WindowToggleMaximise toggles maximize/unmaximize on the application window.
func (a *App) WindowToggleMaximise() {
	if a.ctx != nil {
		runtime.WindowToggleMaximise(a.ctx)
	}
}

// WindowQuit terminates the application.
func (a *App) WindowQuit() {
	if a.ctx != nil {
		runtime.Quit(a.ctx)
	}
}

