# CLAUDE.md

Guidance for working in this repository.

## What Twill is

A [Wails v2](https://wails.io) desktop app (Go backend + React/TypeScript webview
frontend) that puts a graphical interface in front of the Claude Code CLI.

## Architecture: ports and adapters

Dependencies point inward. `internal/domain` is the center and imports nothing
from the rest of the repo.

```
app.go                     Wails bindings + orchestration
internal/adapter           Registry + agent adapters (claude, mock)
internal/domain            events, sessions, permissions, Agent interface
internal/storage           session persistence
frontend/src               stores + feature components
```

### The rule that matters most

**`internal/domain` must stay pure Go with zero intra-repo imports.** It is the
shared vocabulary between the backend and the agent protocol. The moment it
imports `internal/adapter`, or anything outside stdlib, the layering breaks and
the domain stops being testable in isolation.

If a change seems to require that import, it belongs in `internal/adapter`.

### Other conventions actually followed here

- **Adapters implement `domain.Agent`** and emit `domain.Event` on a channel.
  They never touch the frontend; `app.go` is the only place that bridges to Wails.
- **`internal/adapter.Registry.Subscribe()` is a stable fan-in channel.** Events
  are pumped from every adapter into it, so switching adapters mid-task cannot
  strand a running agent's events. Do not reintroduce polling on
  `registry.Active()`.
- **`emit` on an adapter must never block.** Use `select` with `default`. A
  blocked emit stalls the stdout reader and, behind it, the agent process.
- **Every terminal state emits an event.** Stopping, crashing, or failing a task
  must produce `terminated`/`failed`, or the frontend stays locked forever and
  the composer never re-enables.
- **`Start` cleans up after itself on every failure path.** Use the
  `abortStart` pattern in `claude.go`: leaving `activeTask` set makes the adapter
  reject every future task for the life of the process.
- **Permission grants use `domain.ActionKey`, not request IDs.** Request IDs are
  unique per request, so a grant keyed on one can never match a later request.
- **The frontend's timeline (`useSessionStore.timeline`) is the single source of
  truth** for conversation content. `useAgentStore` holds only what is read
  outside the timeline (status, active adapter, pending approval). Do not mirror
  timeline content into it.

## The Claude Code protocol

Two details are easy to get wrong and were verified empirically against the real
CLI. Re-verify with the CLI before changing them.

1. **Plan approval is a `can_use_tool` control request**, not a chat message.
   When `tool_name` is `ExitPlanMode`, `input.plan` holds the plan markdown. It is
   answered with `control_response` `{"behavior": "allow" | "deny"}` on the same
   request ID. Sending a chat message instead silently does nothing.

2. **Tool names are camelCase** (`Read`, `Edit`, `Bash`, `MultiEdit`,
   `ExitPlanMode`). The frontend's `ActivityCard` matches on these exact names.

`ExitPlanMode` carries `plan` and `planFilePath` — there is **no `explanation`
field**, despite what an earlier draft of the code assumed.

## Verification

Run before calling any change done:

```bash
go vet ./...
go test -race ./...
gofmt -l .

cd frontend
npx tsc --noEmit
npm run test
```

`go test -race` is not optional. The adapter has concurrent readers and writers;
`-race` has caught real bugs that plain `go test` passes.

## Things you cannot verify here

The GUI cannot be launched in this environment. After changing event handling,
approval flow, diffs, or CSS, say explicitly which of these still need a human
eye rather than claiming they work:

- Stopping a task unlocks the composer and shows a terminal status.
- An "always allow" grant auto-answers the next identical request.
- A one-line edit renders as a one-line diff, not a whole-file replacement.
- Agent errors appear as red timeline entries.
- The window background and scrollbars are dark.

## Regenerating bindings

`frontend/wailsjs/` is generated. After changing a method on `App`, run:

```bash
wails generate module
```

Editing those files by hand will be overwritten.
