<div align="center">

# 🧠 Open Brain

**The Neural OS for AI-First Development**

Open Brain is a local-first desktop application that acts as a centralized control plane for AI-driven development workflows. It unifies sessions from multiple AI agents (Cursor, Windsurf, Claude Code, Aider), manages knowledge items, orchestrates local LLM inference, and monitors your entire infrastructure — all from a single cyberpunk-inspired interface.

**100% OFF-GRID & SECURE**: Your data never leaves your machine. The Vault algorithm stores all data entirely on your local disk, API credentials are mathematically encrypted, and AI inference is processed completely offline via Ollama. Zero telemetry, zero cloud tracking, unhackable local execution.

[![Version](https://img.shields.io/badge/v1.3.0-stable-00e5ff?style=for-the-badge&logo=electron&logoColor=white)](https://github.com/KrilinZ/open-brain/releases)
[![macOS](https://img.shields.io/badge/macOS-ARM64-000000?style=for-the-badge&logo=apple&logoColor=white)](#installation)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![Ollama](https://img.shields.io/badge/Ollama-Llama_3.2-white?style=for-the-badge&logo=meta&logoColor=black)](https://ollama.com/)
[![License](https://img.shields.io/badge/MIT-green?style=for-the-badge)](#license)

</div>

---

## Why Open Brain?

Modern development involves multiple AI assistants operating in complete isolation. Cursor doesn't know what Windsurf did. Claude Code has no memory of your last Aider session. Architectural decisions get lost. Context fragments across tools.

**Open Brain solves this** by creating a unified vault (`~/.openbrain/`) where every AI session, every decision, and every knowledge artifact is automatically indexed, searchable, and available to a local AI that understands your entire project history.

---

## Core Modules

| Module | What It Does |
| :--- | :--- |
| **🤖 Neural Terminal** | Chat with Llama 3.2 locally — your AI understands your full runtime context (sessions, APIs, and servers) without ever exposing a single byte to the internet. It can navigate the app, scan for zombies, and run autonomous agents securely. |
| **📡 Knowledge Base** | Automatic indexing of architectural decisions into structured Knowledge Items. Search, create, delete, and encode sessions into persistent memory. |
| **⚡ Prompt Vault** | Repository of reusable prompts with tagging, search, and one-click injection into the Neural Terminal. |
| **🔗 IDE Sync (UNION)** | Generates `.cursorrules`, `.windsurfrules`, and `CLAUDE.md` directives so every AI assistant syncs context back to Open Brain. |
| **🖥️ Server Monitor** | SSH-based real-time monitoring of remote servers: RAM, Disk, Docker containers, PM2/Caddy/Nginx, with visual gauges. |
| **🔑 API Manager** | Centralized secure vault to effortlessly store **any** API key and instantly retrieve it anytime for whatever project you need. Features real-time balance tracking for supported endpoints. |
| **🛠️ Maintenance** | 8 system procedures: backup, clean resolved files, verify integrity, sync context, browser cache, nuclear cache, clean modules, kill zombie processes. |
| **🎯 Auto Mode** | One-click autonomous operation — syncs all projects and knowledge items on a 5-minute interval. |

---

## Architecture

```
┌───────────────────────────────────────────────────────────────┐
│                     OPEN BRAIN v1.3.0                         │
├───────────┬────────────┬─────────────┬───────────────────────┤
│  Neural   │  Prompts   │  Knowledge  │   Servers / APIs      │
│  Terminal │  Vault     │  Base       │   Monitor              │
├───────────┴────────────┴─────────────┴───────────────────────┤
│                    Electron IPC Layer                          │
│               (30+ handlers, preload bridge)                  │
├───────────┬──────────────────────────┬───────────────────────┤
│  Ollama   │    Local Filesystem      │    SSH / HTTP          │
│ :11434    │    ~/.openbrain/         │   (Remote Server)      │
│  Llama    │    brain/ knowledge/     │    RAM, Docker, PM2    │
│  3.2 1B   │    prompts.json          │    Caddy, Nginx        │
└───────────┴──────────────────────────┴───────────────────────┘
```

---

## Installation

### macOS (Apple Silicon)

1. Download **`Open Brain-1.3.0-arm64.dmg`** from [Releases](https://github.com/KrilinZ/open-brain/releases)
2. Drag **Open Brain** into Applications
3. First launch requires clearing the quarantine flag:
   ```bash
   xattr -cr "/Applications/Open Brain.app"
   ```
4. On first launch, the app guides you through Ollama setup if not installed
5. All data is stored locally in `~/.openbrain/`

### From Source

```bash
git clone https://github.com/KrilinZ/open-brain.git
cd open-brain
npm install

# Development (hot reload)
npm run app:dev

# Production build (generates DMG in release/)
npm run app:build
```

---

## Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Runtime** | Electron v33 (ESM native) |
| **UI** | React 19 + TypeScript + Tailwind CSS v4 |
| **Animations** | Framer Motion 12 |
| **Components** | Radix UI (Tabs, ScrollArea, Select, Progress) |
| **Icons** | Lucide React |
| **AI Backend** | Ollama → Llama 3.2 1B (local, no cloud) |
| **Build** | Vite 8 + electron-builder → DMG arm64 |

---

## Vault Structure

```
~/.openbrain/
├── brain/                    # AI session artifacts
│   └── <session-id>/
│       ├── walkthrough.md
│       ├── implementation_plan.md
│       └── task.md
├── knowledge/                # Knowledge Items
│   └── <ki-id>/
│       ├── metadata.json
│       └── artifacts/context.md
├── conversations/            # Binary session data (.pb)
├── chat-logs/                # Neural Terminal history
├── servers.json              # Server configurations
├── apis.json                 # API credentials & balances
├── prompts.json              # Prompt repository
├── projects.json             # Git radar tracked projects
├── settings.json             # Global settings
└── openbrain-debug.log       # Debug output
```

---

## CLI Tools

```bash
# Knowledge Item CLI
npm run ki              # List, get, create KIs from terminal

# MCP Server (for Claude Desktop / VS Code integration)
npm run ki:mcp          # Exposes KIs via Model Context Protocol
```

---

## Changelog

### v1.3.0 — Native KI Auto-Extractor & System Optimization
- Integrated KI background extraction Daemon directly inside the app's Node process.
- Hooked the KI extractor logic to the global `AUTO: ON` HUD widget with persisting config state.
- Extracted Knowledge rules into an enforced Antigravity `ki-management` workflow.
- Cleaned up obsolete imports failing the strict TS compilation build.
- Purged messy debug logic from React component lifecycles.
- Fixed severe React rendering crash in `TabConocimiento` caused by missing metadata string mapping.

### v1.2.3 — Production Render Stability Fix
- Fixed critical `TabPrompts` crash by enforcing strict Optional Chaining on JSON data filtering
- Resolved fatal `layoutId` projection crash in Framer Motion affecting Vite production builds

### v1.2.2 — Stability & Bug Fixes
- Fixed critical `isQuitting` flag preventing app reopen from Dock after Cmd+Q
- Fixed `scrollIntoView` in Neural Terminal hijacking page scroll position
- Fixed `setIsSaving(true)` bug in Prompt Vault that permanently blocked the UI
- Fixed `refreshAll` declared after `runAutoSync` causing ReferenceError on mount
- Added null guards for `syncApis`, `api.saldo`, and maintenance action returns
- Fixed `o.path` → `o.ruta` in Vault file locator
- Replaced impure `Math.random()` in render with deterministic index hash
- Added Auto Mode: one-click autonomous knowledge sync on 5-minute interval
- Added cyberpunk HUD decorations, logo pulse animation, and CRT scanline
- Intensified neon glow aesthetics (4-layer box-shadow system)

### v1.1.0 — Knowledge & Maintenance
- Centralized Knowledge Base with automatic session indexing
- Server monitoring with SSH health checks and alerts
- API credential management with balance tracking
- Advanced process management and cache cleanup tools

### v1.0.0 — Initial Release
- Core session management and artifact viewer
- Prompt vault with tagging system
- Local Ollama integration for offline AI inference
- IDE directive generation (`.cursorrules`, `.windsurfrules`)

---

## License

MIT — see [LICENSE](LICENSE) for details.

<div align="center">

Developed by [KrilinZ](https://github.com/KrilinZ)

*Your brain, your data, your machine.*

</div>
