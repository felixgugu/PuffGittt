# PuffGittt 功能盤點與 SmartGit / SourceTree 對標報告

- 日期：2026-11-01
- 版本：本輪功能完成後
- 範圍：Windows 桌面 Git 工作台
- 對標產品：SmartGit、SourceTree
- 測試 repo：`G:\PuffGittt-TestRepo`

---

## 一、摘要

PuffGittt 目前已經從「可用的 Git 前端」進展到可以支撐日常開發流程：

- Changes 支援整檔、Hunk、逐行 stage / unstage。
- History 支援 graph、Reflog、Reset / Revert / Drop、Cherry-pick、Interactive Rebase、Bisect。
- Branches 支援完整生命週期、Remote 管理、Branch Compare、Worktree、Submodule。
- Sync 支援 fetch / pull / push / force-with-lease。
- Tags、Stashes、Conflicts、File History、Blame、Image Diff 都已具備基礎能力。
- Repository change monitor 會自動刷新開啟中的 repo。
- Commit 草稿會依 repository 保存。

與 SmartGit / SourceTree 的主要差距，已經不是「缺少基本 Git 操作」，而是以下幾類：

1. **長操作管理**：background task queue、進度、取消。
2. **安全網**：多步 Undo、destructive operation backup。
3. **遠端認證**：SSH host-key、credential prompt、連線測試。
4. **進階歷史編輯**：Interactive Rebase 的 reorder / reword / skip。
5. **完整生態功能**：Git LFS、remote tags、signed commits、Git Flow、provider 整合。
6. **大規模專案體驗**：跨頁 graph、效能、無障礙與高對比。

**最值得優先投入的方向：**

1. Background task queue + 進度 + 取消。
2. 多步 Undo 與 destructive operation backup。
3. SSH / credential 流程。
4. Interactive Rebase 補完。
5. Remote tag 管理與 Git LFS。

---

## 二、目前能力盤點

### 2.1 工作區與 Shell

| 能力 | 狀態 | 說明 |
|---|---|---|
| 多 repository tabs | 完成 | 可同時開啟多個 repo |
| Welcome / Open / Clone / Init | 完成 | 最近開啟與 projects folder |
| 記住上次 repo 與頁面 | 完成 | 啟動自動恢復 |
| Sidebar 專案清單 | 完成 | 可拖曳高度、顯示 branch / 變更數 |
| Light / Dark theme | 完成 | 跟隨系統或手動切換 |
| 高對比主題 | 未實作 | 尚無 high-contrast token |
| 多視窗 | 未實作 | 目前以 tabs 為主 |
| Keyboard shortcuts | 部分 | 只涵蓋開啟、設定與前幾個頁面 |

### 2.2 Changes

| 能力 | 狀態 | 說明 |
|---|---|---|
| Tracked / Untracked 分頁 | 完成 | tree / flat 模式 |
| 目錄樹、展開收合、狀態顏色 | 完成 | stage / unstaged filter |
| Checkbox 批次 stage / unstage / discard | 完成 | 支援目錄 tri-state |
| 整檔 stage / unstage | 完成 | |
| Hunk stage / unstage | 完成 | Hunk 動作面板 |
| 逐行 stage / unstage | 完成 | 勾選變更行後套用 |
| Patch hash 過期檢查 | 完成 | 檔案變更後拒絕套用 |
| Monaco inline / split diff | 完成 | |
| Monaco gutter hunk actions | 未實作 | 目前用獨立 Hunk 面板 |
| Image diff | 部分 | before / after 並排，無 slider / overlay |
| Commit / Amend | 完成 | 可覆寫單次 commit identity |
| Commit 草稿 | 完成 | 依 repo 存在 localStorage |
| Discard 備份 | 未實作 | discard 後無法還原 |

### 2.3 History

| 能力 | 狀態 | 說明 |
|---|---|---|
| Commit list / graph | 部分 | 自製 SVG lane graph，單頁 200 commits |
| Branch filter / all branches | 完成 | |
| Commit 搜尋 | 完成 | 訊息 / 作者 / SHA 前綴 / 路徑（完整路徑） |
| Commit 詳細資料 | 完成 | 可拖曳調整高度 |
| Changed files tree / flat | 完成 | |
| Diff Dialog | 完成 | 上一個 / 下一個、單欄 / 並排、最大化 |
| Create branch / tag | 完成 | 從 commit 右鍵 |
| Copy OID | 完成 | |
| Reset | 完成 | Soft / Mixed / Hard，含指令預覽 |
| Revert | 完成 | 非 merge commit |
| Drop commit | 完成 | 非 root / merge，且需在目前分支 |
| Cherry-pick | 完成 | 支援 merge mainline |
| Reflog | 完成 | History 內的 Commits / Reflog 模式 |
| Undo | 部分 | 只保留最近一筆，記憶體內，重啟後消失 |
| Interactive Rebase | 部分 | pick / squash / fixup / drop；無 reorder / reword / conflict skip |
| Bisect | 完成 | start / good / bad / reset |
| File History | 部分 | Dialog 呈現，尚無獨立 workspace |
| Blame | 部分 | 逐行顯示，尚無 range / 作者統計 |
| 跨頁 graph frontier | 未實作 | 換頁時 lane 狀態未完整延續 |

### 2.4 Branches / Sync

| 能力 | 狀態 | 說明 |
|---|---|---|
| Local / remote 分支列表 | 完成 | 顯示 upstream、merged、HEAD |
| Create / Switch / Merge / Rebase | 完成 | 含指令預覽 |
| Rename / Set upstream | 完成 | |
| Publish / Checkout remote / Delete remote branch | 完成 | |
| Delete local branch | 完成 | 含 force |
| Branch compare | 部分 | ahead / behind、commits、files；尚無 compare 內 diff |
| Fetch / Pull / Push | 完成 | 指令預覽 |
| Force-with-lease | 完成 | 右鍵操作 |
| Remote 管理 | 完成 | 新增 / 修改 URL / 刪除 |
| 預設 remote | 未實作 | 目前取第一個 remote |
| Credential prompt | 未實作 | `GIT_TERMINAL_PROMPT=0` |
| SSH host-key 驗證 | 未實作 | 尚無互動式確認 |
| Sync 進度 / 取消 | 未實作 | 長操作只能等待 |

### 2.5 Conflicts / Stashes / Tags

| 能力 | 狀態 | 說明 |
|---|---|---|
| Conflict 清單 | 完成 | 來自 index stage 1/2/3 |
| Three-way 內容 | 完成 | Base / Ours / Theirs |
| 可編輯 result / save / resolve | 完成 | |
| 採用 Ours / Theirs / 兩邊 | 完成 | 整檔層級 |
| Hunk-level conflict resolution | 未實作 | 尚無逐段 ours/theirs |
| Continue / Abort | 完成 | merge / rebase / cherry-pick / revert |
| Stash list / create / apply / pop / drop | 完成 | |
| Stash diff preview | 完成 | patch 文字 |
| Stash partial apply | 未實作 | 尚無逐檔 / 逐 hunk apply |
| Tag list / create / delete | 完成 | lightweight / annotated |
| Tag push / push all | 完成 | 使用第一個 remote |
| Remote tag 管理 | 未實作 | 尚無遠端 tag 列表 / 刪除 |
| Signed tags | 未實作 | |

### 2.6 Repository 工具

| 能力 | 狀態 | 說明 |
|---|---|---|
| Remote 管理 | 完成 | Branches 頁面 |
| Worktree | 完成 | list / add / remove / prune |
| Submodule | 部分 | list / update / sync；無 add / remove / `.gitmodules` 編輯 |
| Git LFS | 未實作 | |
| Repository change monitor | 部分 | 1.5 秒 polling，非 fsnotify |
| Background task queue | 未實作 | 目前以 per-repo mutex 序列化寫入 |
| Diagnostics export | 未實作 | |
| Installer / code signing / updater | 未實作 | 目前只有 exe |

---

## 三、SmartGit / SourceTree 對標總表

狀態說明：

- **有**：產品具備完整或接近完整能力。
- **部分**：已有基礎功能，但缺少進階或完整流程。
- **無**：尚未提供。
- SmartGit / SourceTree 的能力依版本與授權可能不同，本表以常見桌面版本與官方文件概括。

| 能力 | SmartGit | SourceTree | PuffGittt | 建議優先 |
|---|---|---|---|---|
| Hunk / line staging | 有 | 有 | 部分（面板） | P1 |
| Partial commit | 有 | 有 | 有 | - |
| Monaco gutter staging | 有 | 有 | 無 | P2 |
| Commit graph | 有 | 有 | 部分 | P2 |
| Commit 搜尋 author / SHA / path | 有 | 有 | 有 | - |
| Interactive rebase | 有 | 有 | 部分 | P1 |
| Cherry-pick | 有 | 有 | 有 | - |
| Reset / Revert / Drop | 有 | 有 | 有 | - |
| Reflog / Undo | 有 | 部分 | 部分 | P0 |
| Multi-step undo / backup | 有 | 部分 | 無 | P0 |
| Bisect | 有 | 部分 | 有 | - |
| Blame | 有 | 有 | 部分 | P2 |
| File history | 有 | 有 | 部分 | P2 |
| Branch compare | 有 | 有 | 部分 | P2 |
| Conflict editor | 有 | 有 | 部分 | P1 |
| Image diff | 有 | 有 | 部分 | P2 |
| Branch lifecycle | 有 | 有 | 有 | - |
| Remote management | 有 | 有 | 有 | - |
| Force-with-lease | 有 | 有 | 有 | - |
| Credential / SSH UI | 有 | 有 | 無 | P0 |
| Tags local | 有 | 有 | 有 | - |
| Remote tags / signed tags | 有 | 有 | 部分 / 無 | P1 |
| Stashes | 有 | 有 | 部分 | P2 |
| Submodules | 有 | 有 | 部分 | P1 |
| Worktrees | 有 | 部分 | 有 | - |
| Git LFS | 有 | 有 | 無 | P1 |
| Git Flow | 部分 | 有 | 無 | P3 |
| Signed commits | 有 | 部分 | 無 | P2 |
| Sparse checkout | 有 | 部分 | 無 | P3 |
| Custom actions | 有 | 有 | 無 | P2 |
| Embedded terminal | 有 | 無 | 無 | P3 |
| Provider / PR 整合 | 有 | 有 | 無 | P3 |
| File watcher | 有 | 有 | 部分（polling） | P1 |
| Background tasks / 取消 | 有 | 有 | 無 | P0 |
| 高對比 / 無障礙 | 有 | 有 | 部分 | P2 |
| Draft persistence | 部分 | 部分 | 有 | - |
| Installer / updater / signing | 有 | 有 | 無 | P2 |
| Diagnostics export | 有 | 有 | 無 | P2 |
| 大型 repo 效能 | 有 | 部分 | 未驗證 | P1 |

---

## 四、值得優先實作的功能

以下依「使用者價值 × 實作成本 × 風險」排序。

### P0-1：Background task queue、進度與取消

**現況**

- Wails API 直接等待 Git 指令完成。
- 每個 repo 只有 in-process mutex。
- Fetch / pull / push / rebase 等長操作沒有進度或取消。

**為什麼值得**

- SmartGit / SourceTree 在 fetch、push、rebase、checkout 時都會顯示進度與可取消狀態。
- 大型 repo 或慢速網路下，沒有進度會讓 UI 看起來像卡死。
- 後續的 LFS、submodule update、worktree add 都需要任務模型。

**建議範圍**

- 新增 `internal/task`：任務狀態、排程、取消、事件。
- 每個 repo 一個 queue；寫入操作序列化。
- 任務狀態：queued / running / succeeded / failed / cancelled。
- Wails events：`task:started`、`task:progress`、`task:finished`。
- 前端 StatusBar / 任務面板顯示目前操作，支援取消。
- Git 指令 stdout / stderr 逐行轉成進度事件。

**驗收條件**

- 同時觸發兩個寫入操作時，第二個進入 queue，不會交錯執行。
- 長操作可取消，且 repo 不會留在半完成狀態；不能取消的操作要明確顯示。
- UI 關閉或切換 tab 後，任務仍可完成並更新狀態。

**成本**：Large  
**風險**：Medium（跨 goroutine、Wails 事件生命週期）

---

### P0-2：多步 Undo 與 destructive operation backup

**現況**

- Reset / Revert / Drop / Merge / Rebase / Cherry-pick / Interactive Rebase 成功後會記錄一筆 undo。
- 只存在記憶體，重啟後消失。
- Hard Reset 前的 worktree 變更不會備份。
- Discard 沒有備份。

**為什麼值得**

- SmartGit 的 undo / backup 是它與一般 Git GUI 的主要差異之一。
- PuffGittt 已有多個會改写歷史的操作，安全網不足。
- 可降低使用者對 Reset / Drop / Rebase 的恐懼。

**建議範圍**

- 保存最近 N 筆操作：operation、beforeOid、afterOid、branch、timestamp。
- Hard Reset / Discard 前建立 Git object 或 patch backup。
- Backup 存放於 app data，不在 repo 內留下檔案。
- 提供「Undo last operation」與「Backup / Restore」入口。
- 衝突中或 worktree 不乾淨時，明確拒絕或提示。
- 保留期限與容量上限。

**驗收條件**

- Reset --hard 後可還原 HEAD 與被丟棄的 worktree 變更。
- Drop / Rebase 後可回到操作前分支。
- 程式重啟後仍可看到最近的 undo / backup 記錄。
- 無法安全 undo 時，UI 顯示原因而不是直接失敗。

**成本**：Medium–Large  
**風險**：Medium（資料安全、磁碟容量、物件清理）

---

### P0-3：Credential prompt 與 SSH host-key 驗證

**現況**

- 所有 Git 指令設定 `GIT_TERMINAL_PROMPT=0`。
- Remote 使用 HTTPS 需要 token，SSH 首次連線需要 host-key 確認時，操作直接失敗。
- 沒有 credential helper 設定 UI。

**為什麼值得**

- 這是目前 remote 操作最常見的實際阻塞點。
- SmartGit / SourceTree 都會處理 credential 與 host-key。
- 沒有這個能力，push / pull / clone 在真實環境很容易失敗。

**建議範圍**

- 新增 credential prompt 流程：HTTPS username / token / password。
- 使用 Git credential helper 或 askpass；不要把密碼寫入 log。
- SSH host-key：首次連線顯示 fingerprint，讓使用者確認。
- 記住 credential 的選項（交由 OS credential store）。
- 遠端連線測試按鈕。
- 錯誤訊息區分認證失敗、host-key 失敗、網路失敗。

**驗收條件**

- 私有 HTTPS repo 可輸入 token 並完成 clone / push。
- SSH 首次連線可確認 host key；拒絕後不寫入 known_hosts。
- Credential 不會出現在 UI log、status message 或 Git command preview。

**成本**：Large  
**風險**：High（安全與平台差異）

---

### P1-1：Interactive Rebase 補完

**現況**

- 支援 pick / squash / fixup / drop。
- 不支援拖曳排序、reword、edit、conflict skip。
- 第一個保留的 commit 必須是 pick。

**建議範圍**

- Todo 拖曳排序。
- Reword：以指定訊息改寫 commit message。
- Edit：停下來讓使用者 amend。
- Conflict 時提供 Continue / Skip / Abort。
- 顯示目前 rebase 進度與剩餘 commits。
- Plan 過期檢查與友善錯誤。

**驗收條件**

- 可重新排序 commits 並完成 rebase。
- Reword 後 message 正確。
- 衝突時可 Skip 單一 commit，且不破壞後續 todo。
- 失敗後可 Abort 回到原始 HEAD。

**成本**：Medium–Large  
**風險**：Medium（歷史改寫）

---

### P1-2：Remote tags 與 signed tags

**現況**

- 可建立 / 刪除 local tag。
- 可 push 單一 tag 或全部 tags。
- 沒有遠端 tag 列表、遠端刪除、signed tag。

**建議範圍**

- `git ls-remote --tags` 列表與比對 local / remote。
- 刪除 remote tag：`git push <remote> --delete <tag>`。
- Signed tag：`git tag -s`，需要 GPG 設定。
- Tag 詳情：annotated message、tagger、target commit。

**驗收條件**

- 可看到 remote-only / local-only / 同步狀態。
- 刪除 remote tag 有指令預覽與 destructive 警告。
- Signed tag 在沒有 GPG key 時顯示明確錯誤。

**成本**：Small–Medium  
**風險**：Low–Medium

---

### P1-3：Git LFS

**現況**

- 完全沒有 LFS 支援。
- 大型 binary 會被當成一般 binary，無法 preview 或追蹤。

**建議範圍**

- 偵測 `git lfs` 是否安裝與版本。
- 顯示 LFS tracked patterns 與檔案。
- `git lfs track` / `untrack`。
- `git lfs pull` / `fetch` / `push`。
- Stage 前提示檔案是否應加入 LFS。
- LFS 未安裝時提供安裝指引，而不是直接失敗。

**驗收條件**

- 可在 UI 看到 LFS 檔案清單與 patterns。
- Track 新 pattern 後 `.gitattributes` 正確更新。
- Clone 後可 pull LFS 物件。

**成本**：Medium  
**風險**：Medium（外部工具、網路、物件大小）

---

### P1-4：Submodule 完整 CRUD

**現況**

- 可 list / update / sync。
- 不能 add / remove / 編輯 `.gitmodules`。
- 沒有 submodule 內的 branch / commit 操作。

**建議範圍**

- Add submodule（URL + path）。
- Remove submodule（含 `.gitmodules` 與 index 清理）。
- 更新單一 / 全部。
- 顯示落後 commits、dirty 狀態。
- 開啟 submodule 為新 tab。

**驗收條件**

- Add 後 repo 可正常 commit。
- Remove 後 `.gitmodules`、index、worktree 都乾淨。
- Dirty submodule 有明確提示。

**成本**：Medium  
**風險**：Medium（路徑與 index 操作）

---

### P1-5：Commit 搜尋補完

**狀態：已實作**

- 搜尋模式：訊息 / 作者 / SHA 前綴 / 路徑。
- 路徑採 literal path（檔案或目錄），不是模糊比對。

**後續可加強**

- 搜尋結果 highlight。
- 模糊 path / glob。
- 複合條件（作者 + 路徑 + 日期）。

---

### P1-6：真正的 File watcher（fsnotify + debounce）

**現況**

- 目前用 1.5 秒 polling `git status`。
- 對大型 repo 會增加 CPU / IO。
- 外部 `git` 指令變更通常可在 1.5 秒內看到，但不是即時。

**建議範圍**

- 使用 fsnotify 監控 `.git` 與 worktree。
- Debounce 200–500ms。
- 忽略 `node_modules`、`.git/objects` 等高頻路徑。
- Polling 作為 fallback。
- 只在 repo 開啟時監控，關閉 tab 時停止。

**驗收條件**

- 外部修改檔案後 < 1 秒內 UI 更新。
- 大量檔案變更不會造成事件風暴。
- 關閉 tab 後 watcher 正確釋放。

**成本**：Medium  
**風險**：Medium（Windows 檔案事件、遞迴監控）

---

### P2-1：Stash partial apply

**現況**

- 可看 stash patch。
- Apply / pop 只能整包。

**建議範圍**

- 逐檔 apply。
- 逐 hunk apply。
- 與 Hunk staging 共用 patch model。
- 衝突處理沿用 Conflicts 頁面。

**成本**：Medium  
**風險**：Medium

---

### P2-2：Monaco gutter hunk actions

**現況**

- Hunk / line staging 使用獨立面板。
- Monaco 本身沒有 stage / unstage gutter。

**建議範圍**

- Hunk header 顯示 Stage / Unstage。
- 行號 gutter 支援選取變更行。
- 與現有 patch hash 流程共用後端。
- 保留面板作為無障礙與備援操作。

**成本**：Medium  
**風險**：Low–Medium

---

### P2-3：Branch compare 內嵌 diff

**現況**

- 已有 ahead / behind、unique commits、changed files。
- 不能從 compare 直接看檔案 diff。

**建議範圍**

- 點選 changed file 開啟 compare diff。
- 支援 base...compare 的 old / new。
- 與 FileDiffDialog 共用。

**成本**：Small–Medium  
**風險**：Low

---

### P2-4：File History workspace / Blame 強化

**現況**

- File History 與 Blame 是 dialog。
- 沒有獨立 workspace、range blame、作者統計。

**建議範圍**

- File History 可切換 commit / diff。
- Blame range 選取。
- 作者 / 日期 filter。
- 從 blame 跳到 commit。

**成本**：Medium  
**風險**：Low

---

### P2-5：Image diff slider / overlay

**現況**

- 已顯示 before / after 兩張圖。
- 無 slider、overlay、像素差異。

**建議範圍**

- 拖曳 slider 比較。
- Overlay / difference mode。
- 適合 icon、截圖、設計資產。

**成本**：Small–Medium  
**風險**：Low

---

### P2-6：Signed commits

**現況**

- 沒有 GPG / SSH signing 設定。
- Commit 一律不簽章。

**建議範圍**

- Settings 增加 signing key / format。
- Commit 使用 `-S`。
- 失敗時顯示 GPG / SSH 錯誤。
- 可選擇只對特定 repo 啟用。

**成本**：Medium  
**風險**：Medium（外部 key 設定）

---

### P2-7：Custom actions

**現況**

- 無自訂指令。

**建議範圍**

- Settings 定義名稱、指令、參數、適用範圍。
- Repository / file / commit context menu 執行。
- 執行前顯示指令預覽。
- 輸出顯示在結果面板。

**成本**：Medium  
**風險**：Medium（任意指令執行）

---

### P2-8：高對比與無障礙

**現況**

- Light / Dark。
- 圖示按鈕多有 aria-label / tooltip。
- 尚未完整 keyboard navigation 與 high contrast。

**建議範圍**

- High-contrast theme tokens。
- 完整 focus ring / tab order。
- Context menu keyboard navigation。
- Screen reader labels。
- 色彩對比檢查。

**成本**：Medium  
**風險**：Low

---

### P3：生態與平台功能

| 功能 | 建議 | 理由 |
|---|---|---|
| Git Flow | 暫緩 | 使用率下降，且可用 branch + merge 手動完成 |
| Provider / PR 整合 | 暫緩 | 需要 OAuth、API、維護成本 |
| Embedded terminal | 暫緩 | 成本高，與 Windows Terminal 重疊 |
| Sparse checkout | 暫緩 | 小眾，且與 worktree / submodule 互動複雜 |
| Installer / updater / code signing | 發佈前必做 | 不影響日常開發，但影響產品交付 |
| Diagnostics export | 可先做 | 對支援使用者很實用，成本低 |
| 大型 repo 效能 benchmark | 應優先 | 需要資料才能決定 graph / watcher 策略 |

---

## 五、建議實作路線

### Wave A：安全網與基礎建設

1. Background task queue、進度、取消。
2. Multi-step Undo 與 destructive operation backup。
3. fsnotify watcher + debounce（polling fallback）。
4. Commit 搜尋補完（已完成：message / author / SHA / path）。

**完成後效果**

- 長操作不再卡 UI。
- Reset / Drop / Rebase 有可靠復原路徑。
- 外部變更更即時。
- 日常找 commit 更容易。

### Wave B：遠端與協作

1. Credential prompt。
2. SSH host-key 驗證。
3. Remote tag 管理與 signed tags。
4. Git LFS。
5. Submodule add / remove。

**完成後效果**

- 私有 repo、SSH、LFS 專案可正常使用。
- 遠端 tag 與子模組流程接近 SmartGit / SourceTree。

### Wave C：歷史與衝突進階編輯

1. Interactive Rebase reorder / reword / edit / skip。
2. Hunk-level conflict resolution。
3. Stash partial apply。
4. Monaco gutter hunk actions。

### Wave D：History 體驗與比較

1. Branch compare 內嵌 diff。
2. File History workspace / Blame range。
3. 跨頁 graph frontier。
4. Image diff slider。
5. 大型 repo 效能優化。

### Wave E：發佈與生態

1. Diagnostics export。
2. High-contrast / accessibility pass。
3. Signed commits。
4. Custom actions。
5. Installer、code signing、updater、CI packaging。
6. Git Flow、provider integrations、terminal（依產品定位決定）。

---

## 六、技術債與風險

### 6.1 Diff model 尚未完全統一

- `DiffDocument` 同時包含 old/new text、hunks、patch hash、image base64。
- Hunk 面板使用結構化資料，Monaco 仍使用純文字。
- 後續若要做 gutter staging、conflict hunk、stash partial apply，建議抽出共用 patch / hunk model。

### 6.2 Watcher 仍是 polling

- 目前 1.5 秒 polling 對一般 repo 足夠，但大型 repo 會增加負擔。
- 需要 fsnotify、debounce、忽略清單與 fallback。

### 6.3 Undo 只在記憶體

- 單步、重啟消失、沒有 worktree backup。
- 這是目前 destructive operation 最大的風險。

### 6.4 認證與 SSH 缺口

- `GIT_TERMINAL_PROMPT=0` 讓需要互動的 Git 操作直接失敗。
- 沒有 credential store 與 host-key UI。

### 6.5 前端測試不足

- Backend 有多個 Go tests。
- Frontend 目前只有 TypeScript build，沒有 unit / component test。
- 建議先補：Hunk panel、Branches dialogs、History context menu、Settings。

### 6.6 大型 repo 未驗證

- Commit list 固定 200 筆。
- 尚無 10 萬 commits、超大 worktree、大量 branches 的效能數據。
- 建議建立 benchmark repo 與量測流程。

### 6.7 平台差異

- Windows 路徑、CRLF、Git for Windows shell 行為需要持續測試。
- Interactive Rebase 的 editor / sequence editor 已使用 Git shell 相容方式，但仍需更多邊界測試。

---

## 七、建議不要優先投入的項目

以下不是「永遠不做」，而是目前投報率較低：

1. **Embedded terminal**：Windows Terminal 已很好用，實作 ConPTY、字型、快捷鍵成本高。
2. **Provider / PR 整合**：需要 OAuth、API 權限、rate limit、憑證保存與長期維護。
3. **Git Flow**：可用 branch + merge 手動完成，且團隊採用率下降。
4. **Sparse checkout**：小眾，與 worktree / submodule / LFS 互動複雜。
5. **完整 Git 模擬器**：PuffGittt 應保持「呼叫真實 Git」的策略，不自行重寫 Git 行為。

---

## 八、驗證方式

目前建議的驗證流程：

```powershell
# Backend tests
go test ./...

# Frontend typecheck + production build
cd frontend
npm run build

# Desktop packaging
wails build
# build/bin/puffgittt.exe
```

手動驗證請使用：

```text
G:\PuffGittt-TestRepo
```

測試重點：

- Hunk / line staging 與 patch hash 過期。
- Reset / Revert / Drop / Cherry-pick / Rebase / Bisect。
- Branch lifecycle、remote 管理、branch compare。
- Conflict ours / theirs / both。
- Tag push、stash diff、image diff。
- Worktree / submodule。
- Repository monitor 自動刷新。

---

## 九、結論

PuffGittt 已經具備一套完整的日常 Git 工作流，與 SmartGit / SourceTree 的差距主要集中在：

1. **長操作與安全網**：task queue、進度、取消、多步 undo、backup。
2. **遠端認證**：credential、SSH host-key。
3. **進階歷史編輯**：rebase reorder / reword / skip、conflict hunk。
4. **生態功能**：LFS、remote tags、signed commits、Git Flow、providers。
5. **大規模體驗**：graph 跨頁、效能、無障礙。

若只能選三個下一步，建議順序是：

1. **Background task queue + 進度 + 取消**
2. **多步 Undo + destructive operation backup**
3. **Credential / SSH 流程**

這三項完成後，PuffGittt 在「可靠性」與「真實世界可用性」會明顯接近 SmartGit / SourceTree，之後再投入 LFS、rebase 補完與 history UX，會比較穩定。
