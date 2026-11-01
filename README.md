# PuffGittt

<p align="center">
  <img src="appicon.png" width="160" alt="PuffGittt" />
</p>

PuffGittt is a Windows-first Git workspace built with **Go + Wails v2**, **React 19**, **TypeScript**, **Vite**, **Fluent UI v9** and **Monaco Editor**. The interface is primarily Traditional Chinese; English is used for Git terminology and tooltips.

The product brief lives in [git-workspace-development-spec.md](git-workspace-development-spec.md)..

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
- Remembers the last active repository and view between launches.
- Changes workspace: directory filter tree, flat/tree modes, tabs for tracked and
  untracked files, checkbox-driven stage/unstage/discard, hunk and line-level
  stage/unstage with patch-hash validation, commit composer and a full-height
  Monaco diff; also a shared maximized diff dialog with previous/next file
  navigation.
- Repository change watcher: fsnotify watches `.git` and worktree directories,
  debounces events, confirms with a status fingerprint and emits `repo:changed`;
  polling fallback covers missed events and large trees.
- File History and Blame dialog from the Changes diff toolbar, with per-file
  commit history and line-by-line blame.
- Image diff for common raster formats and SVG, with side-by-side old/new previews.
- Commit message drafts are persisted per repository in local storage.
- History: branch/all-branches filter, commit search by message / author / SHA
  prefix / path, virtualized commit list, SVG lane graph,
  resizable commit details/changed files, tree/flat changed-file modes, commit diff
  dialog, create branch/tag, copy OID, reset, revert, drop commit, cherry-pick
  (including merge mainline selection), interactive rebase (reorder / reword /
  edit / squash / fixup / drop / skip) and bisect, all through
  a right-click context menu or History toolbar with Git command previews.
- Persisted multi-step Undo history with tracked worktree backups for destructive
  history operations.
- Branches: local and remote lists, create, switch, merge, rebase, rename, delete,
  set upstream, publish, checkout remote branch, delete remote branch and branch
  comparison with inline file diff through right-click context menus, with
  merge/rebase direction labels and Git command confirmation dialogs.
- Remote management: add remotes, edit fetch/push URLs and remove remotes.
- Remote authentication: HTTPS Personal Access Token entry (validated and stored
  through the system credential helper), credential removal, SSH host-key scanning
  with fingerprints and `known_hosts` trust, plus SSH key / agent status.
- Worktrees: list, add (optionally creating a branch), remove and prune.
- Submodules: list, update one/all and sync URLs.
- Sync: fetch, pull, push, force-with-lease push, with Git command previews and
  branch ahead/behind status.
- Long-running operations use a per-repository task queue; the status bar shows
  Git progress and offers cancellation for supported operations.
- Conflicts: conflict list, three-way content, editable result, one-click ours/theirs/both,
  mark resolved, continue / skip / abort for in-progress operations.
- Stashes: list, create, apply, pop, drop, diff preview.
- Tags: local/remote tag lists, create lightweight/annotated/signed tags, delete
  local and remote tags, push a tag and push all tags.
- Settings: theme, language, base font size and family, projects folder,
  Git executable path, commit identity, Git LFS status / track / pull / push, and
  About/environment versions.
- Frameless window with an integrated title bar; collapsible/resizable sidebar with
  a resizable merged project list; repositories can be added or removed without
  deleting files.
- Traditional Chinese / English UI, warm light/dark theme tokens and scalable typography.
- Windows application icon generated from `appicon.png`.

## Not implemented yet

See [docs/implementation-status.md](docs/implementation-status.md) for the detailed gap list,
[docs/roadmap.md](docs/roadmap.md) for the SmartGit / SourceTree benchmark and priorities,
and [docs/feature-report-2026-11-01.md](docs/feature-report-2026-11-01.md) for the
current feature inventory and recommendations.

Highlights:

- SSH host-key UI and credential prompts.
- Terminal/ConPTY, Git Flow, provider integrations and custom actions.
- High-contrast theme.
- Backup retention and backup browser, diagnostics export, installer, code signing and updater.

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
