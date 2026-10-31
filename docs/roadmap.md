# Roadmap and SmartGit / SourceTree Gap Analysis

Updated: 2026-11-01

This document compares PuffGittt with SmartGit and SourceTree and defines the
recommended implementation order.

## Current capabilities

### Workspace

- Multi-repository tabs and Welcome open/clone/init flows.
- Restores the last active repository and view.
- Collapsible/resizable sidebar with a merged project list and draggable height.
- Light/dark theme, font family and base font size.
- Shared Git command confirmation dialog.
- Right-click context menus.

### Changes

- Tracked/untracked tabs, tree/flat modes, filters and status colors.
- Checkbox selection with select-all and directory tri-state.
- Whole-file stage, unstage and discard scoped to checked files.
- Commit, amend and identity override.
- Monaco inline/split diff.
- Shared maximized diff dialog with previous/next navigation.

### History

- Branch/all-branches filter and commit subject search.
- Virtualized commit list and SVG lane graph.
- Resizable commit details/changed-files sections.
- Changed-file tree/flat modes and diff dialog.
- Create branch/tag, copy OID, reset, revert and drop through a context menu.
- Git command previews for History operations.

### Branches / Sync

- Local/remote branch lists.
- Switch, merge, rebase and delete through a right-click menu.
- Merge/rebase direction labels and command confirmation.
- Fetch, pull and push with command previews.
- Ahead/behind status.

### Conflicts / Stashes / Tags

- Three-way conflict view, editable result and mark resolved.
- Continue/abort for in-progress merge-like operations.
- Stash list, create, apply, pop and drop.
- Tag list, lightweight/annotated create and local delete.
- Create tags directly from History commits.

## Benchmark

| Capability | SmartGit | SourceTree | PuffGittt | Priority |
|---|---|---|---|---|
| Hunk / line staging | Yes | Yes | Yes | P0 |
| Partial commit | Yes | Yes | Yes | P0 |
| File watcher | Yes | Yes | No | P0 |
| Background tasks / cancellation | Yes | Yes | No | P0 |
| Reflog / Undo | Yes | Partial | Basic | P0 |
| Interactive rebase | Yes | Yes | No | P1 |
| Cherry-pick | Yes | Yes | No | P1 |
| File history | Yes | Yes | No | P1 |
| Blame | Yes | Yes | No | P1 |
| Branch compare | Yes | Yes | No | P1 |
| Remote management UI | Yes | Yes | No | P1 |
| Force-with-lease push | Yes | Yes | No | P1 |
| Credential / SSH UI | Yes | Yes | No | P1 |
| Hunk-level conflict resolution | Yes | Yes | Partial | P1 |
| Submodules | Yes | Yes | No | P2 |
| Worktrees | Yes | Yes | No | P2 |
| Git LFS | Yes | Yes | No | P2 |
| Git Flow | Partial | Strong | No | P2 |
| Tag push / signed tags | Yes | Yes | No | P2 |
| Stash diff / partial apply | Yes | Yes | No | P2 |
| Provider integrations / PRs | Yes | Yes | No | P2 |
| Custom actions | Yes | Yes | No | P3 |
| Embedded terminal | Yes | No | No | P3 |
| Bisect | Yes | Partial | No | P3 |
| Sparse checkout | Yes | Partial | No | P3 |
| Image diff | Yes | Yes | No | P2 |
| Signed commits | Yes | Partial | No | P2 |

## First wave

### 1. Hunk and line staging

Status: implemented (hunk panel). Remaining work: Monaco gutter actions and
selection-driven staging directly in the editor.

- Introduce a structured diff model with hunks and line ranges.
- Stage/unstage a hunk.
- Stage/unstage selected lines.
- Validate patches with `git apply --cached --check` before applying.
- Keep the working tree unchanged when a patch fails.
- Add Monaco gutter/actions and hunk headers.
- Cover CRLF and no-final-newline edge cases.

### 2. File watcher and background task queue

- Watch `.git` and the worktree for status/index/ref changes.
- Debounce filesystem events and refresh the affected repository.
- Add a task queue for long-running Git operations.
- Report running/success/failed/cancelled state.
- Support cancellation where Git permits.
- Keep per-repository serialization for writes.

### 3. Reflog and Undo

Status: implemented (basic). Remaining work: multi-step undo history, backups,
and reflog browsing for refs other than HEAD.

#### Placement decision

Reflog should **not** be a separate top-level workspace section.

Recommended placement:

- Add a `Commits / Reflog` mode switch inside the History page.
- Reflog uses the existing History layout:
  - left/main list: reflog entries
  - right: commit details
- Add an `Undo last operation` action in the History toolbar when a safe undo
  snapshot is available.

Rationale:

- Reflog is commit/ref history, so it shares the same commit details and diff UI.
- Avoids adding another top-level navigation item for a diagnostic view.
- Makes Undo discoverable next to the history it restores.

#### Reflog rows

- Selector, e.g. `HEAD@{3}`.
- Action, e.g. `commit`, `reset`, `rebase`, `checkout`, `merge`.
- Old and new OID.
- Relative/absolute time.
- Message.

#### Reflog actions

- View commit.
- Create branch/tag from entry.
- Copy OID.
- Reset current branch to entry with confirmation.
- Restore previous branch/ref where safe.

#### Undo

- Capture the previous HEAD before destructive operations (reset, drop, rebase,
  force update).
- Store a short-lived local undo record with operation name and timestamps.
- Offer `Undo last operation` for safe cases.
- Never hide unresolved conflicts or silently discard worktree changes.

## Second wave

1. Remote management: add/edit/delete remotes, default remote, fetch/push URLs.
2. Branch lifecycle: rename, set upstream, publish, checkout remote branch,
   delete remote branch.
3. Branch/commit compare.
4. File history and blame.
5. Credential and SSH host-key UI.
6. Force-with-lease push.

## Third wave

1. Interactive rebase with todo editor and conflict Continue/Skip/Abort.
2. Cherry-pick, including merge mainline selection.
3. Conflict editor improvements: ours/theirs/both, hunk-level resolution.
4. Stash diff preview and partial apply.
5. Tag push, remote tags and signed tags.

## Fourth wave

1. Submodules.
2. Worktrees.
3. Git LFS.
4. Git Flow wizard.
5. Provider integrations and pull requests.
6. Image diff.
7. Custom actions.
8. Terminal / ConPTY.
9. Bisect and sparse checkout.
10. Signed commits and full accessibility pass.

## Technical foundations

The first wave should also establish:

- Structured diff/patch model shared by Changes and History.
- A repository event pipeline independent of UI polling.
- A task abstraction shared by sync, branch, conflict and history operations.
- Undo/backups as a backend concern, not only a frontend confirmation.
- Tests for patch application, watcher debounce, task cancellation and reflog
  parsing.
