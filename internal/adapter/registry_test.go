package adapter

import (
	"context"
	"testing"
	"time"

	"twill/internal/domain"
)

// fakeAdapter is a minimal AgentAdapter whose event channel the test drives directly.
type fakeAdapter struct {
	id     string
	events chan domain.Event
}

func newFakeAdapter(id string) *fakeAdapter {
	return &fakeAdapter{id: id, events: make(chan domain.Event, 16)}
}

func (f *fakeAdapter) ID() string   { return f.id }
func (f *fakeAdapter) Name() string { return f.id }
func (f *fakeAdapter) Start(context.Context, string, string, string) error {
	return nil
}
func (f *fakeAdapter) Stop() error                                 { return nil }
func (f *fakeAdapter) SendApproval(string, bool, bool) error       { return nil }
func (f *fakeAdapter) SendAnswer(string, string) error             { return nil }
func (f *fakeAdapter) SendPlanDecision(string, bool, string) error { return nil }
func (f *fakeAdapter) SendDiffDecision(string, map[string]bool) error {
	return nil
}
func (f *fakeAdapter) Events() <-chan domain.Event { return f.events }

func receive(t *testing.T, ch <-chan domain.Event) domain.Event {
	t.Helper()
	select {
	case evt := <-ch:
		return evt
	case <-time.After(2 * time.Second):
		t.Fatal("timed out waiting for event")
		return domain.Event{}
	}
}

// TestFanInDeliversFromNonActiveAdapter is the regression for the old polling
// forwarder, which read only registry.Active() and dropped the rest.
func TestFanInDeliversFromNonActiveAdapter(t *testing.T) {
	r := &Registry{adapters: map[string]domain.AgentAdapter{}}
	subs := r.Subscribe()

	a := newFakeAdapter("a")
	b := newFakeAdapter("b")
	r.Register(a)
	r.Register(b)
	r.SetActive("a")

	b.events <- domain.Event{Type: domain.EventMessageChunk, SessionID: "from-b"}

	if got := receive(t, subs).SessionID; got != "from-b" {
		t.Fatalf("want event from the inactive adapter, got %q", got)
	}
}

// TestFanInSurvivesAdapterSwitch ensures a running agent's events are not
// stranded when the user switches adapters mid-task.
func TestFanInSurvivesAdapterSwitch(t *testing.T) {
	r := &Registry{adapters: map[string]domain.AgentAdapter{}}
	subs := r.Subscribe()

	a := newFakeAdapter("a")
	b := newFakeAdapter("b")
	r.Register(a)
	r.Register(b)

	// Event queued before the switch, delivered after it.
	a.events <- domain.Event{Type: domain.EventMessageChunk, SessionID: "before-switch"}
	if err := r.SetActive("b"); err != nil {
		t.Fatal(err)
	}
	a.events <- domain.Event{Type: domain.EventMessageChunk, SessionID: "after-switch"}

	if got := receive(t, subs).SessionID; got != "before-switch" {
		t.Fatalf("queued event lost across switch, got %q", got)
	}
	if got := receive(t, subs).SessionID; got != "after-switch" {
		t.Fatalf("event from previous active adapter lost, got %q", got)
	}
}

func TestFanInReachesEverySubscriber(t *testing.T) {
	r := &Registry{adapters: map[string]domain.AgentAdapter{}}
	first := r.Subscribe()
	second := r.Subscribe()

	a := newFakeAdapter("a")
	r.Register(a)
	a.events <- domain.Event{Type: domain.EventMessageChunk, SessionID: "hello"}

	if got := receive(t, first).SessionID; got != "hello" {
		t.Fatalf("first subscriber got %q", got)
	}
	if got := receive(t, second).SessionID; got != "hello" {
		t.Fatalf("second subscriber got %q", got)
	}
}

// TestFanInDropsRatherThanBlocks keeps a stalled consumer from wedging the
// agent's stdout reader.
func TestFanInDropsRatherThanBlocks(t *testing.T) {
	r := &Registry{adapters: map[string]domain.AgentAdapter{}}
	// Subscribe but never read: publish must not block on this subscriber.
	r.Subscribe()

	a := newFakeAdapter("a")
	r.Register(a)

	done := make(chan struct{})
	go func() {
		for i := 0; i < 1000; i++ {
			a.events <- domain.Event{Type: domain.EventMessageChunk}
		}
		close(done)
	}()

	select {
	case <-done:
	case <-time.After(5 * time.Second):
		t.Fatal("publish blocked on a consumer that stopped reading")
	}
}

func TestSetActiveRejectsUnknownAdapter(t *testing.T) {
	r := NewRegistry(nil)
	if err := r.SetActive("nope"); err == nil {
		t.Fatal("expected an error for an unknown adapter id")
	}
}

func TestRegistryDefaultsToMock(t *testing.T) {
	if got := NewRegistry(nil).Active().ID(); got != "mock" {
		t.Fatalf("default active adapter = %q, want mock", got)
	}
}
