# PuffGittt 功能盤點與 SmartGit / SourceTree 對標報告（精簡版）

- 更新日期：2026-11-01
- 範圍：Windows 桌面 Git 工作台
- 對標：SmartGit、SourceTree
- 測試 repo：`G:\PuffGittt-TestRepo`

本版已收斂，只保留目前能力、對標結果、未完成項目與建議順序；詳細實作過程請看 git log。

---

## 一、結論

PuffGittt 已具備完整的日常 Git 工作流：Changes、History、Branches、Sync、Tags、Stashes、Conflicts、LFS、Worktree、Submodule 與 History 操作都有可用 UI。

目前主要缺口：

1. **遠端認證**：credential prompt、SSH host-key。
2. **安全網完整度**：Discard / untracked 備份、backup retention。
3. **進階編輯**：Submodule CRUD、Stash partial apply、Monaco gutter staging、hunk-level conflict。
4. **生態與發佈**：signed commits、custom actions、Git Flow、provider、installer / updater。
5. **大型 repo 體驗**：跨頁 graph、效能 benchmark、無障礙。

最值得優先投入：

1. Credential / SSH 流程。
2. Discard 備份與 backup retention。
3. Submodule CRUD 或 hunk-level conflict resolution。

---

## 二、目前能力

| 領域 | 狀態 | 重點 |
|---|---|---|
| Repository / Tabs | 完成 | 多 repo tabs、Welcome、記住上次 repo 與頁面 |
| Sidebar | 完成 | 專案清單、新增 / 移除、拖曳高度、只對開啟分頁讀 Git |
| Changes | 完成 | Tree/flat、checkbox、整檔 / hunk / 逐行 stage、image diff |
| History | 完成 | Graph、Reflog、搜尋、Reset/Revert/Drop、Cherry-pick、Rebase、Bisect |
| Diff / Undo | 部分 | 多步 Undo、worktree backup；Discard / untracked 未涵蓋 |
| Branches / Sync | 完成 | Lifecycle、compare + inline diff、fetch/pull/push、force-with-lease |
| Remotes | 完成 | 新增 / 編輯 / 刪除 |
| Tags | 完成 | Local / remote 列表、狀態比對、signed tags、遠端刪除 |
| Conflicts | 部分 | Three-way、ours/theirs/both、continue/skip/abort；無 hunk 級 |
| Stashes | 部分 | List/create/apply/pop/drop/diff；無 partial apply |
| Worktrees | 完成 | List/add/remove/prune |
| Submodules | 部分 | List/update/sync；無 add/remove/`.gitmodules` |
| Git LFS | 完成 | 偵測、patterns、files、track/untrack、pull/push |
| Task queue | 部分 | 長操作 queue、進度、取消；無 Job Object / 全域 runner |
| Watcher | 完成 | fsnotify + debounce + fingerprint + polling fallback |
| Settings | 部分 | 主題、語言、字型、Git path、identity、LFS；無高對比 |
| Search | 完成 | Message / author / SHA 前綴 / path |
| Packaging | 未完成 | 只有 exe；無 installer / signing / updater |

---

## 三、SmartGit / SourceTree 對標

狀態：**有** / **部分** / **無**。實際能力依版本與授權可能不同。

| 能力 | SmartGit | SourceTree | PuffGittt | 優先 |
|---|---|---|---|---|
| Hunk / line staging | 有 | 有 | 有（面板） | P2 |
| Partial commit | 有 | 有 | 有 | - |
| Monaco gutter staging | 有 | 有 | 無 | P1 |
| Commit graph | 有 | 有 | 部分 | P2 |
| Commit 搜尋 | 有 | 有 | 有 | - |
| Interactive rebase | 有 | 有 | 有 | - |
| Cherry-pick | 有 | 有 | 有 | - |
| Reset / Revert / Drop | 有 | 有 | 有 | - |
| Reflog | 有 | 部分 | 有 | - |
| Multi-step undo / backup | 有 | 部分 | 部分 | P0 |
| Bisect | 有 | 部分 | 有 | - |
| Conflict editor | 有 | 有 | 部分 | P1 |
| Image diff | 有 | 有 | 部分 | P2 |
| File history | 有 | 有 | 部分 | P2 |
| Blame | 有 | 有 | 部分 | P2 |
| Branch lifecycle | 有 | 有 | 有 | - |
| Branch compare | 有 | 有 | 有 | - |
| Remote management | 有 | 有 | 有 | - |
| Force-with-lease | 有 | 有 | 有 | - |
| Credential / SSH UI | 有 | 有 | 無 | P0 |
| Tags / signed tags | 有 | 有 | 有 | - |
| Remote tags | 有 | 有 | 有 | - |
| Stash diff / partial apply | 有 | 有 | 部分 | P1 |
| Submodules | 有 | 有 | 部分 | P1 |
| Worktrees | 有 | 部分 | 有 | - |
| Git LFS | 有 | 有 | 有 | - |
| Signed commits | 有 | 部分 | 無 | P2 |
| Git Flow | 部分 | 有 | 無 | P3 |
| Custom actions | 有 | 有 | 無 | P2 |
| Provider / PR 整合 | 有 | 有 | 無 | P3 |
| Embedded terminal | 有 | 無 | 無 | P3 |
| Sparse checkout | 有 | 部分 | 無 | P3 |
| High contrast / a11y | 有 | 有 | 部分 | P2 |
| Installer / updater / signing | 有 | 有 | 無 | P2 |
| Diagnostics export | 有 | 有 | 無 | P2 |
| 大型 repo 效能 | 有 | 部分 | 未驗證 | P1 |

---

## 四、未完成項目與優先級

### P0：可靠性與真實環境可用性

- **Credential prompt 與 SSH host-key**：目前 `GIT_TERMINAL_PROMPT=0`，私有 repo / SSH 首次連線會直接失敗。
- **Discard / untracked 備份**：Undo 已涵蓋 tracked 歷史操作；Discard、未追蹤檔案與 backup retention 尚未完成。
- **Task queue 收尾**：補 Windows Job Object、子行程清理、更多長操作接入。

### P1：高價值工作流

- **Submodule CRUD**：add / remove / `.gitmodules` 編輯、dirty 狀態提示。
- **Stash partial apply**：逐檔 / 逐 hunk apply。
- **Monaco gutter staging**：直接在編輯器 gutter stage / unstage，保留現有 Hunk 面板作備援。
- **Hunk-level conflict resolution**：逐段 ours / theirs / both。
- **大型 repo benchmark**：10 萬 commits、超大 worktree、大量 branches。

### P2：體驗與生態

- File History workspace、Blame range。
- Image diff slider / overlay。
- Signed commits。
- Custom actions。
- High-contrast theme、完整 keyboard / screen-reader pass。
- Diagnostics export。
- Installer、code signing、updater。

### P3：較大型或依產品定位決定

- Git Flow。
- Provider / PR 整合。
- Embedded terminal / ConPTY。
- Sparse checkout。

---

## 五、技術債

- `DiffDocument` 同時包含 text、hunks、patch hash、image base64；可再抽共用 patch / hunk model。
- Watcher 受 Windows 無 recursive watch 限制；超過 2500 個目錄時退回 polling。
- Undo backup 只涵蓋 tracked staged / unstaged 變更。
- Task queue 仍為 in-process；無 cross-process / Job Object。
- Frontend 尚無 unit / component test。
- 大型 repo 效能尚未量測。
- 認證與 signing 仍依賴 Git / OS 外部設定。

---

## 六、建議實作順序

1. **Auth 與安全網**：Credential / SSH、Discard 備份、backup retention。
2. **Repository 深度**：Submodule CRUD、Stash partial apply、Task queue 收尾。
3. **Diff / Conflict**：Monaco gutter staging、hunk-level conflict。
4. **生態與發佈**：Signed commits、custom actions、diagnostics、installer / updater。

---

## 七、驗證

```powershell
go test ./...
cd frontend
npm run build
cd ..
wails build
# build/bin/puffgittt.exe
```

手動驗證請使用 `G:\PuffGittt-TestRepo`。
