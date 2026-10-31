# Implementation status

This file tracks the gap between the current PuffGittt build and
`git-workspace-development-spec.md`.

## Completed

### Shell and platform
- Go + Wails v2 desktop shell, embedded Vite build.
- React 19 + TypeScript + Fluent UI v9 application shell.
- Frameless window with an integrated title bar: repository tabs, open folder,
  Settings, Minimize, Maximize/Restore and Close, plus drag and double-click
  maximize.
- Warm PuffJoplin-inspired design tokens for light/dark mode, shared font scale
  (`--base-font-size`, 12–20 px) and consistent icon/control metrics.
- Collapsible, resizable sidebar (240 px expanded / 72 px collapsed) with
  persisted state.
- Sidebar workspace list built from the projects folder and recently opened
  repositories, deduplicated and enriched with branch and change counts.
- Windows icon generated from `appicon.png`; brand art removed from main screens.
- Multi-repository tabs and singleton process-level settings.
- Traditional Chinese default locale and English locale switch.
- Welcome view with open, clone and init flows.
- Settings dialog for theme, language, base font size, font family, projects
  folder, Git path and commit identity; About block includes Git/Go/Wails
  versions.

### Repository and changes
- Repository validation through `git rev-parse`.
- Status parsing via `git status --porcelain=v2 -z --branch`.
- Staged, unstaged, untracked and conflicted file classification.
- Changes screen with a resizable layout: directory-tree file list, commit
  composer and untracked tree on the left; a full-height diff on the right.
- Directory trees with expand/collapse, staged/unstaged filter, per-file status
  badges, inline stage/unstage actions and persisted expansion state.
- Whole-file stage/unstage.
- Discard tracked/untracked paths (without backup/undo).
- Monaco diff with inline/split toggle.
- Binary detection and 2 MiB preview cap.
- Commit composer with subject, description, amend and per-commit identity override.
- Commit message passed through stdin to `git commit -F -`.
- In-process per-repository write lock.

### History
- `git log --topo-order` with bounded 200-commit pages.
- Branch filter, all-branches mode and commit message search.
- Virtualized commit list.
- SVG lane graph computed from commit parents.
- Commit details, changed files and commit diff via Monaco.

### Branches and sync
- Local/remote branch listing with current/upstream/merged metadata.
- Create, switch, delete, merge and rebase APIs.
- Create/switch/delete/merge wired in the UI.
- Fetch, pull (merge/rebase/ff-only strategy API) and push.
- Ahead/behind status.

### Conflicts and stashes
- Unmerged index detection via `git ls-files -u -z`.
- Three-way content from index stages 1/2/3.
- Editable result, save result and mark resolved.
- Continue/abort for merge, rebase, cherry-pick and revert.
- Stash list, create, apply, pop, drop.

### Backend API
- AppAPI, RepoAPI, ChangeAPI, CommitAPI, HistoryAPI, BranchAPI, SyncAPI,
  ConflictAPI, StashAPI and TagAPI Wails bindings.
- Git operation errors are surfaced to the UI.
- Settings persisted atomically as JSON under `%APPDATA%\PuffGittt`.
- Recent repository list persisted and capped.

## Partial / simplified

- **Diff representation**: old/new file text is loaded and displayed in Monaco;
  structured hunk models and unified patch coordinates are not exposed.
- **Discard**: no backup, confirmation token or restore entry yet.
- **Merge/rebase**: basic Git commands only; no strategy planner, expected-head
  validation or detailed conflict-aware recovery UI.
- **Branch comparison**: no `base...compare` commit/file comparison screen.
- **Commit graph**: functional lane algorithm but not the full frontier/cross-page
  snapshot implementation described in the spec.
- **Search**: commit subject search only; author/SHA/path search not complete.
- **Tags**: backend list/create/delete APIs exist; no tags screen.
- **Remotes**: list API exists; no remote add/edit/delete UI.
- **Settings identity**: used for commits via `git -c`, not written to repo config.
- **Refresh**: manual plus 10-second status polling; no fsnotify watcher.
- **Concurrency**: in-process mutex only; no cross-process/global task runner.
- **Large-file safety**: 2 MiB text cap and binary detection only; no encoding,
  CRLF, filter or special-file fallback UI.
- **Accessibility**: keyboard shortcuts for open/settings/views only; no complete
  focus model or screen-reader pass.
- **Mock bridge**: browser-only Vite development uses demo data; the Wails build
  uses real Go bindings.
- **Workspace repository list**: scans one level below the configured projects
  folder plus recent entries; no recursive scan, pinning, drag-and-drop or
  per-repository context menu yet.
- **Tabs and window state**: open tabs are session-only and window size/position
  is not restored between launches.
- **Shell keyboard model**: shortcuts cover open, settings and the first three
  views; title-bar and repository-list focus navigation is not complete.
- **Settings drafts**: theme, language and font-size changes preview live; cancel
  does not roll the preview back until the next launch.

## Not started

- Partial hunk and line staging/unstaging.
- Interactive rebase editor and todo manipulation.
- Cherry-pick, revert, blame and per-file history screens.
- Image diff (before/after, slider, checkerboard).
- Worktrees, submodules and Git LFS.
- Embedded terminal / ConPTY.
- Remote repository management UI and force-with-lease push flow.
- SSH host-key verification UI and credential prompts.
- Draft persistence and commit/form restoration.
- Backup retention and restore UI.
- High-contrast theme.
- Background task queue with progress events, cancellation and Job Object handling.
- Diagnostics export, updater, installer, code signing and CI packaging.
- Full test suite (unit/integration/UI) and performance benchmarks.

## Known deviations from the spec

- The app is branded **PuffGittt**, uses `appicon.png`, and keeps the spec's
  `Git Workspace` feature brief as the product reference.
- The app uses a custom CSS layer on top of Fluent UI tokens instead of only
  Fluent components for every panel.
- Monaco is integrated directly with local workers and local CSS, not from a CDN.
- Wails bindings are called through a small bridge with a browser-only mock
  fallback for UI development.
- Settings use `%APPDATA%\PuffGittt` rather than the literal path
  `%APPDATA%\GitWorkspace` in the spec.
