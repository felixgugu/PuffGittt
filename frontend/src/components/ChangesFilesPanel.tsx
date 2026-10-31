import { useEffect, useMemo, useRef, useState } from "react";
import { Checkbox, Spinner } from "@fluentui/react-components";
import {
  ChevronDown24Regular,
  ChevronLeft24Regular,
  ChevronRight24Regular,
  Document24Regular,
  Folder24Regular,
  FolderOpen24Regular,
  List24Regular,
  TextBulletListTree24Regular,
} from "@fluentui/react-icons";
import { useQuery } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { api } from "../bridge/api";
import { DiffEditor } from "./DiffEditor";
import { FileDiffDialog } from "./FileDiffDialog";
import { HunkStagingPanel } from "./HunkStagingPanel";
import type { FileChange, HunkSelection } from "../types";
import {
  allDirectoryPaths,
  fileHasStaged,
  fileHasUnstaged,
  filesUnderDirectory,
  filterFiles,
  flattenTree,
  type TreeFilter,
  type TreeRow,
} from "../lib/fileTree";
import { changeCode, fileStatusClass, fileStatusLabel } from "../lib/format";

type TabKey = "tracked" | "untracked";
type ViewMode = "tree" | "flat";

interface ChangesFilesPanelProps {
  root: string;
  trackedFiles: FileChange[];
  untrackedFiles: FileChange[];
  selectedPath?: string;
  busy?: boolean;
  onSelect: (file: FileChange, side: "staged" | "unstaged") => void;
  onStage: (files: FileChange[]) => Promise<boolean>;
  onUnstage: (files: FileChange[]) => Promise<boolean>;
  onDiscard: (files: FileChange[]) => Promise<boolean>;
  onApplyHunks: (
    file: FileChange,
    side: "staged" | "unstaged",
    patchHash: string,
    selections: HunkSelection[],
  ) => Promise<boolean>;
  onCollapse: () => void;
}

function loadExpanded(root: string, files: FileChange[]): Set<string> {
  try {
    const saved = localStorage.getItem(`puffgittt:changes-expanded:${root}`);
    if (saved) {
      return new Set(JSON.parse(saved) as string[]);
    }
  } catch {}
  return new Set(allDirectoryPaths(files));
}

function loadViewMode(root: string, tab: TabKey): ViewMode {
  try {
    return localStorage.getItem(`puffgittt:changes-mode:${root}:${tab}`) === "flat" ? "flat" : "tree";
  } catch {
    return "tree";
  }
}

export function ChangesFilesPanel({
  root,
  trackedFiles,
  untrackedFiles,
  selectedPath,
  busy,
  onSelect,
  onStage,
  onUnstage,
  onDiscard,
  onApplyHunks,
  onCollapse,
}: ChangesFilesPanelProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("tracked");
  const [filter, setFilter] = useState<TreeFilter>("all");
  const [modes, setModes] = useState<Record<TabKey, ViewMode>>(() => ({
    tracked: loadViewMode(root, "tracked"),
    untracked: loadViewMode(root, "untracked"),
  }));
  const [expanded, setExpanded] = useState<Set<string>>(() => loadExpanded(root, trackedFiles));
  const [initialized, setInitialized] = useState(() => trackedFiles.length > 0 || untrackedFiles.length > 0);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [dialogFile, setDialogFile] = useState<FileChange | null>(null);
  const [dialogSide, setDialogSide] = useState<"staged" | "unstaged">("unstaged");
  const [dialogSplit, setDialogSplit] = useState(false);
  const [dialogMaximized, setDialogMaximized] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const tabFiles = activeTab === "tracked" ? trackedFiles : untrackedFiles;
  const viewMode = modes[activeTab];

  useEffect(() => {
    if (initialized) return;
    if (trackedFiles.length === 0 && untrackedFiles.length === 0) return;
    setExpanded(loadExpanded(root, trackedFiles));
    setInitialized(true);
  }, [initialized, root, trackedFiles, untrackedFiles]);

  useEffect(() => {
    if (!initialized) return;
    try {
      localStorage.setItem(`puffgittt:changes-expanded:${root}`, JSON.stringify([...expanded]));
    } catch {}
  }, [expanded, initialized, root]);

  const visibleFiles = useMemo(
    () => (activeTab === "tracked" ? filterFiles(tabFiles, filter) : tabFiles),
    [activeTab, filter, tabFiles],
  );

  const rows = useMemo(() => {
    if (viewMode === "flat") {
      return [...visibleFiles]
        .sort((a, b) => a.path.localeCompare(b.path, "zh-Hant", { sensitivity: "base" }))
        .map<TreeRow>((file) => ({
          type: "file",
          name: file.path,
          path: file.path,
          depth: 0,
          file,
          status: changeCode(file),
        }));
    }
    return flattenTree(visibleFiles, expanded);
  }, [expanded, viewMode, visibleFiles]);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 29,
    overscan: 14,
  });

  const selectedFiles = tabFiles.filter((file) => checked.has(file.path));
  const canStage = selectedFiles.some((file) => activeTab === "untracked" || fileHasUnstaged(file));
  const canUnstage = activeTab === "tracked" && selectedFiles.some(fileHasStaged);
  const canDiscard = activeTab === "tracked" && selectedFiles.length > 0;

  const sideFor = (file: FileChange): "staged" | "unstaged" => {
    if (activeTab === "untracked") return "unstaged";
    if (filter === "staged") return "staged";
    if (filter === "unstaged") return "unstaged";
    return fileHasUnstaged(file) ? "unstaged" : "staged";
  };

  const dialogFiles = useMemo(
    () =>
      rows
        .filter((row) => !!row.file)
        .map((row) => ({ file: row.file!, side: sideFor(row.file!) })),
    [rows, activeTab, filter],
  );
  const dialogIndex = dialogFile ? dialogFiles.findIndex((entry) => entry.file.path === dialogFile.path) : -1;

  const dialogDiff = useQuery({
    queryKey: ["change-dialog-diff", root, dialogFile?.path, dialogSide],
    queryFn: () => api.change.getDiff(root, dialogFile!.path, dialogSide, ""),
    enabled: !!dialogFile,
  });

  useEffect(() => {
    if (dialogFile && !tabFiles.some((file) => file.path === dialogFile.path)) {
      setDialogFile(null);
      setDialogMaximized(false);
    }
  }, [dialogFile, tabFiles]);

  const openDiff = (file: FileChange) => {
    setDialogFile(file);
    setDialogSide(sideFor(file));
    setDialogSplit(false);
    setDialogMaximized(true);
  };

  const closeDialog = () => {
    setDialogFile(null);
    setDialogMaximized(false);
  };

  const selectDialogFile = (file: FileChange) => {
    setDialogFile(file);
    setDialogSide(sideFor(file));
  };

  const showPrevious = () => {
    if (dialogIndex > 0) {
      const entry = dialogFiles[dialogIndex - 1];
      setDialogFile(entry.file);
      setDialogSide(entry.side);
    }
  };

  const showNext = () => {
    if (dialogIndex >= 0 && dialogIndex < dialogFiles.length - 1) {
      const entry = dialogFiles[dialogIndex + 1];
      setDialogFile(entry.file);
      setDialogSide(entry.side);
    }
  };

  const visiblePaths = visibleFiles.map((file) => file.path);
  const allVisibleChecked = visiblePaths.length > 0 && visiblePaths.every((path) => checked.has(path));
  const someVisibleChecked = visiblePaths.some((path) => checked.has(path));

  const setCheckedFor = (paths: string[], value: boolean) => {
    setChecked((current) => {
      const next = new Set(current);
      paths.forEach((path) => (value ? next.add(path) : next.delete(path)));
      return next;
    });
  };

  const clearChecked = (paths: string[]) => {
    setChecked((current) => {
      const next = new Set(current);
      paths.forEach((path) => next.delete(path));
      return next;
    });
  };

  const applySelected = async (files: FileChange[], action: (files: FileChange[]) => Promise<boolean>) => {
    if (!files.length) return;
    const ok = await action(files);
    if (ok) clearChecked(files.map((file) => file.path));
  };

  const stageSelected = () => {
    const files = selectedFiles.filter((file) => activeTab === "untracked" || fileHasUnstaged(file));
    void applySelected(files, onStage);
  };

  const unstageSelected = () => {
    const files = selectedFiles.filter(fileHasStaged);
    void applySelected(files, onUnstage);
  };

  const discardSelected = () => {
    void applySelected(selectedFiles, onDiscard);
  };

  const toggleDir = (path: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const changeTab = (tab: TabKey) => {
    setActiveTab(tab);
    setChecked(new Set());
  };

  const changeFilter = (next: TreeFilter) => {
    setFilter(next);
    setChecked(new Set());
  };

  const changeMode = (mode: ViewMode) => {
    setModes((current) => ({ ...current, [activeTab]: mode }));
    try {
      localStorage.setItem(`puffgittt:changes-mode:${root}:${activeTab}`, mode);
    } catch {}
  };

  return (
    <section className="tree-panel">
      <div className="tree-heading">
        <div className="file-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "tracked"}
            className={`file-tab${activeTab === "tracked" ? " active" : ""}`}
            onClick={() => changeTab("tracked")}
          >
            檔案
            <span className="file-tab-count">{trackedFiles.length}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "untracked"}
            className={`file-tab${activeTab === "untracked" ? " active" : ""}`}
            onClick={() => changeTab("untracked")}
          >
            未追蹤
            <span className="file-tab-count">{untrackedFiles.length}</span>
          </button>
        </div>
        <div className="tree-heading-actions">
          <button
            type="button"
            className={`tree-mini-button${viewMode === "tree" ? " active" : ""}`}
            title="樹狀目錄"
            aria-pressed={viewMode === "tree"}
            onClick={() => changeMode("tree")}
          >
            <TextBulletListTree24Regular />
          </button>
          <button
            type="button"
            className={`tree-mini-button${viewMode === "flat" ? " active" : ""}`}
            title="平舖清單"
            aria-pressed={viewMode === "flat"}
            onClick={() => changeMode("flat")}
          >
            <List24Regular />
          </button>
          <button type="button" className="tree-mini-button" title="收合檔案面板" onClick={onCollapse}>
            <ChevronLeft24Regular />
          </button>
        </div>
      </div>

      <div className="tree-filters">
        <Checkbox
          className="tree-checkbox tree-select-all"
          checked={allVisibleChecked ? true : someVisibleChecked ? "mixed" : false}
          onChange={(_, data) => setCheckedFor(visiblePaths, data.checked === true)}
          label="全選"
        />
        {activeTab === "tracked" ? (
          <>
            <button type="button" className={`tree-filter${filter === "all" ? " active" : ""}`} onClick={() => changeFilter("all")}>
              全部
            </button>
            <button type="button" className={`tree-filter${filter === "staged" ? " active" : ""}`} onClick={() => changeFilter("staged")}>
              已暫存 <span>{trackedFiles.filter(fileHasStaged).length}</span>
            </button>
            <button type="button" className={`tree-filter${filter === "unstaged" ? " active" : ""}`} onClick={() => changeFilter("unstaged")}>
              未暫存 <span>{trackedFiles.filter(fileHasUnstaged).length}</span>
            </button>
          </>
        ) : null}
        <div className="tree-filter-spacer" />
      </div>

      <div className="tree-selection-bar">
        <span className="tree-selection-count">
          {selectedFiles.length > 0 ? `已選 ${selectedFiles.length} 個檔案` : "尚未選取檔案"}
        </span>
        <div className="tree-filter-spacer" />
        <button
          type="button"
          className="tree-action-link"
          title="Stage：將勾選的檔案加入暫存"
          onClick={stageSelected}
          disabled={!!busy || !canStage}
        >
          加入暫存
        </button>
        {activeTab === "tracked" ? (
          <button
            type="button"
            className="tree-action-link"
            title="Unstage：將勾選的檔案移出暫存"
            onClick={unstageSelected}
            disabled={!!busy || !canUnstage}
          >
            取消暫存
          </button>
        ) : null}
        {activeTab === "tracked" ? (
          <button
            type="button"
            className="tree-action-link danger"
            title="Discard：捨棄勾選檔案的變更"
            onClick={discardSelected}
            disabled={!!busy || !canDiscard}
          >
            捨棄變更
          </button>
        ) : null}
      </div>

      {rows.length === 0 ? (
        <div className="empty-state">沒有檔案</div>
      ) : (
        <div ref={scrollRef} className="tree-scroll">
          <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const row = rows[virtualRow.index];
              const isSelected = row.type === "file" && row.path === selectedPath;
              const rowFiles = row.type === "dir" ? filesUnderDirectory(visibleFiles, row.path) : row.file ? [row.file] : [];
              const rowPaths = rowFiles.map((file) => file.path);
              const allChecked = rowPaths.length > 0 && rowPaths.every((path) => checked.has(path));
              const someChecked = rowPaths.some((path) => checked.has(path));
              return (
                <div
                  key={`${row.type}-${row.path}`}
                  className={`tree-row${isSelected ? " selected" : ""}${row.type === "dir" ? " directory" : ""}${viewMode === "flat" ? " flat" : ""}`}
                  style={{
                    transform: `translateY(${virtualRow.start}px)`,
                    paddingLeft: 6 + row.depth * 14,
                  }}
                  onClick={() => {
                    if (row.type === "dir") {
                      toggleDir(row.path);
                    } else if (row.file) {
                      onSelect(row.file, sideFor(row.file));
                    }
                  }}
                  onDoubleClick={(event) => {
                    if (row.file) {
                      event.stopPropagation();
                      openDiff(row.file);
                    }
                  }}
                >
                  <Checkbox
                    className="tree-checkbox"
                    checked={allChecked ? true : someChecked ? "mixed" : false}
                    onChange={(_, data) => setCheckedFor(rowPaths, data.checked === true)}
                    onClick={(event) => event.stopPropagation()}
                    aria-label={row.type === "dir" ? row.path : row.file?.path}
                  />
                  {row.type === "dir" ? (
                    <>
                      <span className="tree-chevron">
                        {expanded.has(row.path) ? <ChevronDown24Regular /> : <ChevronRight24Regular />}
                      </span>
                      <span className="tree-icon folder">
                        {expanded.has(row.path) ? <FolderOpen24Regular /> : <Folder24Regular />}
                      </span>
                      <span
                        className={`tree-name ${row.status ? fileStatusClass(row.status) : ""}${row.status === "D" ? " deleted" : ""}`}
                        title={row.status ? `${row.path}（${fileStatusLabel(row.status)}）` : row.path}
                      >
                        {row.name}
                      </span>
                      <span className="tree-count">{row.count}</span>
                    </>
                  ) : (
                    <>
                      <span className="tree-chevron spacer" />
                      <span className="tree-icon"><Document24Regular /></span>
                      <span
                        className={`tree-name ${row.status ? fileStatusClass(row.status) : ""}${row.status === "D" ? " deleted" : ""}`}
                        title={`${row.path}${row.status ? `（${fileStatusLabel(row.status)}）` : ""}`}
                      >
                        {row.name}
                      </span>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {dialogFile ? (
        <FileDiffDialog
          path={dialogFile.path}
          statusLabel={`${fileStatusLabel(changeCode(dialogFile))} · ${dialogSide === "staged" ? "已暫存" : "未暫存"}`}
          statusClass={fileStatusClass(changeCode(dialogFile))}
          position={dialogIndex >= 0 ? dialogIndex + 1 : 0}
          total={dialogFiles.length}
          splitDiff={dialogSplit}
          maximized={dialogMaximized}
          onPrevious={showPrevious}
          onNext={showNext}
          onToggleSplit={() => setDialogSplit((value) => !value)}
          onToggleMaximized={() => setDialogMaximized((value) => !value)}
          onClose={closeDialog}
          filesPanel={
            <>
              <div className="detail-files-heading">
                <span>變更檔案</span>
                <span className="muted">{tabFiles.length}</span>
                <div className="tree-filter-spacer" />
                <button
                  type="button"
                  className={`tree-mini-button${viewMode === "tree" ? " active" : ""}`}
                  title="樹狀目錄"
                  aria-pressed={viewMode === "tree"}
                  onClick={() => changeMode("tree")}
                >
                  <TextBulletListTree24Regular />
                </button>
                <button
                  type="button"
                  className={`tree-mini-button${viewMode === "flat" ? " active" : ""}`}
                  title="平舖清單"
                  aria-pressed={viewMode === "flat"}
                  onClick={() => changeMode("flat")}
                >
                  <List24Regular />
                </button>
              </div>
              <div className="detail-file-tree">
                {rows.map((row) => {
                  const isActive = row.type === "file" && row.path === dialogFile.path;
                  const statusClass = row.status ? fileStatusClass(row.status) : "";
                  const deletedClass = row.status === "D" ? " deleted" : "";
                  return (
                    <button
                      key={`${row.type}-${row.path}`}
                      type="button"
                      className={`detail-file${isActive ? " active" : ""}`}
                      style={{ paddingLeft: 6 + row.depth * 14 }}
                      title={row.type === "file" ? `${row.path}（${fileStatusLabel(row.status || "M")}）` : row.path}
                      onClick={() => {
                        if (row.type === "dir") toggleDir(row.path);
                        else if (row.file) selectDialogFile(row.file);
                      }}
                    >
                      {row.type === "dir" ? (
                        <>
                          <span className="tree-chevron">
                            {expanded.has(row.path) ? <ChevronDown24Regular /> : <ChevronRight24Regular />}
                          </span>
                          <span className="tree-icon folder">
                            {expanded.has(row.path) ? <FolderOpen24Regular /> : <Folder24Regular />}
                          </span>
                          <span className={`tree-name ${statusClass}${deletedClass}`}>{row.name}</span>
                          <span className="tree-count">{row.count}</span>
                        </>
                      ) : (
                        <>
                          <span className="tree-chevron spacer" />
                          <span className="tree-icon"><Document24Regular /></span>
                          <span className={`tree-name ${statusClass}${deletedClass}`}>{row.name}</span>
                        </>
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          }
          diffContent={
            dialogDiff.isLoading ? (
              <div className="center-state"><Spinner label="載入中…" /></div>
            ) : dialogDiff.data?.binary ? (
              <div className="center-state"><p>此檔案是 binary，無法預覽文字差異。</p></div>
            ) : dialogDiff.data ? (
              <>
                <HunkStagingPanel
                  key={`${dialogFile.path}:${dialogSide}:${dialogDiff.data.patchHash || ""}`}
                  hunks={dialogDiff.data.hunks || []}
                  side={dialogSide}
                  busy={busy}
                  onApply={(selections) =>
                    onApplyHunks(dialogFile, dialogSide, dialogDiff.data!.patchHash || "", selections)
                  }
                />
                <DiffEditor
                  oldValue={dialogDiff.data.oldText}
                  newValue={dialogDiff.data.newText}
                  language={dialogDiff.data.language}
                  dark={document.documentElement.dataset.theme === "dark"}
                  renderSideBySide={dialogSplit}
                />
              </>
            ) : (
              <div className="center-state"><p>選擇檔案以檢視差異</p></div>
            )
          }
        />
      ) : null}
    </section>
  );
}
