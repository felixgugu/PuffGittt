# PuffGittt

<p align="center">
  <img src="appicon.png" width="160" alt="PuffGittt" />
</p>

PuffGittt is a Windows-first Git workspace built with **Go + Wails v2**, **React 19**, **TypeScript**, **Vite**, **Fluent UI v9** and **Monaco Editor**. The interface is primarily Traditional Chinese; English is used for Git terminology and tooltips.

The product brief lives in [git-workspace-development-spec.md](git-workspace-development-spec.md).

## Run

Requirements:

- Windows 11
- WebView2 Runtime
- Go 1.25+
- Node.js 22+
- Git for Windows
- Wails CLI v2.17+

```powershell
# Install frontend dependencies
cd frontend
npm install
cd ..

# Desktop development
wails dev

# Browser-only UI development (uses the built-in demo bridge)
cd frontend
npm run dev
# http://127.0.0.1:34115

# Production build
wails build
# build/bin/puffgittt.exe
```

## Implemented in this build

- Multi-repository tabs with a Welcome experience: open, clone, init, recent repositories.
- Changes workspace: directory filter tree, commit composer and untracked tree in a
  resizable left column with a full-height Monaco diff; stage/unstage, discard,
  amend, inline/split diff.
- History: branch filter, commit search, virtualized commit list, SVG lane graph,
  commit details, changed files and commit diff.
- Branches: local and remote lists, create, switch, delete, merge.
- Sync: fetch, pull, push, with branch ahead/behind status.
- Conflicts: conflict list, three-way content, editable result, mark resolved,
  continue/abort for in-progress operations.
- Stashes: list, create, apply, pop, drop.
- Settings: theme, language, base font size and family, projects folder,
  Git executable path, commit identity, and About/environment versions.
- Frameless window with an integrated title bar; collapsible sidebar with a
  projects/recent repository list pinned at the bottom.
- Traditional Chinese / English UI, warm light/dark theme tokens and scalable typography.
- Windows application icon generated from `appicon.png`.

## Not implemented yet

See [docs/implementation-status.md](docs/implementation-status.md) for the detailed gap list.
Highlights:

- Partial hunk/line staging and hunk-level unstage (only whole-file staging is wired in the UI).
- Discard backups/undo, encoding/CRLF special handling, submodule-aware discard.
- Filesystem watcher; current refresh is manual or 10-second status polling.
- Background task queue, progress events, cancellation and operation locks beyond the in-process mutex.
- Interactive rebase, cherry-pick, revert, blame, file history, image diff, worktrees, submodules and LFS.
- Terminal/ConPTY, tags UI, remote configuration UI, force-with-lease push flow, SSH host-key UI.
- Draft persistence, backup retention, high-contrast theme and full keyboard navigation.
- Installer/packaging, code signing, updater and diagnostics export.

## Project layout

```text
main.go / app.go          Wails entrypoint and native theme hook
wails.json                Wails application configuration
appicon.png               Source brand icon
build/                    Windows icon and Wails resources
internal/api/             Wails-bound facades
internal/git/             git.exe runner and parsers
internal/model/           Shared JSON models
internal/config/          Settings, recent repositories and app paths
internal/platform/        Explorer and external URL integration
frontend/src/             React application
frontend/wailsjs/         Generated Wails bindings (ignored)
```

## Tests

```powershell
go test ./...
go vet ./...
cd frontend
npm run build
```
