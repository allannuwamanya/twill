# Twill

> **Same coding CLI agents. Better interface.**

Twill is a lightweight desktop app that gives CLI-based AI coding agents, such as Claude Code, a clean graphical interface. It doesn't replace the agent you already trust. It wraps it, so you get the full power of an agentic coding workflow without living in a terminal.

> *A twill is a woven fabric with a diagonal pattern. Twill weaves your project, your agent, and your approvals into one thread.*

**Status:** Early development. The MVP is in progress and nothing here is stable yet. Expect breaking changes.

---

## Why Twill

CLI coding agents are powerful, but the terminal makes them harder to use well:

- **Hard to follow:** Streaming text, tool calls, and file edits scroll by in one long log.
- **Risky to approve:** Permission prompts are easy to skim past, and diffs are hard to read as plain text.
- **Easy to lose work:** Resuming sessions and switching projects is clunky.
- **Intimidating:** Many developers never adopt agents because of the command-line barrier.

**Twill keeps the agent and upgrades the interface:**

```
Open a project ➔ Describe the task ➔ Review the plan ➔ Watch progress ➔ Approve actions ➔ Review diffs ➔ Accept or iterate
```

---

## Features

### 📁 Projects and Sessions
- Open and switch between local projects.
- Start new sessions and resume previous ones with full history, including the
  agent's own session so it continues with its prior context.

### 💬 Chat
- Real-time streaming responses with markdown and syntax-highlighted code.
- Clear separation of your messages, agent messages, and agent activity.

### ⚡ Live Agent Activity
- Visual cards for each action: reading files, searching, editing, and running commands.
- Status indicators: `thinking`, `working`, `waiting for you`, `done`, `failed`.
- Agent errors surface in the timeline instead of disappearing.

### 🛡️ Approvals and Interaction
- Permission dialogs that show exactly what the agent wants to do, with **Approve**, **Reject**, and **"Always allow this exact action for this project"**. Grants are keyed on a stable action key, so the next identical request is answered without prompting you.
- Plan review before execution, driven by the agent's own `ExitPlanMode` call: approve, reject with feedback, or keep editing.
- Agent questions are rendered as prompts with quick-select answers or free text.

> **Note:** Questions are currently only produced by the mock adapter. The
> Claude Code CLI does not emit a structured question event, so the question UI
> is wired and tested but not yet reachable with the real agent.

### 🔍 Code Review
- Real unified diffs (LCS-based, 3 lines of context) for `Edit`, `Write`, and `MultiEdit`.
- Side-by-side and inline views, with per-file accept or reject.

### ⏯️ Task Control
- Stop at any point; the composer always unlocks.
- Clear recovery when a task is interrupted or fails.

---

## How It Works

Twill runs the agent on your machine and talks to it over the Claude Code CLI's
structured JSON streaming protocol (`--output-format=stream-json`), never by
scraping terminal text. Every message, tool call, and permission request arrives
as typed data, and Twill maps each one to a dedicated UI component:

| Agent Event | Twill UI |
| :--- | :--- |
| **Message** | Chat bubble |
| **Tool call** | Activity card |
| **Permission request** | Approval dialog |
| **Question** | Prompt with quick answers |
| **Plan** (`ExitPlanMode`) | Plan review view |
| **File edit** (`Edit`/`Write`/`MultiEdit`) | Diff view |
| **Error** | Error card |

Permissions and plan approvals are not chat messages. They arrive as
`control_request` frames on the CLI's stdio and are answered with a
`control_response` on the same channel, so the agent stays blocked until you
decide.

A thin adapter layer sits between the agent and the UI, so changes to an agent's event format only need to be fixed in one place.

🔒 **Privacy:** All data and code stay local. Twill does not upload your projects anywhere.

---

## MVP Scope

### In Scope
- Project selection
- AI chat with real-time streaming
- Agent activity display
- Tool and action approvals, with remembered per-project grants
- Agent questions *(mock adapter only — see the note above)*
- Plan approval via `ExitPlanMode`
- Code changes and diff view
- Session history and resume
- Stop and continue

### Not Yet Built
- Basic settings (model selection, default permissions, theme toggle)

### Out of Scope for v1
- Built-in code editor
- Git operations beyond showing diffs
- Multi-agent or parallel sessions
- Plugin marketplace
- Cloud sync and team collaboration

---

## Roadmap

| Phase | Focus |
| :--- | :--- |
| **v1 (MVP)** | Core experience above |
| **v1.5** | Hunk-level diff review, session search, keyboard shortcuts |
| **v2** | Multiple concurrent sessions, git integration, task templates |
| **Later** | Built-in editor, team features, extensions |

---

## Requirements

- **OS:** macOS, Windows, or Linux (platform support to be finalized).
- **CLI Agent:** A supported CLI coding agent installed and authenticated on your machine (Claude Code is the first target).

---

## Installation

Pre-built releases are not available yet. Once they are released, binaries will be provided under [Releases](https://github.com/allannuwamanya/twill/releases).

To run Twill from source, see [Development](#development).

---

## Getting Started

1. Launch Twill.
2. Select a project folder.
3. Start a new session and describe what you want the agent to do.
4. Review the plan, approve actions as they come up, and check the diffs when it finishes.

---

## Development

Twill is a [Wails v2](https://wails.io) app: a Go backend with a React + TypeScript
frontend rendered in the native webview. It is not Tauri or Electron.

### Prerequisites

- Go 1.23+
- Node 18+
- [Wails CLI](https://wails.io/docs/gettingstarted/installation) (`go install github.com/wailsapp/wails/v2/cmd/wails@latest`)
- The [`claude`](https://claude.com/claude-code) CLI, installed and authenticated,
  if you want to use the real agent rather than the mock

### Commands

```bash
git clone https://github.com/allannuwamanya/twill.git
cd twill

wails dev            # run the app with live reload
wails build          # produce a platform binary in build/bin/

cd frontend
npm install
npm run dev          # frontend only, in a browser (no Go backend)
npm run build        # typecheck + production bundle
npm run test         # vitest unit tests
```

After changing Go methods on `App`, regenerate the JS bindings with
`wails generate module` — `frontend/wailsjs/go/` is generated, not hand-written.

### Verifying a change

```bash
go vet ./...
go test -race ./...
cd frontend && npx tsc --noEmit && npm run test
```

### Architecture

Ports-and-adapters (hexagonal). Dependencies point inward:

```
app.go  (Wails bindings, orchestration)
   │
   ├── internal/adapter   ← registry + agent adapters (claude, mock)
   │        implements domain.Agent, emits domain.Event
   │
   ├── internal/domain    ← PURE Go. Zero imports from the rest of the repo.
   │        events, sessions, permissions, adapter interface
   │
   └── internal/storage   ← session persistence
```

`internal/domain` must stay free of intra-repo imports. It is the shared
vocabulary between the Go backend and the agent protocol; the moment it imports
`internal/adapter`, the layering is broken.

See [CLAUDE.md](CLAUDE.md) for the conventions to follow when contributing.

---

## Contributing

Contributions and feedback are welcome! For now, please open an issue to discuss any proposed changes before submitting a pull request.

---

## License

To be decided.
