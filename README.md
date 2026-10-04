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
- Start new sessions and resume previous ones with full history.

### 💬 Chat
- Real-time streaming responses with markdown and syntax-highlighted code.
- Clear separation of your messages, agent messages, and agent activity.

### ⚡ Live Agent Activity
- Visual cards for each action: reading files, searching, editing, and running commands.
- Status indicators: `thinking`, `working`, `waiting for you`, `done`, `failed`.
- See which files are being read, created, or modified as it happens.

### 🛡️ Approvals and Interaction
- Permission dialogs that show exactly what the agent wants to do, with **Approve**, **Reject**, and **"Always allow for this project"**.
- Agent questions presented as clear prompts with quick-select answers or free text.
- Plan review before execution: approve, edit, or reject.

### 🔍 Code Review
- Side-by-side and inline diffs for every change.
- Per-file summaries, with accept or reject at the file level.

### ⏯️ Task Control
- Stop, pause, and continue at any point.
- Clear recovery when a task is interrupted or fails.

---

## How It Works

Twill runs the agent on your machine and talks to it through its SDK or structured (JSON) streaming output, never by scraping terminal text. Every message, tool call, and permission request arrives as typed data, and Twill maps each one to a dedicated UI component:

| Agent Event | Twill UI |
| :--- | :--- |
| **Message** | Chat bubble |
| **Tool call** | Activity card |
| **Permission request** | Approval dialog |
| **Question** | Prompt with quick answers |
| **Plan** | Plan review view |
| **File edit** | Diff view |

A thin adapter layer sits between the agent and the UI, so changes to an agent's event format only need to be fixed in one place.

🔒 **Privacy:** All data and code stay local. Twill does not upload your projects anywhere.

---

## MVP Scope

### In Scope
- Project selection
- AI chat with real-time streaming
- Agent activity display
- Tool and action approvals
- Agent questions
- Plan approval
- Code changes and diff view
- Session history and resume
- Stop and continue
- Basic settings (model, default permissions, theme)

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

Setup details will be finalized once the stack is initialized. Twill is planned as a cross-platform desktop shell (Tauri or Electron) with a web-based UI.

```bash
# Clone the repository
git clone https://github.com/allannuwamanya/twill.git
cd twill

# Install dependencies and start the app in dev mode
# (commands will be updated once initialized)
```

---

## Contributing

Contributions and feedback are welcome! For now, please open an issue to discuss any proposed changes before submitting a pull request.

---

## License

To be decided.
