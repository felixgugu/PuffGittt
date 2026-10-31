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
- Merged project/recent list with a draggable section resizer and persisted height.
- Windows icon generated from `appicon.png`; brand art removed from main screens.
- Multi-repository tabs and singleton process-level settings.
- Last active repository and view restored on launch.
- Traditional Chinese default locale and English locale switch.
- Welcome view with open, clone and init flows.
- Settings dialog for theme, language, base font size, font family, projects
  folder, Git path and commit identity; About block includes Git/Go/Wails
  versions.

### Repository and changes
- Repository validation through `git rev-parse`.
- Status parsing via `git status --porcelain=v2 -z --branch`.
- Staged, unstaged, untracked and conflicted file classification.
- Changes screen with a resizable layout: directory/flat file panel, commit
  composer and shared diff dialog.
- Tracked/untracked tabs with tree/flat view modes and persisted preferences.
- Directory trees with expand/collapse, staged/unstaged filter and status colors.
- Checkbox selection, select-all and directory tri-state selection.
- Checkbox-scoped stage/unstage/discard actions.
- Whole-file stage/unstage.
- Hunk-level and line-level stage/unstage, available in the Changes diff panel and
  shared diff dialog.
- Patch hash validation before applying partial changes; stale diffs are rejected
  without modifying the index.
- Discard tracked paths (without backup/undo). Untracked physical deletion is not exposed.
- Monaco diff with inline/split toggle and a shared maximized file diff dialog.
- Double-click a file to open the shared diff dialog with previous/next navigation.
- Repository change monitor polling porcelain status every 1.5 seconds; emits
  `repo:changed` Wails events and refreshes open tabs automatically.
- Binary detection and 2 MiB preview cap.
- Commit composer with subject, description, amend and per-commit identity override.
- Commit message passed through stdin to `git commit -F -`.
- In-process per-repository write lock.

### History
- `git log --topo-order` with bounded 200-commit pages.
- Branch filter, all-branches mode and commit message search.
- Virtualized commit list.
- SVG lane graph computed from commit parents.
- Resizable commit details/changed-files sections.
- Changed files in tree/flat modes with filename status colors.
- Shared maximized diff dialog on file double-click, with previous/next file navigation.
- Right-click commit context menu: create branch, create tag, copy OID, reset,
  revert and drop.
- Reset Soft / Mixed / Hard, revert (non-merge) and drop commit (non-root,
  non-merge, current branch) with Git command previews.
- Cherry-pick any commit, with mainline parent selection for merge commits.
- Commits / Reflog mode switch in the History page, with reflog entry details.
- Reflog right-click menu: create branch/tag, copy OID and reset.
- Undo last operation for reset, revert, drop, merge and rebase, guarded by a
  clean working tree and no in-progress operation.

### Branches and sync
- Local/remote branch listing with current/upstream/merged metadata.
- Create, switch, delete, merge and rebase APIs.
- Create/switch/delete/merge/rebase wired in the UI.
- Right-click local branch context menu for switch, merge, rebase and delete.
- Merge and rebase direction labels with Git command confirmation dialogs.
- Fetch, pull (merge/rebase/ff-only strategy API) and push with command previews.
- Ahead/behind status.

### Conflicts and stashes
- Unmerged index detection via `git ls-files -u -z`.
- Three-way content from index stages 1/2/3.
- Editable result, save result and mark resolved.
- Continue/abort for merge, rebase, cherry-pick and revert.
- Stash list, create, apply, pop, drop.

### Tags
- Tag list.
- Create lightweight tags.
- Create annotated tags with optional commit target.
- Delete local tags with Git command confirmation.
- Create tags directly from a History commit.

### Backend API
- AppAPI, RepoAPI, ChangeAPI, CommitAPI, HistoryAPI, BranchAPI, SyncAPI,
  ConflictAPI, StashAPI and TagAPI Wails bindings.
- Git command previews for Branch, Sync and History operations.
- Shared Git command confirmation dialog.
- Git operation errors are surfaced to the UI.
- Settings persisted atomically as JSON under `%APPDATA%\PuffGittt`.
- Recent repository list persisted and capped.

## Partial / simplified

- **Diff representation**: old/new file text is loaded and displayed in Monaco;
  staging uses structured hunks from `git diff`, but the editor does not expose
  gutter-level hunk actions yet.
- **Discard**: no backup, confirmation token or restore entry yet.
- **Reset / Revert / Drop**: basic Git commands with command previews. Undo covers
  the most recent reset/revert/drop/merge/rebase only when the working tree is
  clean; there is no backup retention or multi-step undo history.
- **Merge/rebase**: basic Git commands only; no strategy planner, expected-head
  validation or detailed conflict-aware recovery UI.
- **Branch lifecycle**: no rename, set-upstream, publish, remote checkout or branch compare.
- **Commit graph**: functional lane algorithm but not the full frontier/cross-page
  snapshot implementation described in the spec.
- **Search**: commit subject search only; author/SHA/path search not complete.
- **Tags**: local list/create/delete only; no push, remote tag management or signed tags.
- **Remotes**: list API exists; no remote add/edit/delete UI.
- **Settings identity**: used for commits via `git -c`, not written to repo config.
- **Refresh**: repository change monitor polls porcelain status every 1.5 seconds;
  there is no fsnotify watcher or per-directory event stream yet.
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
- **Tabs and window state**: last active repository/view is restored, but open tabs
  are session-only and window size/position is not restored between launches.
- **Shell keyboard model**: shortcuts cover open, settings and the first three
  views; title-bar and repository-list focus navigation is not complete.
- **Settings drafts**: theme, language and font-size changes preview live; cancel
  does not roll the preview back until the next launch.

## Not started

- Hunk and line staging are implemented with a structured hunk panel, not Monaco
  gutter actions.
- Automatic backup retention and multi-step undo history.
- Reflog selectors for refs other than HEAD and cross-ref reflog browsing.
- Interactive rebase editor and todo manipulation.
- Cherry-pick, blame and per-file history screens.
- Image diff (before/after, slider, checkerboard).
- Worktrees, submodules and Git LFS.
- Embedded terminal / ConPTY.
- Remote repository management UI, credentials, host-key verification and
  force-with-lease push flow.
- Branch rename, set upstream, publish branch, remote branch checkout and compare.
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
