# AGENTS.md

本文件提供 AI coding agents 在這個 repository 工作時的必要資訊。

## 專案概覽

PuffGittt 是 Windows-first 的 Git 桌面工作台：

- Backend：Go 1.27 + Wails v2.17
- Frontend：React 19 + TypeScript + Vite + Fluent UI v9
- State / data：Zustand + TanStack Query
- Editor：Monaco Editor
- UI 語言：繁體中文 / English，Git 術語通常保留英文

Wails 將 Go API 綁定到 frontend，桌面程式使用 `frontend/dist` 內嵌資產；瀏覽器開發模式則使用 mock bridge。

## 常用指令

```powershell
# 桌面開發（自動啟動 Vite + Go）
wails dev

# 只開發 frontend（使用 src/bridge/mock.ts）
cd frontend
npm run dev

# Frontend typecheck + production build
cd frontend
npm run build

# 重新打包 Windows exe
wails build
# 輸出：build/bin/puffgittt.exe

# Go 測試
go test ./...
```

完成變更前至少執行：

1. `go test ./...`
2. `cd frontend; npm run build`

若使用者要求可執行檔或「重新打包」，再執行 `wails build`。

## 目錄結構

```text
main.go                         Wails app 啟動與 API binding
app.go                          Window / theme 等主程式 API
internal/api/service.go         Service 與各 API struct（AppAPI、RepoAPI、...）
internal/git/                   Git command runner 與各項操作
internal/model/model.go         Go DTO（與 frontend types 對應）
internal/config/                settings.json、recent repos、路徑設定
internal/platform/              Windows / 其他平台整合

frontend/src/App.tsx            App shell、tabs、queries、layout
frontend/src/bridge/api.ts      Frontend 呼叫 Go API 的唯一入口
frontend/src/bridge/mock.ts     瀏覽器開發用 mock API
frontend/src/views/             各功能頁面
frontend/src/components/        Sidebar、TitleBar、DiffEditor 等
frontend/src/store.ts           Zustand app state
frontend/src/types.ts           Frontend DTO
frontend/src/i18n.ts            zh-TW / en 翻譯
frontend/src/styles.css         全域樣式（單一 CSS 檔）
```

## Backend 慣例

- Git 操作集中在 `internal/git`，透過 `Runner` 以參數陣列執行 Git，不要用 shell 字串拼接。
- 需要使用者 Git path 設定的地方使用 `s.runnerWithSettings()`。
- 需要保護同一 repo 的寫入操作時使用 `s.repoLock(root)`。
- 新增 API：
  1. 在對應的 `internal/api` struct 增加 exported method。
  2. 在 `internal/model/model.go` 定義／更新 DTO。
  3. 若需要新的 API struct，於 `main.go` 建立並加入 `Bind` 清單。
  4. 更新 `frontend/src/bridge/api.ts`。
  5. 更新 `frontend/src/bridge/mock.ts`，否則瀏覽器開發模式會失敗。
  6. 同步更新 `frontend/src/types.ts`。
- 錯誤訊息回傳時盡量保留 Git 的 stderr / output，讓 UI 能顯示實際失敗原因。
- 不要更動使用者的 repo 做測試；測試請建立暫存 repo。
- Windows-first：使用 `filepath`、處理 `\` 路徑，不要假設 Unix shell 行為。

## Frontend 慣例

- 使用 Fluent UI v9 components 與 `@fluentui/react-icons`，不要引入其他 UI framework。
- 頁面放在 `src/views`，可重用元件放在 `src/components`。
- 不使用 i18n 介面直接使用繁體中文
- 狀態訊息使用 `useAppStore.setStatusMessage()`，不要用 `alert` 顯示一般結果；破壞性操作才使用 `window.confirm`。
- TanStack Query key 要保持一致，例如：
  - `["status", root]`
  - `["branches", root]`
  - `["history", root]`
  - `["remotes", root]`
  - `["workspaceRepositories"]`
- 新增 query key 時，記得同步更新 `App.tsx` 的 `invalidateRepo()` 或該 view 的 invalidation。
- 所有 API 呼叫都經由 `src/bridge/api.ts`，不要在元件直接呼叫 `window.go`。
- 樣式集中在 `src/styles.css`，沿用既有 CSS variables 與 class 命名。
- UI 字級：主要文字 `0.875rem`（14px）、次要文字 `0.8125rem`（13px）、標題 `1rem`（16px）；未指定時使用主要字級，輸入框 placeholder 使用次要字級。
- 圖示-only 按鈕需要 `aria-label` 與 Tooltip；需保留 git 英文術語。Branches 工具列使用 `data-tooltip` + CSS 的 `span.branch-icon-button`，避免 Fluent Tooltip 在 disabled / 密集圖示按鈕上閃爍；新增同類工具列請沿用這個模式。


## 測試與驗證

- 目前沒有 frontend unit test framework；以 TypeScript build 與手動操作驗證為主。
- Go 測試位於 `internal/api/service_test.go`、`internal/git/git_test.go`。
- 修改 API contract 時，請同時檢查 Go tests、frontend mock 與 TypeScript types。
- 若變更涉及打包，執行 `wails build` 並確認 `build/bin/puffgittt.exe` 時間戳更新。

## 變更原則

- 保持變更聚焦，沿用現有結構與命名，不要為了小功能引入新依賴或新的 state library。
- 不要覆蓋或刪除使用者尚未提交的變更；遇到不明修改先詢問或保留。
