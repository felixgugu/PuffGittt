# Git Workspace：產品說明與程式實作

- 平台：Windows 11 x64。
- 技術：Go + Wails v2 + React + TypeScript + Fluent UI v9。
- 語言：繁體中文／英文。
- 應用型態：單一桌面主視窗、多儲存庫分頁、可調整面板。

本文件只描述軟體功能、畫面與程式實作。所有列出的功能均屬同一次完整實作的內容，不拆分版本或階段。

## 1. 產品說明

Git Workspace 是完整的 Git 桌面工作台，整合工作目錄、提交、歷史圖譜、分支、遠端同步、衝突解決、Stash、標籤、檔案歷史、Blame、Interactive Rebase、Worktree、子模組與 LFS。使用者透過圖形介面操作，也能查看底層 Git 指令與執行結果。

以 Changes 為預設工作畫面，保留 Overview 總覽。GitHub／GitLab PR 等代管平台專屬功能不包含在此工具本體；一般 Git 遠端透過 HTTPS、SSH 或本機路徑連線。

## 2. 技術決策與套件

### 2.1 核心選擇

| 項目 | 決策 | 理由 |
|---|---|---|
| 桌面框架 | Wails v2 | Go 後端、前端技術 UI、WebView2 |
| 前端 | React + TypeScript + Vite | 元件化面板與型別化橋接 |
| 視覺元件 | Fluent UI React v9 | 符合 Windows 11 視覺方向 |
| Git 引擎 | Git for Windows 的 git.exe | 沿用 Git、Hook、簽署、credential helper 等行為 |
| 設定 | JSON | 初期結構簡單，易遷移與備份 |
| 歷史快取 | 記憶體快取 | 避免過早導入資料庫 |
| 視窗 | 單一主視窗＋多儲存庫分頁 | 符合 Wails v2 實作範圍 |
| 標題列 | 原生 Windows 標題列 | 優先保留 Snap 與系統行為 |

不混用 Wails v3 API。前端透過明確綁定的方法操作本機；互動 shell 僅由 TerminalAPI 管理 session。

### 2.2 Go 依賴

| 套件 | 使用位置 | 用途 |
|---|---|---|
| github.com/wailsapp/wails/v2 | 核心 | 桌面框架與 Bind |
| github.com/wailsapp/wails/v2/pkg/runtime | 核心 | 對話框、事件、視窗 runtime |
| github.com/fsnotify/fsnotify | 核心 | 檔案變更監控；需自行管理子目錄 |
| golang.org/x/sys/windows | 核心 | Job Object 等 Windows 程序控制 |
| github.com/zalando/go-keyring | 選用 | 平台 API Token 儲存 |
| os/exec、context、sync | 標準庫 | Git 執行、取消、鎖 |
| encoding/json、path/filepath、os | 標準庫 | 設定與檔案 |
| log/slog | 標準庫 | 結構化日誌 |

Git 的讀取與寫入統一由 git.exe 執行，Go 負責命令封裝與輸出解析。

### 2.3 前端依賴

| 套件 | 用途 | 使用位置 |
|---|---|---|
| react、react-dom、typescript、vite | 應用基礎與建置 | 核心 |
| @fluentui/react-components、@fluentui/react-icons | 元件、主題、圖示 | 核心 |
| react-resizable-panels | 可收合與縮放面板 | 核心 |
| monaco-editor | DiffEditor 與衝突結果編輯器 | 核心 |
| zustand | 分頁、選取項目與面板等 UI 狀態 | 核心 |
| @tanstack/react-query | 綁定方法查詢、快取與失效 | 核心 |
| @tanstack/react-virtual | 長清單虛擬化 | 核心 |
| i18next、react-i18next | 繁體中文／英文 | 核心 |

直接整合 monaco-editor，避免額外 React wrapper 的版本相容成本。Worker、語言資源與字型全部本機封裝，不依賴 CDN。Zustand 不複製儲存庫查詢結果；Git 資料統一由 React Query 管理。


### 2.4 執行環境與入口

Windows 11 安裝 Git for Windows 與 WebView2 Runtime。Go 使用 Wails v2 的 options.App 建立視窗，將 frontend/dist 以 embed.FS 交給 AssetServer，Bind 註冊 API facade；OnStartup 建立應用 context 與事件出口，OnShutdown 關閉任務與儲存資料。

```go
// main.go 入口結構；服務由 internal 的建構函式建立。
//go:embed all:frontend/dist
var assets embed.FS

func main() {
    app := bootstrap.New()
    err := wails.Run(&options.App{
        Title: "Git Workspace",
        Width: 1440, Height: 900,
        MinWidth: 1100, MinHeight: 720,
        AssetServer: &assetserver.Options{Assets: assets},
        OnStartup: app.Startup,
        OnShutdown: app.Shutdown,
        Bind: app.Bindings(),
    })
    if err != nil { log.Fatal(err) }
}
```

main.go imports 包含 embed、log、github.com/wailsapp/wails/v2、pkg/options、pkg/options/assetserver 與專案 internal/bootstrap。bootstrap.App 提供 Startup(context.Context)、Shutdown(context.Context)、Bindings() []interface{}；建構時建立 registry、runner、task manager、services 與 API facade。

wails.json 沿用 react-ts 模板，以 Vite 建置 frontend/dist；正式版載入內嵌資源。frontend/wailsjs 是 Wails 產生的 Go 與 runtime 橋接，前端統一由 src/bridge 包裝。npm 套件另加入 @xterm/xterm、@xterm/addon-fit；ConPTY 由 golang.org/x/sys/windows 封裝 Windows API。

## 3. 系統架構與目錄

### 3.1 呼叫方向

```text
+-------------------------------------------------------------------+
| React Pages / Shared Components                                   |
| Fluent UI | Monaco | Virtual Lists | SVG Commit Graph              |
+-------------------------------+-----------------------------------+
                                |
+-------------------------------v-----------------------------------+
| Frontend Bridge + Query Cache + UI Store                          |
+-------------------------------+-----------------------------------+
                                | Wails Bindings / Events
+-------------------------------v-----------------------------------+
| Go API Facades                                                    |
| RepoAPI | ChangeAPI | HistoryAPI | BranchAPI | SyncAPI | TaskAPI    |
+-------------------------------+-----------------------------------+
                                |
+-------------------------------v-----------------------------------+
| Application Services                                              |
| Validation | Workflow State | Repository Locks | Task Management    |
+-------------------------------+-----------------------------------+
                                |
+-------------------------------v-----------------------------------+
| Git Runner / Parsers | Watcher | Storage | Windows Integration     |
+-------------------------------+-----------------------------------+
                                |
                           Git for Windows
```

### 3.2 專案目錄

```text
git-workspace/
+-- main.go
+-- wails.json
+-- go.mod / go.sum
+-- build/windows/                  # icon、manifest、Windows 資源
+-- internal/
|   +-- bootstrap/                  # 服務組裝與生命週期
|   +-- api/                        # 綁定 facade、輸入與回應
|   +-- service/                    # 使用案例與流程
|   +-- model/                      # 共用 DTO、列舉與錯誤
|   +-- git/
|   |   +-- runner.go
|   |   +-- runner_windows.go
|   |   +-- capabilities.go
|   |   +-- status.go / diff.go / log.go
|   |   +-- index.go / commit.go / branch.go
|   |   +-- remote.go / merge.go / rebase.go / stash.go
|   |   +-- parser/
|   +-- repository/                 # ID、gitdir、commondir、鎖
|   +-- task/                       # 佇列、事件、取消與結果
|   +-- watcher/                    # 監控、debounce、重新掃描
|   +-- settings/                   # 設定、草稿、版本遷移
|   +-- credentials/                # 選用平台 Token
|   +-- terminal/                   # ConPTY session 與輸出串流
|   +-- platform/                   # Windows 整合
|   +-- logging/
+-- frontend/
|   +-- src/
|   |   +-- app/                    # Providers 與啟動
|   |   +-- layout/                 # Shell、工具列、導覽、狀態列
|   |   +-- features/
|   |   |   +-- welcome/ / overview/ / changes/ / history/
|   |   |   +-- branches/ / conflicts/ / remotes/ / stash/ / settings/
|   |   |   +-- rebase/ / worktrees/ / submodules/ / lfs/ / terminal/
|   |   +-- components/             # 共用面板、錯誤、載入狀態
|   |   +-- bridge/                 # Wails 呼叫與事件 adapter
|   |   +-- queries/                # query keys 與失效策略
|   |   +-- stores/                 # UI 狀態
|   |   +-- editor/                 # Monaco workers、models
|   |   +-- themes/ / locales/
|   +-- wailsjs/                    # 自動產生
|   +-- package.json / package-lock.json
```

### 3.3 邊界

API 不直接組 Git 參數；service 不存放 React 介面狀態；git 套件不呼叫 Wails runtime。事件由 task／service 經可替換的 EventSink 發送。啟動時集中建立服務與 Bind，OnStartup 注入應用 context，關閉時停止監控與任務並保存草稿。

## 4. 介面設計與 ASCII 版型

### 4.1 視覺與尺寸

- 基準：1440 × 900 DIP；最小視窗：1100 × 720 DIP。
- 原生標題列；應用內分頁列 40 DIP、工具列 44 DIP、狀態列 26 DIP。
- 全域導覽預設 208 DIP，可在 176～300 DIP 調整。
- 工作目錄檔案清單預設 260 DIP，提交面板 300 DIP；中央內容至少 360 DIP。
- 小視窗先收合全域導覽與詳情面板，不擠壓程式碼至不可閱讀。
- 間距以 4／8 DIP 為基礎；一般文字 13～14 DIP，編輯器 13～15 DIP。
- 主題：系統、淺色、深色、高對比；用 Fluent tokens 定義，不散落硬編碼色碼。
- 修改、刪除、衝突等狀態同時使用文字、圖示與顏色。
- 版型中的英文僅為等寬占位，正式 UI 使用本地化字串。

### 4.2 共用主視窗

```text
+------------------------------------------------------------------------------------------------+
| Git Workspace                                                                  _    []    X    |
+------------------------------------------------------------------------------------------------+
| [ Project Alpha x ] [ Project Beta x ] [+]                                                      |
+------------------------------------------------------------------------------------------------+
| Project Alpha / main v       [Fetch] [Pull 2] [Push 3]       [Search...] [Commands] [Settings]    |
+------------------+-------------------------------------------------------+---------------------+
| NAVIGATION       | ACTIVE WORKSPACE                                      | DETAILS             |
| Overview         |                                                       | Selected item       |
| Changes       8  |                                                       | Summary             |
| History          |                                                       | Actions             |
| Branches         |                                                       |                     |
| Remotes          |                                                       |                     |
| Tags             |                                                       |                     |
| Stashes       2  |                                                       |                     |
+------------------+-------------------------------------------------------+---------------------+
| [Tasks] [Output]                                                        [Expand / Collapse]    |
+------------------------------------------------------------------------------------------------+
| main | 8 changed files | Ahead 3 / Behind 2                         Ready | UTF-8 | LF            |
+------------------------------------------------------------------------------------------------+
```

### 4.3 歡迎與總覽

```text
+-------------------------------------------------------------------------------------+
| Git Workspace                                                    [Settings]         |
+-------------------------------------------------------------------------------------+
| [Open repository]      [Clone repository]      [Initialize repository]               |
|                                                                                     |
| PINNED                                      RECENT                                  |
| +-------------------------------------+     +-------------------------------------+ |
| | Project Alpha                       |     | Project Beta                        | |
| | C:\Projects\Alpha                   |     | D:\Work\Beta                        | |
| | main / 8 changed files              |     | develop / last opened yesterday     | |
| +-------------------------------------+     +-------------------------------------+ |
|                                                                                     |
| Drop a folder here to open                                                          |
+-------------------------------------------------------------------------------------+
```

總覽提供修改／暫存／衝突數、目前分支、upstream、領先落後、近期提交及待完成流程。預設開啟專案直接進入 Changes；使用者可改為 Overview。未重新掃描前，最近專案資訊標示為上次狀態。

### 4.4 工作目錄與提交

```text
+------------------------------------------------------------------------------------------------+
| CHANGES / main                                         [Refresh] [Fetch] [Pull] [Push]          |
+-----------------------+-----------------------------------------------+------------------------+
| FILES                 | src/auth/login.ts                             | COMMIT                 |
| [Filter...]           | [Split v] [Whitespace] [Open in editor]       | Title                  |
|                       +-----------------------+-----------------------+ +--------------------+ |
| STAGED             3  | OLD                   | NEW                   | | Fix validation     | |
| M login.ts            | 21 function login() { | 21 function login() { | +--------------------+ |
| A validator.ts        | 22                    | 22   validate();      | Description            |
| M login.test.ts       | 23   return true;     | 23   return true;     | +--------------------+ |
| [Unstage all]         | 24 }                  | 24 }                  | |                    | |
|                       |                       |                       | |                    | |
| UNSTAGED           5  |                       |                       | +--------------------+ |
| M app.ts              |                       |                       | 3 files / +42 -18      |
| M settings.ts         |                       |                       | [ ] Amend              |
| M README.md           |                       |                       | [ ] Sign               |
| ? notes.txt           |                       |                       |                        |
| ? draft.json          +-----------------------+-----------------------+ [Commit             v] |
| [Stage all]           | Hunk 1 / 3              [Stage / Unstage hunk] |                        |
+-----------------------+-----------------------------------------------+------------------------+
| OUTPUT: Last operation completed                                                               |
+------------------------------------------------------------------------------------------------+
```

選取 Staged 檔案顯示 HEAD → Index；選取 Unstaged 顯示 Index → Worktree。同一檔案可同時出現在兩區，不能合併成單一模糊狀態。右側內容每 500 ms 防抖保存。

### 4.5 歷史圖譜

```text
+------------------------------------------------------------------------------------------------+
| HISTORY   [Search message / SHA / author...]           [Branch: All v] [Date: All v]             |
+------------------+-------------------------------------------------------+---------------------+
| BRANCHES         | GRAPH   MESSAGE                    AUTHOR    DATE     | COMMIT              |
| * main           | *       Fix login validation       Alice     10:42    | a1b2c3d [Copy]      |
|   develop        | | *     Add settings page          You       09:30    |                     |
|   feature/login  | | *     Add input checks           You       09:10    | Author / Committer  |
|                  | * |     Update dependencies        Bob       Oct 30   | Parents / Refs      |
| REMOTES          | |/                                                    | Full message        |
| v origin         | *       Merge feature/api          Alice     Oct 29   |                     |
|   main           | |\                                                    | [Create branch]     |
|   develop        | | *     Add API client             Bob       Oct 28   | [More actions v]    |
|                  | |/                                                    |                     |
+------------------+------------------------+------------------------------+---------------------+
|                  | CHANGED FILES          | DIFF                                               |
|                  | M src/auth/login.ts    | - return true;                                     |
|                  | A validator.ts         | + validate();                                      |
+------------------+------------------------+----------------------------------------------------+
```

圖譜不是檔案樹。以提交 parent 關係計算 lane；跨頁保留 frontier。搜尋結果另提供清單模式，未完整取得父節點時標示延伸線，不能畫成不存在的合併關係。

### 4.6 分支管理與比較

```text
+------------------------------------------------------------------------------------------------+
| BRANCHES                                                             [+ New branch] [Filter]   |
+-----------------------+------------------------------------------------------------------------+
| LOCAL                 | Base:    [main                  v]                                     |
| * main                | Compare: [feature/login         v]                          [Swap]     |
|   develop             |                                                                        |
|   feature/login       | Compare is 3 ahead / 1 behind Base                                     |
|                       | [Commits] [Files changed: 6]                                           |
| REMOTE                | ---------------------------------------------------------------------- |
| v origin              | o Add login validation                   You                 10:42     |
|   main                | o Add login form                         You                 09:30     |
|   develop             | o Add auth service                       Alice               Yesterday |
|                       |                                                                        |
|                       | Target main <- Source feature/login                                    |
|                       | [Merge into main] [Rebase feature/login onto main]                      |
+-----------------------+------------------------------------------------------------------------+
```

Base...Compare 表示 merge-base 到 Compare 的差異；端點比較 Base..Compare 另提供明確切換。按鈕旁顯示實際 target/source。僅做比較不保證合併不衝突；本工具不顯示未經驗證的「無衝突」承諾。

### 4.7 衝突解決

```text
+------------------------------------------------------------------------------------------------+
| RESOLVE CONFLICTS / Merge feature/login -> main                                [Abort merge]    |
+------------------+-------------------------------------------------------+---------------------+
| FILES            | login.ts                                              | RESOLUTION          |
| ! login.ts       +------------------+------------------+-------------------+ 1 / 3 files done    |
| ! settings.ts    | BASE             | STAGE 2          | STAGE 3           |                     |
| + README.md      | timeout = 30;    | timeout = 60;    | timeout = 45;     | Conflict 1 / 2      |
|                  |                  | [Use this]       | [Use this]        |                     |
|                  +------------------+------------------+-------------------+ Operation: Merge    |
|                  | [Use both]                           [Previous] [Next] |                     |
|                  +-------------------------------------------------------+ [Save result]       |
|                  | RESULT                                                | [Mark resolved]     |
|                  | 21 function login() {                                 |                     |
|                  | 22   timeout = 60;                                    | 2 files remaining   |
|                  | 23 }                                                  | [Continue] disabled |
+------------------+-------------------------------------------------------+---------------------+
```

Stage 2／3 在 Rebase 時不能直接套用 Merge 的「我的／他人」標籤；標示來源提交與操作語境。三方內容缺失時明確顯示新增／刪除，而非空白即視為空檔。小視窗切換三方分頁，保留結果編輯器。

### 4.8 遠端、Stash 與設定

```text
+------------------------------------------------------------------------------------------------+
| REMOTES & SYNC                                                                   [+ Add remote] |
+-----------------------+------------------------------------------------------------------------+
| * origin              | origin: https://host/team/project.git                     [Edit]       |
|   upstream            | main <------------------------------------------> origin/main          |
|                       | +--------------------------------+ +--------------------------------+ |
|                       | | INCOMING: 2                    | | OUTGOING: 3                    | |
|                       | | o Update documentation         | | o Fix validation               | |
|                       | | o Fix timeout                  | | o Add form                     | |
|                       | |                                | | o Add auth                     | |
|                       | +--------------------------------+ +--------------------------------+ |
|                       | Pull strategy: [Merge v]                                               |
|                       | [Fetch] [Pull] [Push]                                                  |
|                       | Last fetched: 2 minutes ago                                            |
+-----------------------+------------------------------------------------------------------------+
```

Stash 畫面：左側列出名稱、建立時間、提交 OID；中央預覽檔案與 Diff；右側 Apply、Pop、Drop。設定畫面：左側分類，右側表單，分類包含外觀、Git、提交身分、工具、快捷鍵、通知與診斷。

### 4.9 所有畫面的共用狀態

| 狀態 | 行為 |
|---|---|
| 初次載入 | 骨架與階段文字，不閃現「無資料」 |
| 背景刷新 | 保留目前資料，顯示更新中 |
| 空狀態 | 說明原因與可執行的下一步 |
| 錯誤 | 顯示穩定錯誤碼、摘要、重試與詳細輸出 |
| 操作進行中 | 鎖定受影響動作，其餘唯讀導覽可用 |
| 檔案已改變 | 保留選取；拒絕套用舊 Diff，提示重新載入 |
| 網路不可用 | 本機功能正常，遠端動作失敗可重試 |
| 視窗縮小 | 次要面板收合，無內容重疊 |

## 5. 功能與操作規格

### 5.1 儲存庫管理（REPO）

- REPO-01：以系統資料夾對話框或拖曳開啟；透過 Git 驗證，不只檢查 .git 資料夾。
- REPO-02：記錄 worktree 根目錄、absolute gitdir、common gitdir；linked worktree 的 .git 可能是檔案。
- REPO-03：同一路徑重開時切到既有分頁；以 Windows 正規化路徑與檔案身分輔助去重。
- REPO-04：Clone 顯示 URL、目標父目錄與資料夾名稱；只接受空目標或不存在目標。失敗後不自動刪除可能由使用者建立的內容。
- REPO-05：Init 必須明示目標資料夾與預設分支；不自動建立首次提交。
- REPO-06：非 Git 目錄、bare repo、Git 不存在、dubious ownership 各有獨立提示；不自動全域加入 safe.directory。

### 5.2 變更、Diff 與暫存（CHANGE）

- CHANGE-01：顯示 staged／unstaged／untracked／conflicted；支援檔名搜尋、樹狀與平面清單、多選。
- CHANGE-02：文字 Diff 支援並排／單欄、空白忽略、行號、語法上色。忽略空白僅影響檢視；部分暫存必須使用完整原始 Diff。
- CHANGE-03：檔案暫存／取消暫存、全選操作；明示「全部」是否包含未追蹤檔案，不包含 ignored。
- CHANGE-04：支援完整 hunk 與逐行暫存；binary、rename、編碼不明、特殊 filter 檔案只提供整檔操作。
- CHANGE-05：捨棄 tracked 工作目錄變更與刪除 untracked 檔案分開命名。先顯示受影響路徑，再建立可驗證備份；備份失敗不得宣稱可還原。
- CHANGE-06：逐行暫存：由後端根據 diff token 與選取行重建 patch，不接受前端任意 patch 內容。
- CHANGE-07：UTF-8 無效或二進位資料不以替代字元覆寫；UTF-16／其他編碼本工具唯讀並提供外部工具。
- CHANGE-08：刪除、重新命名、CRLF、無末尾換行與空檔必須來源標示。

### 5.3 提交（COMMIT）

- 標題必填，空白 trim 後不得為空；標題長度為提示而非硬性阻擋。
- Commit 只提交 index；表單顯示實際暫存數，不自動 Stage all。
- Amend 顯示目前 HEAD 摘要；已推送判斷不可靠時明示會改寫提交，不暗示絕對安全。
- 支援沿用 Git signing 設定及本次簽署選項；簽署失敗保留草稿。
- Commit 訊息透過 stdin 傳給 git commit -F -；不拼接到 shell 或命令列訊息參數。
- 保留 Hook 與簽署行為，不默默加入 --no-verify。失敗顯示 Hook 輸出並重新讀取 index。
- Commit & Push 分為兩個任務；Commit 成功但 Push 失敗時，呈現本機提交已完成，重試只 Push。
- 無 staged 內容時一般 Commit 停用；Amend 改訊息可在有 HEAD 時使用。

### 5.4 歷史與圖譜（HISTORY）

- 預設由目前分支顯示，提供所有分支；每批 200 筆。
- 顯示 OID、parents、author、committer、日期、訊息、refs。
- 作者時間與提交時間分開，不以日期字串當唯一排序鍵。
- 開始查詢先固定 tip OID 集合；下一頁沿用 snapshot，refs 變動提示刷新。
- Merge commit 預設對第一個 parent 比較，可切換 parent；root commit 使用 empty tree 比較，不假設 SHA-1 固定長度。
- 搜尋 author、訊息、OID、路徑；Git pattern 預設採 literal／fixed string 語意，進階 regex 另設模式。
- detached HEAD 明確提示；從舊提交開新分支作為常用入口。

### 5.5 分支與合併（BRANCH）

- 建立／切換／重新命名／刪除分支；名稱由 git check-ref-format 驗證。
- 切換有未提交變更時先提供取消、手動 Stash 或在 Git 允許時保留；不得默默 stash/pop。
- 刪除目前或其他 worktree 使用中的分支不得直接執行；刪除未合併分支顯示影響並要求明確選擇。
- Merge 前顯示 current target、source OID、dirty 狀態與選定策略。提供一般 Merge、No-FF、Squash。
- Squash 不立即 Commit；成功後回 Changes 顯示已暫存結果與提交草稿。
- 一般 Rebase 僅對目前分支執行，進行中提供 Continue／Skip／Abort；Skip 顯示將跳過的提交。
- Interactive Rebase 使用圖形清單編輯 pick、reword、squash、fixup、drop 與提交順序，透過 sequence editor 與 message editor 將結果交給 Git。

### 5.6 同步與驗證（SYNC）

- Fetch、Pull、Push 指定 remote 與 ref，不將工具列操作解讀為所有遠端。
- Pull UI 明確選 Merge／Rebase／FF-only；內部以 Fetch＋重新比較＋整合任務執行，避免狀態過期。
- 顯示 outgoing／incoming 時附上最後 Fetch 時間；upstream 不存在時顯示未設定，而非 0／0。
- Push 非快轉失敗後只提供 Fetch 與重新比較，不自動 force。
- 強制推送為進階操作，使用 --force-with-lease=<ref>:<reviewedOid>，確認畫面帶入檢視時的遠端 OID；遠端變動則失敗並重新審查。
- HTTPS 沿用 Git Credential Manager；SSH 沿用 agent 與既有設定。不將密碼送往前端日誌。
- 非互動背景 Git 設 GIT_TERMINAL_PROMPT=0；保留可正常運作的 GUI credential helper。
- 未知 SSH host 顯示指紋與明確接受／取消流程；可交由外部 SSH 設定，不關閉 host key 檢查、不自動寫 known_hosts。

### 5.7 衝突與中斷恢復（CONFLICT）

- 以 unmerged index 與 Git 操作狀態判斷，不只搜尋 conflict marker。
- 從 index stage 1／2／3 讀取 blob；不存在 stage 時顯示缺失版本。
- 文字結果保存前驗證檔案版本 token、編碼與換行設定。
- 「儲存結果」不等於「已解決」；Mark resolved 另行 git add 或 git rm，並重新掃描 unmerged entries。
- 未解決 index entries 尚存時禁用 Continue。對 marker 只做提示，不能當成唯一正確性判斷。
- add/add、modify/delete、rename、binary 衝突提供專用處理；binary 不顯示不可用的逐行合併按鈕。
- Rebase 顯示目前被重播提交與 stage 來源，避免 ours/theirs 語意誤導。
- Continue 與 Abort 後重新讀取 Git 狀態；非零退出但出現衝突視為 needsResolution，不是一般失敗。
- 啟動或重新聚焦時重建狀態：Merge、Rebase、Cherry-pick、Revert、Squash 待提交。同時辨識由外部 Git 建立的進行中狀態。

### 5.8 Stash、標籤與工具

- Stash 建立、名稱、是否含 untracked、預覽、Apply／Pop／Drop；不預設包含 ignored。
- Stash 以 OID 識別，執行前重新解析 stash@{n} 對應，避免清單順序變動造成刪錯。
- Pop 遇衝突保留 stash，顯示實際結果；Drop 前顯示內容摘要。
- 標籤支援列出、定位、建立 lightweight／annotated tag、推送與本機／遠端刪除；簽署由 Git 執行。
- 外部編輯器使用程式路徑＋參數陣列，不使用可任意插值的 shell 範本。
- 提供外部 Windows Terminal 與嵌入式終端機；嵌入式終端機使用 ConPTY 後端與 @xterm/xterm 前端。


### 5.9 進階功能實作

| 功能 | 畫面與程式內容 |
|---|---|
| Interactive Rebase | 提交清單拖曳排序、動作下拉選單、訊息編輯；開始點解析為 OID，產生 todo，執行 rebase -i；衝突接回共同恢復畫面 |
| Cherry-pick | 選取提交依序套用，支援多筆；遇衝突顯示目前提交，提供 Continue／Skip／Abort |
| Revert | 以新提交反轉既有變更；Merge commit 顯示 parent 選擇，傳遞對應 mainline |
| 檔案歷史 | 依路徑列出提交，可選 follow rename；點選版本顯示 Diff，還原時只修改指定檔案 |
| Blame | 使用 git blame --line-porcelain，顯示每行提交、作者與時間，點擊跳至提交詳情 |
| 圖片 Diff | before／after、並排、滑桿與透明背景棋盤格；只解碼支援格式，限制圖片尺寸 |
| Worktree | 使用 git worktree list --porcelain 取得清單，提供 add、open、remove、prune；remove 顯示 dirty 狀態 |
| 子模組 | 顯示 gitlink OID、工作目錄狀態、初始化／更新／同步 URL，支援另開儲存庫分頁 |
| LFS | 偵測 git lfs version，顯示 track patterns 與物件狀態，提供 track／untrack、fetch／pull；修改 .gitattributes 列入一般變更 |
| 嵌入式終端機 | ConPTY 建立 shell session；@xterm/xterm 與 @xterm/addon-fit 呈現；透過受控事件傳送輸出，輸入與 resize 綁定 sessionId |

#### Interactive Rebase 的編輯器橋接

Go 產生暫存 todo 與訊息內容，另建小型 editor helper 執行檔。使用 GIT_SEQUENCE_EDITOR 與 GIT_EDITOR 指向受控 helper，helper 只讀取指定 session 的檔案與 IPC 結果，不組合使用者命令。Go 將 UI 選定的提交動作寫回 Git 指定檔案。取消編輯回傳非零退出碼；Rebase 已開始後，取消任務與 Abort 是兩個不同動作。Root rebase、merge commit 保留與 autosquash 分別呈現選項。

#### 進階畫面

```text
+-------------------------------------------------------------------------------------+
| INTERACTIVE REBASE                        Branch: feature/login   Onto: main         |
+-------------------------------------------------------------------------------------+
| ORDER | ACTION       | COMMIT  | MESSAGE                                              |
|   1   | [pick     v] | a1b2c3d | Add login form                                       |
|   2   | [squash   v] | b2c3d4e | Add validation                                       |
|   3   | [reword   v] | c3d4e5f | Fix labels                                           |
|                                                                                     |
| Drag rows to reorder                          [Cancel] [Start rebase]                |
+-------------------------------------------------------------------------------------+
| WORKTREES / SUBMODULES / LFS 以獨立導覽項目與詳情面板呈現                             |
+-------------------------------------------------------------------------------------+
```

## 6. Git 執行與資料解析

### 6.1 Runner 介面

```go
type CommandSpec struct {
    RepoID        string
    Args          []string
    Stdin         []byte
    ReadOnly      bool
    Timeout       time.Duration
    CaptureLimit  int64
}

type CommandResult struct {
    ExitCode int
    Stdout   []byte
    Stderr   []byte
}

type Runner interface {
    Run(ctx context.Context, spec CommandSpec) (CommandResult, error)
}
```

Args 只能由後端受控操作建立。對 UI 不公開 Runner。必要環境變數由白名單覆寫，不將整份環境或命令憑證寫入日誌。設定工作目錄為經驗證的根目錄；使用已解析的 git.exe 絕對路徑，變更執行檔設定後需重新檢查。

### 6.2 常用命令映射

下列是參數語意規格，不是可直接拼接使用者輸入的 shell 範本。<...> 均須經驗證；path 使用 literal pathspec 與 `--`，不能只靠 `--` 防止 pathspec magic。

| 用途 | 命令／策略 |
|---|---|
| 偵測 | git --version；git rev-parse --show-toplevel；--absolute-git-dir；--git-common-dir |
| 狀態 | git --no-optional-locks status --porcelain=v2 -z --branch --untracked-files=all |
| unstaged Diff | git diff --no-ext-diff --no-textconv --no-color -- <path> |
| staged Diff | git diff --cached --no-ext-diff --no-textconv --no-color -- <path> |
| 暫存 | git --literal-pathspecs add -- <paths> |
| 取消暫存 | git --literal-pathspecs restore --staged -- <paths>；unborn HEAD 使用獨立 index 移除流程 |
| 捨棄 tracked | 備份並確認後 git --literal-pathspecs restore --worktree -- <paths> |
| 歷史 | git log --topo-order 搭配固定 tips、自訂 NUL 欄位與有界批次 |
| refs | git for-each-ref 搭配明確 format，不解析彩色人類輸出 |
| 分支驗證 | git check-ref-format --branch <name> |
| 建立分支 | git branch <name> <resolvedOid> |
| 切換 | git switch <validatedBranch> |
| 提交 | git commit -F -；Amend 額外加 --amend |
| 領先落後 | git rev-list --left-right --count <localOid>...<upstreamOid> |
| Fetch | git fetch --progress <validatedRemote> |
| Push | git push --progress <validatedRemote> <explicitRefspec> |
| 衝突 entries | git ls-files -u -z |
| 讀取物件 | git cat-file；使用已驗證 OID／受控 index stage 查詢 |
| 操作狀態路徑 | git rev-parse --git-path <knownStateName> |

read-only 需要完整讀寫分離判斷；不是所有「看起來是查詢」的 Git 子命令都無副作用。Git 返回的所有 OID 視為不透明完整字串，不寫死 40 字元。

### 6.3 輸出解析

1. stdout、stderr 分開且並行讀取，防止 pipe deadlock；進度可能使用 carriage return 而非換行。
2. path 類輸出使用 NUL 分隔；不可用 strings.Fields 解析檔名。
3. porcelain v2 分別解析 ordinary、rename/copy、unmerged、untracked 與 header；rename 的第二路徑須依格式獨立讀取。
4. 原始路徑與顯示字串分離。無法無損映射至 Windows 路徑時停用寫入並回報，不以替代字元形成新路徑。
5. Diff 解析同時保留原始 patch 與結構化 hunk；視覺行號不能取代 patch 座標。
6. 輸出大小有上限：一般錯誤輸出保留末尾 1 MiB 並標示截斷；大型內容使用有界讀取／分頁，不先全部存入記憶體。
7. 錯誤分類以退出碼、操作、前後狀態為主；stderr 文字比對僅輔助，不依賴英文錯誤字串唯一判斷。

### 6.4 部分暫存演算法

- 回傳 Diff 時產生 diffToken，綁定 repo、path、index blob、worktree 內容雜湊與檢視模式。
- 前端只傳 token、hunk ID／line ID；後端重新驗證 snapshot。
- 完整 hunk 直接選取；逐行暫存重建部分選取 patch，正確調整 context 與 hunk counts。
- 暫存：git apply --cached --check，通過後 git apply --cached；取消暫存使用對應 staged patch 與 --reverse，並同樣先執行 --check。
- check 與 apply 必須在同一應用寫鎖內；外部 Git 仍可能競爭，apply 失敗不重試修改後的內容，重新載入 Diff。
- CRLF／attributes／filter 特殊案例若不能保證正確，退回整檔暫存，明示原因。
- 所有 patch 都經 stdin 傳遞；不開啟 --unsafe-paths，不修改使用者 gitconfig 以求套用成功。

## 7. 資料模型與 API

### 7.1 共用型別

下列 TypeScript 為語意契約；Go DTO 使用相同 JSON 欄位，生成的 Wails 型別是實作時的介面依據。

```ts
type RepoId = string;
type TaskId = string;
type Oid = string;
type OperationState =
  | 'normal' | 'merging' | 'rebasing' | 'cherryPicking'
  | 'reverting' | 'squashPending' | 'unknown';

interface Repository {
  id: RepoId;
  name: string;
  rootPath: string;
  gitDir: string;
  commonDir: string;
  headOid?: Oid;
  branch?: string;                 // detached / unborn 必須另外處理
  detached: boolean;
  unborn: boolean;
  upstream?: string;
  operation: OperationState;
  revision: number;
}

interface FileChange {
  id: string;
  path: string;
  originalPath?: string;
  indexStatus: string;
  worktreeStatus: string;
  kind: 'tracked' | 'untracked' | 'conflicted' | 'submodule';
  binary?: boolean;
}

interface DiffDocument {
  token: string;
  path: string;
  side: 'staged' | 'unstaged' | 'commit';
  oldContent?: string;
  newContent?: string;
  hunks: DiffHunk[];
  binary: boolean;
  truncated: boolean;
  partialStageAllowed: boolean;
  encoding: string;
  eol: 'LF' | 'CRLF' | 'mixed' | 'unknown';
}
interface DiffHunk {
  id: string;
  oldStart: number; oldCount: number;
  newStart: number; newCount: number;
  lines: Array<{ id: string; kind: 'context' | 'add' | 'delete'; text: string }>;
}
interface Commit {
  oid: Oid;
  parents: Oid[];
  author: { name: string; email: string; timestamp: string };
  committer: { name: string; email: string; timestamp: string };
  subject: string;
  message?: string;
  refs: string[];
}
interface AppError {
  code: string;
  message: string;
  detail?: string;                 // 已去敏
  retryable: boolean;
  taskId?: TaskId;
}
type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: AppError };
```

Go 不直接使用泛型 Result 作為對外綁定型別；每個回應建立具體 struct，交由 frontend/bridge 正規化成 Result<T>，避免生成器支援差異。bridge 也捕捉 Wails 呼叫的 reject，轉成穩定錯誤。

### 7.2 公開 API

所有方法的輸入 DTO 欄位均後端驗證。repoId 必須對應本次 session 已開啟的儲存庫；不讓前端每次指定任意工作目錄。長任務立即回傳 taskId。

| Facade.Method | 主要輸入 | 回傳 data |
|---|---|---|
| AppAPI.GetEnvironment | 無 | Git／WebView2／工具版本與能力 |
| RepoAPI.PickAndOpen | 無 | Repository；取消為成功但無選取 |
| RepoAPI.Open | path | Repository |
| RepoAPI.ListRecent | 無 | 最近專案摘要 |
| RepoAPI.Close | repoId | 關閉結果 |
| RepoAPI.Init | path、initialBranch | taskId |
| RepoAPI.Clone | url、parentPath、directoryName | taskId |
| RepoAPI.GetStatus | repoId | Repository＋FileChange[] |
| ChangeAPI.GetDiff | repoId、fileId、side | DiffDocument |
| ChangeAPI.StageFiles | repoId、fileIds、expectedRevision | taskId |
| ChangeAPI.UnstageFiles | 同上 | taskId |
| ChangeAPI.StageHunks | repoId、diffToken、hunkIds | taskId |
| ChangeAPI.UnstageHunks | 同上 | taskId |
| ChangeAPI.PrepareDiscard | repoId、fileIds | 影響摘要＋短效 confirmationToken |
| ChangeAPI.Discard | confirmationToken | taskId |
| CommitAPI.Commit | repoId、message、amend、sign、expectedIndexToken | taskId |
| HistoryAPI.List | repoId、filters、cursor?、limit | commits、snapshotId、nextCursor? |
| HistoryAPI.GetCommit | repoId、oid | Commit＋files |
| HistoryAPI.Compare | repoId、base、compare、mode | commits／files 摘要 |
| BranchAPI.List | repoId | 本機／遠端分支與 worktree 使用狀態 |
| BranchAPI.Create | repoId、name、startOid | taskId |
| BranchAPI.Switch | repoId、name | taskId |
| BranchAPI.Rename | repoId、oldName、newName | taskId |
| BranchAPI.Delete | repoId、name、force、confirmationToken? | taskId |
| BranchAPI.Merge | repoId、sourceOid、strategy、expectedHead | taskId |
| BranchAPI.Rebase | repoId、ontoOid、expectedHead | taskId |
| SyncAPI.ListRemotes | repoId | remote 設定 |
| SyncAPI.UpdateRemote | repoId、name、fetchUrl、pushUrl? | taskId |
| SyncAPI.Fetch | repoId、remote | taskId |
| SyncAPI.Pull | repoId、remote、branch、strategy | taskId |
| SyncAPI.Push | repoId、remote、sourceRef、targetRef、lease? | taskId |
| ConflictAPI.List | repoId | 衝突檔案與進行中操作 |
| ConflictAPI.GetVersions | repoId、fileId | stage 內容、來源與版本 token |
| ConflictAPI.SaveResult | repoId、fileId、versionToken、content | 新版本 token |
| ConflictAPI.Resolve | repoId、fileId、versionToken、resolution | taskId |
| OperationAPI.Continue | repoId、expectedOperation | taskId |
| OperationAPI.Abort | repoId、expectedOperation | taskId |
| OperationAPI.Skip | repoId、expectedOperation、confirmationToken | taskId |
| StashAPI.List／Preview | repoId、stashOid? | stash 清單／Diff |
| StashAPI.Create | repoId、message、includeUntracked | taskId |
| StashAPI.Apply／Pop／Drop | repoId、stashOid、confirmationToken? | taskId |
| TaskAPI.Get／List | taskId／repoId | Task／Task[] |
| TaskAPI.Cancel | taskId | 取消請求受理結果 |
| SettingsAPI.Get／Save | 設定 DTO | 設定／驗證結果 |
| DraftAPI.Get／Save | repoId、草稿? | 草稿／儲存結果 |
| ToolAPI.OpenEditor／OpenTerminal | repoId、fileId? | 啟動結果 |
| DiagnosticsAPI.Export | 使用者選擇的輸出位置 | 去敏後報告路徑 |

confirmationToken 由後端產生，綁定操作、路徑／ref、snapshot、失效時間；執行時重驗。它確保確認內容與實際動作一致，不是使用者身分認證機制。詳細輸入與回應使用具名 DTO，讓 Wails 產生可供前端使用的型別。

### 7.3 錯誤碼

至少包含：GIT_NOT_FOUND、UNSUPPORTED_GIT、NOT_REPOSITORY、BARE_REPOSITORY、REPOSITORY_BUSY、STALE_STATE、STALE_DIFF、INVALID_REF、INVALID_PATH、UNMERGED_FILES、AUTH_REQUIRED、HOST_KEY_REQUIRED、NETWORK_ERROR、NON_FAST_FORWARD、LEASE_REJECTED、HOOK_FAILED、SIGNING_FAILED、OUTPUT_TOO_LARGE、CANCELLED、TIMEOUT、IO_ERROR、INTERNAL_ERROR。

錯誤文案本地化，code 保持穩定；不可把所有非零退出統一顯示為「Git 失敗」。needsResolution 為任務結果狀態，攜帶可繼續的 operation。


### 7.4 進階 API

| Facade.Method | 輸入 | 回傳 |
|---|---|---|
| RebaseAPI.GetPlan／Start | repoId、ontoOid、entries、options | 計畫／taskId |
| CommitAPI.CherryPick／Revert | repoId、oids、mainline? | taskId |
| FileAPI.History／Blame | repoId、path、revision、cursor? | 提交頁／行級註記 |
| FileAPI.RestoreVersion | repoId、path、oid、confirmationToken | taskId |
| TagAPI.List／Create／Delete／Push | repoId、tag DTO | 清單／taskId |
| WorktreeAPI.List／Add／Remove／Prune | repoId、worktree DTO | 清單／taskId |
| SubmoduleAPI.List／Init／Update／Sync | repoId、paths、recursive | 清單／taskId |
| LfsAPI.Status／Track／Untrack／Fetch／Pull | repoId、patterns?、remote? | 狀態／taskId |
| TerminalAPI.Create | repoId、shellProfile、cols、rows | sessionId |
| TerminalAPI.Write／Resize／Close | sessionId、data／cols／rows | 執行結果 |

Terminal 事件為 terminal:output、terminal:exit，均攜帶 sessionId 與 sequence；輸出有背壓與有界緩衝，隱藏分頁不無限累積資料。終端機是使用者明確開啟的互動 shell，不與 Git 任務 Runner 共用任意命令入口。

## 8. 事件、背景任務與並行

### 8.1 任務模型

```ts
interface Task {
  id: TaskId;
  repoId?: RepoId;                  // Clone 完成前可能尚未有 repo
  kind: string;
  status: 'queued' | 'running' | 'cancelling' | 'succeeded'
        | 'failed' | 'cancelled' | 'needsResolution';
  phase: string;
  message: string;
  percent?: number;                 // 無可靠進度時省略
  canCancel: boolean;
  startedAt?: string;
  finishedAt?: string;
  error?: AppError;
}
```

狀態：queued → running → succeeded／failed／needsResolution；可取消時 running → cancelling → cancelled。取消只代表停止程序，不代表回滾，取消後必須重新掃描 Git 狀態。需要解決衝突時任務結束，但 operation 仍持續。

### 8.2 事件契約

| 名稱 | payload | 前端處理 |
|---|---|---|
| repository:changed | repoId、revision、scopes[] | 失效指定 query |
| task:progress | taskId、repoId?、sequence、phase、percent?、message | 更新任務列 |
| task:completed | taskId、repoId?、sequence、status、result? | 查詢最終任務與狀態 |
| task:failed | taskId、repoId?、sequence、error | 顯示錯誤與日誌入口 |
| environment:changed | capabilities | 更新可用操作 |

先建立全域 listener，再允許啟動任務；taskId 回傳後仍呼叫 TaskAPI.Get，避免非常快的任務事件早於畫面訂閱。事件可能丟失，重新聚焦與啟動時以 GetStatus／TaskAPI 為準。React effect cleanup 取消 listener，不用全域 EventsOff 誤刪其他元件訂閱。

### 8.3 鎖與併發

- 每個 common gitdir 設共用寫鎖；保守序列化同一儲存庫所有 app 寫入，包括不同 worktree。
- 唯讀任務最多同時 2 個／儲存庫；全域 Git 程序預設上限 4，均可由實測調整。
- 長查詢執行時固定 OID；狀態型查詢若 revision 已過期不得覆蓋較新的結果。
- Git 原生 index.lock 等鎖仍由 Git 管理；應用鎖無法阻止外部工具。鎖衝突時提示重試，不自動刪除 .lock。
- Watcher 事件 300 ms debounce、連續變動最多 2 秒觸發一次重掃；app 寫入結束另強制刷新。
- fsnotify 不提供自動遞迴監控；對已追蹤目錄與 gitdir 建立 watch，新增目錄更新 watch。資源超限時退回焦點刷新＋可見分頁每 5 秒輪詢，並顯示降級狀態。

### 8.4 Windows 取消與程式關閉

使用 Windows Job Object 管理 Git 程序樹。實作必須驗證程序指派時機與 child 派生競態，必要時以 suspended 建立再指派 Job 後 resume；若無法確保，該操作不宣稱可完整取消。終止前提供可用的溫和中斷；逾時再終止整個 Job。

關閉程式時列出仍在寫入的任務，預設等待；使用者明確選擇停止後才取消。Hook／簽署／credential helper 可能衍生外部程序，納入程序樹管理，不在程序未結束時先釋放儲存庫寫鎖。

## 9. 儲存、驗證與安全

### 9.1 本機資料

```text
%APPDATA%\GitWorkspace\
  settings.json
  recent-repositories.json
  workspace.json
  drafts\<repository-key>.json

%LOCALAPPDATA%\GitWorkspace\
  logs\
  cache\
  backups\
  webview2\
```

repository-key 由 canonical root／gitdir 雜湊生成，不使用資料夾名稱作唯一鍵。RepoId 是執行期 opaque ID；重啟以持久 repository-key 找回草稿。設定含 schemaVersion，以同資料夾暫存檔＋原子替換寫入；遷移前保留備份，損壞時隔離原檔並提示。

草稿區分一般 Commit 與 Amend；不因 Git 命令失敗清空。日誌預設 7 天或 100 MiB 上限，先到者淘汰。捨棄備份 30 天且預設 1 GiB 配額；新備份超限時要求處理空間，不能先刪掉仍在保留期的唯一還原來源再執行破壞操作。

### 9.2 備份與還原

- 檔案捨棄前保存原始 bytes、相對路徑、權限／屬性摘要、時間與內容雜湊；index 變更另保存可識別 snapshot。
- 只對實際成功備份的操作顯示還原入口；還原前檢查目前內容是否又被修改，不覆寫新工作。
- 改寫歷史前可建立帶時間的備份 ref；它只能保護提交，不能保護尚未提交的檔案。
- 刪除未追蹤檔案需驗證 path／reparse point，不沿符號連結遞迴刪除儲存庫外資料。

### 9.3 信任與敏感資訊

- Repo path、檔案路徑、ref、remote、URL 都是未信任輸入。驗證路徑屬於 worktree；對 junction／symlink 做最終位置檢查。
- 開啟不熟悉的儲存庫時提供信任狀態；未信任預設唯讀。Hook、filter、簽署與 credential helper 可能執行本機程式，首次授權寫入需清楚說明。
- 唯讀 Diff 禁用外部 diff 與 textconv；不能以開啟預覽為由執行任意工具。
- Commit 訊息、檔名與內容透過文字元件呈現，不作 HTML／Markdown 執行；不載入遠端提交中的圖片或腳本。
- Git URL 拒絕內嵌密碼並提供憑證設定入口；Clone 的 protocol／remote helper 僅允許已驗證的 HTTPS、SSH 與明確選擇的本機路徑，拒絕 ext 等任意 helper 入口。
- 預設無遙測；診斷匯出不包含程式碼、完整環境變數或 credential。路徑、Email 與 remote URL 可由使用者選擇遮蔽。
- Wails 綁定只暴露受控 facade。正式版限制外部導覽、資源來源與 CSP；禁止載入不受信任遠端頁面取得 bridge 權限。

## 10. Windows 11 整合

### 10.1 視窗與系統功能

- WebView2 安裝檢查與缺少 runtime 的可理解處理；使用 Wails v2 的 WebView2 部署設定。
- 原生標題列、最大化、最小化、Snap Layouts、Alt+F4、多螢幕與工作列。
- DPI 100%、125%、150%、200%；跨螢幕拖曳後字體與面板正常。
- 深淺色跟隨系統；高對比與減少動態效果。
- 系統資料夾對話框；在檔案總管顯示；外部編輯器與終端機。
- 視窗位置恢復前確認仍在可見螢幕範圍；螢幕移除後不讓視窗消失。

### 10.2 外觀與桌面整合

Jump List、檔案總管右鍵入口、通知、Mica／Acrylic、自訂標題列。透明背景與 Mica 不保證等於原生 WinUI 元件；由系統能力與高對比狀態決定是否啟用透明效果。不得以 Wails v3 多視窗或標題列 API 作為 v2 已可用功能。

### 10.3 快捷鍵

| 快捷鍵 | 動作 |
|---|---|
| Ctrl+O | 開啟儲存庫 |
| Ctrl+P | 搜尋檔案／提交 |
| Ctrl+Shift+P | 命令面板 |
| Ctrl+Enter | 在提交面板提交；其他畫面不觸發 |
| Ctrl+Tab／Ctrl+Shift+Tab | 切換儲存庫分頁 |
| Ctrl+1／2／3 | Changes／History／Branches |
| F5 | 刷新目前儲存庫 |
| Esc | 關閉選單／對話框；不默默丟棄草稿 |

編輯器焦點下優先保留編輯快捷鍵；危險操作不設定單鍵快捷鍵。

## 11. 大型資料與可及性實作

- 提交歷史每批 200 筆，固定 tip snapshot，搭配虛擬清單與 SVG lane 延續。
- 文字檔超過 2 MiB 或 2 萬行時先顯示大型檔案摘要，提供有限度載入與外部工具入口。
- 二進位不傳入 Monaco；圖片另使用受限解碼路徑。
- Monaco model 依 repo、path、side、revision 生成 URI，使用 LRU 回收；分頁關閉時釋放 editor、listener 與 worker 資源。
- Query key 包含 repoId、revision、篩選與比較來源；過期結果不覆蓋新狀態。
- 圖譜有等價提交清單，所有狀態提供文字與圖示，焦點清楚可見。
- 鍵盤可操作導覽、檔案、Diff、提交與衝突結果；編輯器焦點下保留文字編輯快捷鍵。
- 文字縮放、螢幕閱讀器、高對比與減少動態效果由共用 UI 元件統一處理。

