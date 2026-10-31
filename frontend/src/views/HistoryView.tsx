import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import {
  Button,
  Field,
  Spinner,
} from "@fluentui/react-components";
import {
  ArrowUndo24Regular,
  ChevronDown24Regular,
  ChevronRight24Regular,
  Dismiss24Regular,
  Document24Regular,
  DocumentText24Regular,
  Folder24Regular,
  FolderOpen24Regular,
  List24Regular,
  Search24Regular,
  TextBulletListTree24Regular,
} from "@fluentui/react-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { useVirtualizer } from "@tanstack/react-virtual";
import { api } from "../bridge/api";
import { UnderlineInput, UnderlineSelect, UnderlineTextarea } from "../components/FormControls";
import { ContextMenu } from "../components/ContextMenu";
import { GitCommandDialog } from "../components/GitCommandDialog";
import { useAppStore, type RepoTab } from "../store";
import type { CommandPreview, CommandRequest, Commit, CommitFile, OperationResult } from "../types";
import { buildGraph } from "../lib/graph";
import {
  allCommitDirectoryPaths,
  flattenCommitFiles,
  flattenCommitFilesFlat,
} from "../lib/commitTree";
import { CommitGraph } from "../components/CommitGraph";
import { DiffEditor } from "../components/DiffEditor";
import { FileDiffDialog } from "../components/FileDiffDialog";
import { fileStatusClass, fileStatusLabel, formatDate, shortOid } from "../lib/format";

interface HistoryViewProps {
  tab: RepoTab;
}

type FileViewMode = "tree" | "flat";
type HistoryMode = "commits" | "reflog";

interface PendingCommitAction {
  title: string;
  description?: string;
  warning?: string;
  preview: CommandPreview;
  execute: () => Promise<OperationResult>;
}

export function HistoryView({ tab }: HistoryViewProps) {
  const { t } = useTranslation();
  const root = tab.repo.rootPath;
  const selectCommit = useAppStore((state) => state.selectCommit);
  const setStatusMessage = useAppStore((state) => state.setStatusMessage);
  const setHistoryBranch = useAppStore((state) => state.setHistoryBranch);
  const queryClient = useQueryClient();
  const [branch, setBranch] = useState(tab.historyBranch || tab.repo.branch || "");
  const [allBranches, setAllBranches] = useState(false);
  const [historyMode, setHistoryMode] = useState<HistoryMode>("commits");
  const [selectedReflog, setSelectedReflog] = useState<string | null>(null);
  const [undoDialogOpen, setUndoDialogOpen] = useState(false);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [dialogFile, setDialogFile] = useState<CommitFile | null>(null);
  const [dialogMaximized, setDialogMaximized] = useState(false);
  const [fileMode, setFileMode] = useState<FileViewMode>(() => {
    try {
      return localStorage.getItem("puffgittt:history-files-mode") === "flat" ? "flat" : "tree";
    } catch {
      return "tree";
    }
  });
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
  const [splitDiff, setSplitDiff] = useState(false);
  const [branchDialogOpen, setBranchDialogOpen] = useState(false);
  const [newBranchName, setNewBranchName] = useState("");
  const [branchBusy, setBranchBusy] = useState(false);
  const [tagDialogOpen, setTagDialogOpen] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagMessage, setNewTagMessage] = useState("");
  const [tagBusy, setTagBusy] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetMode, setResetMode] = useState<"soft" | "mixed" | "hard">("mixed");
  const [actionBusy, setActionBusy] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingCommitAction | null>(null);
  const [contextCommit, setContextCommit] = useState<Commit | null>(null);
  const [contextIsReflog, setContextIsReflog] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const branches = useQuery({
    queryKey: ["branches", root],
    queryFn: () => api.repo.getBranches(root),
  });
  const history = useQuery({
    queryKey: ["history", root, branch, allBranches, deferredSearch],
    queryFn: () => api.history.list(root, branch, allBranches, 200, deferredSearch),
  });
  const commits = history.data || [];
  const graph = useMemo(() => buildGraph(commits), [commits]);

  const localBranches = (branches.data || []).filter((entry) => entry.kind === "local");

  useEffect(() => {
    setBranch(tab.historyBranch || tab.repo.branch || "");
    setAllBranches(false);
  }, [root]);

  useEffect(() => {
    setSearch("");
  }, [root]);

  useEffect(() => {
    if (branch || localBranches.length === 0) return;
    const fallback = localBranches.find((entry) => entry.current)?.name || localBranches[0].name;
    setBranch(fallback);
    setHistoryBranch(root, fallback);
  }, [branch, localBranches, root, setHistoryBranch]);

  useEffect(() => {
    if (commits.length === 0) {
      if (tab.selectedCommit) selectCommit(root, undefined);
      return;
    }
    if (!tab.selectedCommit || !commits.some((commit) => commit.oid === tab.selectedCommit)) {
      selectCommit(root, commits[0].oid);
    }
  }, [commits, root, selectCommit, tab.selectedCommit]);

  const detail = useQuery({
    queryKey: ["commit", root, tab.selectedCommit],
    queryFn: () => api.history.getCommit(root, tab.selectedCommit!),
    enabled: !!tab.selectedCommit,
  });
  const reflog = useQuery({
    queryKey: ["reflog", root],
    queryFn: () => api.history.reflog(root, 200),
    enabled: historyMode === "reflog",
  });
  const undoInfo = useQuery({
    queryKey: ["undo", root],
    queryFn: () => api.history.undoInfo(root),
  });
  const actionCommit = contextCommit ?? detail.data?.commit;

  useEffect(() => {
    try {
      localStorage.setItem("puffgittt:history-files-mode", fileMode);
    } catch {}
  }, [fileMode]);

  useEffect(() => {
    const files = detail.data?.files || [];
    if (!files.length) {
      setSelectedFile(null);
      setDialogFile(null);
      setExpandedDirs(new Set());
      return;
    }
    setSelectedFile((current) => (current && files.some((file) => file.path === current) ? current : files[0].path));
    setDialogFile((current) => (current && files.some((file) => file.path === current.path) ? current : null));
    setExpandedDirs(new Set(allCommitDirectoryPaths(files)));
  }, [detail.data]);

  useEffect(() => {
    if (!dialogFile) setDialogMaximized(false);
  }, [dialogFile]);

  const diff = useQuery({
    queryKey: ["commit-diff", root, tab.selectedCommit, dialogFile?.path],
    queryFn: () => api.change.getDiff(root, dialogFile!.path, "commit", tab.selectedCommit || ""),
    enabled: !!tab.selectedCommit && !!dialogFile,
  });

  const reflogEntries = reflog.data || [];
  const activeLoading = historyMode === "reflog" ? reflog.isLoading : history.isLoading;
  const activeEmpty = historyMode === "reflog" ? reflogEntries.length === 0 : commits.length === 0;
  const virtualizer = useVirtualizer({
    count: historyMode === "reflog" ? reflogEntries.length : commits.length,
    getScrollElement: () => listRef.current,
    estimateSize: () => 54,
    overscan: 12,
  });

  const commitFiles = detail.data?.files || [];
  const rows = useMemo(
    () =>
      fileMode === "flat"
        ? flattenCommitFilesFlat(commitFiles)
        : flattenCommitFiles(commitFiles, expandedDirs),
    [commitFiles, expandedDirs, fileMode],
  );
  const orderedFiles = useMemo(
    () => rows.map((row) => row.file).filter((file): file is CommitFile => !!file),
    [rows],
  );
  const dialogIndex = dialogFile ? orderedFiles.findIndex((file) => file.path === dialogFile.path) : -1;

  const toggleDir = (path: string) => {
    setExpandedDirs((current) => {
      const next = new Set(current);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const selectDialogFile = (file: CommitFile) => {
    setSelectedFile(file.path);
    setDialogFile(file);
  };

  const closeDialog = () => {
    setDialogFile(null);
    setDialogMaximized(false);
  };

  const openDiff = (file: CommitFile) => {
    selectDialogFile(file);
    setDialogMaximized(true);
  };

  const showPrevious = () => {
    if (dialogIndex > 0) selectDialogFile(orderedFiles[dialogIndex - 1]);
  };

  const showNext = () => {
    if (dialogIndex >= 0 && dialogIndex < orderedFiles.length - 1) {
      selectDialogFile(orderedFiles[dialogIndex + 1]);
    }
  };

  const openBranchDialog = () => {
    if (!actionCommit) return;
    setNewBranchName("");
    setBranchDialogOpen(true);
  };

  const handleCreateBranch = async () => {
    const name = newBranchName.trim();
    if (!name || !actionCommit) return;
    setBranchBusy(true);
    try {
      const result = await api.branch.create(root, name, actionCommit.oid);
      setStatusMessage(result.message || "分支已建立");
      void queryClient.invalidateQueries({ queryKey: ["branches", root] });
      void queryClient.invalidateQueries({ queryKey: ["history", root] });
      void queryClient.invalidateQueries({ queryKey: ["status", root] });
      setBranchDialogOpen(false);
      setNewBranchName("");
    } catch (error: any) {
      setStatusMessage(error?.message || String(error));
    } finally {
      setBranchBusy(false);
    }
  };

  const branchCommand = actionCommit
    ? `git branch ${newBranchName.trim() || "<branch-name>"} ${actionCommit.oid}`
    : "git branch <branch-name> <commit>";

  const openTagDialog = () => {
    if (!actionCommit) return;
    setNewTagName("");
    setNewTagMessage("");
    setTagDialogOpen(true);
  };

  const handleCreateTag = async () => {
    const name = newTagName.trim();
    if (!name || !actionCommit) return;
    setTagBusy(true);
    try {
      const result = await api.tags.create(root, name, actionCommit.oid, newTagMessage.trim());
      setStatusMessage(result.message || "Tag 已建立");
      void queryClient.invalidateQueries({ queryKey: ["tags", root] });
      void queryClient.invalidateQueries({ queryKey: ["history", root] });
      setTagDialogOpen(false);
      setNewTagName("");
      setNewTagMessage("");
    } catch (error: any) {
      setStatusMessage(error?.message || String(error));
    } finally {
      setTagBusy(false);
    }
  };

  const tagCommand = actionCommit
    ? newTagMessage.trim()
      ? `git tag -a ${newTagName.trim() || "<tag-name>"} -m "${newTagMessage.trim()}" ${actionCommit.oid}`
      : `git tag ${newTagName.trim() || "<tag-name>"} ${actionCommit.oid}`
    : "git tag <tag-name> <commit>";

  const invalidateCommitActions = () => {
    void queryClient.invalidateQueries({ queryKey: ["history", root] });
    void queryClient.invalidateQueries({ queryKey: ["status", root] });
    void queryClient.invalidateQueries({ queryKey: ["branches", root] });
    void queryClient.invalidateQueries({ queryKey: ["tags", root] });
    void queryClient.invalidateQueries({ queryKey: ["conflicts", root] });
    void queryClient.invalidateQueries({ queryKey: ["reflog", root] });
    void queryClient.invalidateQueries({ queryKey: ["undo", root] });
  };

  const runCommitAction = async (action: () => Promise<OperationResult>) => {
    setActionBusy(true);
    try {
      const result = await action();
      setStatusMessage(result.message || "操作完成");
      invalidateCommitActions();
      return true;
    } catch (error: any) {
      setStatusMessage(error?.message || String(error));
      return false;
    } finally {
      setActionBusy(false);
    }
  };

  const handleReset = async () => {
    if (!actionCommit) return;
    const ok = await runCommitAction(() => api.history.reset(root, actionCommit.oid, resetMode));
    if (ok) setResetDialogOpen(false);
  };

  const handleUndo = async () => {
    const ok = await runCommitAction(() => api.history.undo(root));
    if (ok) setUndoDialogOpen(false);
  };

  const undoCommand = undoInfo.data?.beforeOid
    ? `git reset --hard ${undoInfo.data.beforeOid}`
    : "git reset --hard <previous-head>";

  const prepareCommitAction = async (action: "revert" | "drop", meta: Omit<PendingCommitAction, "preview" | "execute">) => {
    if (!actionCommit) return;
    const oid = actionCommit.oid;
    setActionBusy(true);
    try {
      const preview = await api.history.preview(root, { action, target: oid });
      setPendingAction({
        ...meta,
        preview,
        execute: () => (action === "revert" ? api.history.revert(root, oid) : api.history.drop(root, oid)),
      });
    } catch (error: any) {
      setStatusMessage(error?.message || String(error));
    } finally {
      setActionBusy(false);
    }
  };

  const confirmPendingAction = async () => {
    if (!pendingAction) return;
    const ok = await runCommitAction(pendingAction.execute);
    if (ok) setPendingAction(null);
  };

  const resetCommand = actionCommit
    ? `git reset --${resetMode} ${actionCommit.oid}`
    : "git reset --mixed <commit>";

  const renderFileRows = (
    activePath: string | null,
    onActivate: (file: CommitFile) => void,
    onOpen?: (file: CommitFile) => void,
  ) =>
    rows.map((row) => {
      const isSelected = row.type === "file" && row.path === activePath;
      const statusClass = row.status ? fileStatusClass(row.status) : "";
      const deletedClass = row.status === "D" ? " deleted" : "";
      const title =
        row.type === "file"
          ? `${row.path}${row.status ? `（${fileStatusLabel(row.status)}）` : ""}${onOpen ? "｜雙擊查看 Diff" : ""}`
          : `${row.path}（${row.count ?? 0} 個檔案）`;
      return (
        <button
          key={`${row.type}-${row.path}`}
          type="button"
          className={`detail-file${isSelected ? " active" : ""}`}
          style={{ paddingLeft: 6 + row.depth * 14 }}
          title={title}
          onClick={() => {
            if (row.type === "dir") toggleDir(row.path);
            else if (row.file) onActivate(row.file);
          }}
          onDoubleClick={() => {
            if (row.type === "file" && row.file && onOpen) onOpen(row.file);
          }}
        >
          {row.type === "dir" ? (
            <>
              <span className="tree-chevron">
                {expandedDirs.has(row.path) ? <ChevronDown24Regular /> : <ChevronRight24Regular />}
              </span>
              <span className="tree-icon folder">
                {expandedDirs.has(row.path) ? <FolderOpen24Regular /> : <Folder24Regular />}
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
    });

  return (
    <div className="history-view">
      <PanelGroup direction="horizontal" className="workspace-panels">
        <Panel defaultSize={58} minSize={32} className="panel-shell">
          <div className="panel-card commit-list-panel">
            <div className="panel-heading history-heading">
              <div className="file-tabs" role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={historyMode === "commits"}
                  className={`file-tab${historyMode === "commits" ? " active" : ""}`}
                  onClick={() => setHistoryMode("commits")}
                >
                  Commits
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={historyMode === "reflog"}
                  className={`file-tab${historyMode === "reflog" ? " active" : ""}`}
                  onClick={() => setHistoryMode("reflog")}
                >
                  Reflog
                </button>
              </div>
              <div className="history-heading-tools">
                {historyMode === "commits" ? (
                  <>
                    <UnderlineInput
                      value={search}
                      onChange={(_, data) => setSearch(data.value)}
                      contentBefore={<Search24Regular />}
                      placeholder="搜尋 Commit、作者或 SHA"
                      className="history-search"
                    />
                    <UnderlineSelect
                      className="history-branch-select"
                      aria-label="Branches"
                      value={allBranches ? "__all__" : branch}
                      onChange={(_, data) => {
                        if (data.value === "__all__") {
                          setAllBranches(true);
                          setHistoryBranch(root, undefined);
                          return;
                        }
                        setAllBranches(false);
                        setBranch(data.value);
                        setHistoryBranch(root, data.value);
                      }}
                    >
                      <option value="__all__">所有分支</option>
                      {localBranches.map((entry) => (
                        <option key={entry.name} value={entry.name}>
                          {entry.name}
                          {entry.current ? "  ✓" : ""}
                        </option>
                      ))}
                    </UnderlineSelect>
                  </>
                ) : null}
                {undoInfo.data?.operation ? (
                  <Button
                    size="small"
                    appearance="subtle"
                    icon={<ArrowUndo24Regular />}
                    title={`復原上一次操作：${undoInfo.data.operation}`}
                    onClick={() => setUndoDialogOpen(true)}
                    disabled={actionBusy}
                  />
                ) : null}
              </div>
              <span className="muted">
                {historyMode === "commits" ? `${commits.length} commits` : `${reflogEntries.length} reflog`}
              </span>
            </div>
            {activeLoading ? (
              <div className="center-state"><Spinner label={t("common.loading")} /></div>
            ) : activeEmpty ? (
              <div className="center-state">
                <DocumentText24Regular />
                <p>{historyMode === "commits" ? t("history.noCommits") : "目前沒有 Reflog。"}</p>
              </div>
            ) : (
              <div ref={listRef} className="commit-list-scroll">
                <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
                  {virtualizer.getVirtualItems().map((virtualRow) => {
                    if (historyMode === "reflog") {
                      const entry = reflogEntries[virtualRow.index];
                      return (
                        <div
                          key={`${entry.selector}-${entry.oid}`}
                          className={`reflog-row${selectedReflog === entry.selector ? " active" : ""}`}
                          style={{ transform: `translateY(${virtualRow.start}px)`, height: 54 }}
                          onClick={() => {
                            setSelectedReflog(entry.selector);
                            selectCommit(root, entry.oid);
                          }}
                          onContextMenu={(event) => {
                            event.preventDefault();
                            setSelectedReflog(entry.selector);
                            selectCommit(root, entry.oid);
                            setContextIsReflog(true);
                            setContextCommit({
                              oid: entry.oid,
                              parents: entry.previousOid ? [entry.previousOid] : [],
                              author: "",
                              authorEmail: "",
                              authorTime: entry.date,
                              committer: "",
                              committerEmail: "",
                              committerTime: entry.date,
                              subject: entry.message || entry.action,
                              message: entry.message,
                              refs: [],
                            });
                            setContextMenu({ x: event.clientX, y: event.clientY });
                          }}
                        >
                          <span className="reflog-selector">{entry.selector}</span>
                          <div className="reflog-content">
                            <div className="reflog-subject" title={`${entry.action}: ${entry.message}`}>
                              <span className="reflog-action">{entry.action}</span>
                              {entry.message}
                            </div>
                            <div className="commit-meta">
                              <span className="commit-oid">{shortOid(entry.oid)}</span>
                              {entry.previousOid ? <span>← {shortOid(entry.previousOid)}</span> : null}
                              <span>{formatDate(entry.date)}</span>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    const commit = commits[virtualRow.index];
                    const node = graph.nodes[virtualRow.index];
                    return (
                      <div
                        key={commit.oid}
                        className={`commit-row${tab.selectedCommit === commit.oid ? " active" : ""}`}
                        style={{ transform: `translateY(${virtualRow.start}px)`, height: 54 }}
                        onClick={() => selectCommit(root, commit.oid)}
                        onContextMenu={(event) => {
                          event.preventDefault();
                          selectCommit(root, commit.oid);
                          setContextIsReflog(false);
                          setContextCommit(commit);
                          setContextMenu({ x: event.clientX, y: event.clientY });
                        }}
                      >
                        <CommitGraph node={node} width={graph.width} height={54} />
                        <div className="commit-content">
                          <div className="commit-subject" title={commit.subject}>
                            {commit.subject}
                            {commit.refs.map((ref) => (
                              <span key={ref} className="ref-badge">{ref}</span>
                            ))}
                          </div>
                          <div className="commit-meta">
                            <span>{commit.author}</span>
                            <span>{formatDate(commit.authorTime)}</span>
                            <span className="commit-oid">{shortOid(commit.oid)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </Panel>

        <PanelResizeHandle className="resize-handle" />

        <Panel defaultSize={42} minSize={26} className="panel-shell">
          <div className="panel-card commit-detail-panel">
            <div className="panel-heading">
              <span>{t("history.details")}</span>
            </div>
            {detail.isLoading ? (
              <div className="center-state"><Spinner label={t("common.loading")} /></div>
            ) : detail.data ? (
              <PanelGroup direction="vertical" className="commit-detail-split">
                <Panel defaultSize={38} minSize={18} className="panel-shell">
                  <div className="commit-detail-content">
                    <h3>{detail.data.commit.subject}</h3>
                    <div className="detail-meta">
                      <span>{detail.data.commit.author}</span>
                      <span>{formatDate(detail.data.commit.authorTime)}</span>
                      <span className="commit-oid">{detail.data.commit.oid}</span>
                    </div>
                    <pre className="commit-message-full">{detail.data.commit.message || detail.data.commit.subject}</pre>
                  </div>
                </Panel>

                <PanelResizeHandle className="resize-handle horizontal commit-detail-resizer" />

                <Panel defaultSize={62} minSize={24} className="panel-shell">
                  <div className="commit-files-section">
                    <div className="detail-files-heading">
                      <span>變更檔案</span>
                      <span className="muted">{commitFiles.length}</span>
                      <div className="tree-filter-spacer" />
                      <button
                        type="button"
                        className={`tree-mini-button${fileMode === "tree" ? " active" : ""}`}
                        title="樹狀目錄"
                        aria-pressed={fileMode === "tree"}
                        onClick={() => setFileMode("tree")}
                      >
                        <TextBulletListTree24Regular />
                      </button>
                      <button
                        type="button"
                        className={`tree-mini-button${fileMode === "flat" ? " active" : ""}`}
                        title="平舖清單"
                        aria-pressed={fileMode === "flat"}
                        onClick={() => setFileMode("flat")}
                      >
                        <List24Regular />
                      </button>
                    </div>
                    {commitFiles.length === 0 ? (
                      <div className="empty-state">{t("history.noFiles")}</div>
                    ) : (
                      <div className="detail-file-tree">
                        {renderFileRows(selectedFile, (file) => setSelectedFile(file.path), openDiff)}
                      </div>
                    )}
                  </div>
                </Panel>
              </PanelGroup>
            ) : (
              <div className="center-state"><p>{t("history.selectCommit")}</p></div>
            )}
          </div>
        </Panel>
      </PanelGroup>

      {branchDialogOpen && actionCommit ? (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => event.target === event.currentTarget && !branchBusy && setBranchDialogOpen(false)}
        >
          <div className="modal small" role="dialog" aria-modal="true" aria-label="建立分支">
            <div className="modal-header">
              <h2>建立分支</h2>
              <Button
                appearance="subtle"
                icon={<Dismiss24Regular />}
                onClick={() => setBranchDialogOpen(false)}
                disabled={branchBusy}
              />
            </div>
            <div className="modal-body form-stack">
              <div className="branch-source">
                <strong>{actionCommit.subject}</strong>
                <span>{shortOid(actionCommit.oid)}</span>
              </div>
              <Field label="分支名稱">
                <UnderlineInput
                  value={newBranchName}
                  onChange={(_, data) => setNewBranchName(data.value)}
                  placeholder="feature/my-branch"
                  autoFocus
                />
              </Field>
              <pre className="git-command-preview"><code>{branchCommand}</code></pre>
            </div>
            <div className="modal-footer">
              <Button appearance="secondary" onClick={() => setBranchDialogOpen(false)} disabled={branchBusy}>
                取消
              </Button>
              <Button appearance="primary" onClick={() => void handleCreateBranch()} disabled={!newBranchName.trim() || branchBusy}>
                {branchBusy ? <Spinner size="tiny" /> : "建立分支"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {tagDialogOpen && actionCommit ? (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => event.target === event.currentTarget && !tagBusy && setTagDialogOpen(false)}
        >
          <div className="modal small" role="dialog" aria-modal="true" aria-label="建立 Tag">
            <div className="modal-header">
              <h2>建立 Tag</h2>
              <Button
                appearance="subtle"
                icon={<Dismiss24Regular />}
                onClick={() => setTagDialogOpen(false)}
                disabled={tagBusy}
              />
            </div>
            <div className="modal-body form-stack">
              <div className="branch-source">
                <strong>{actionCommit.subject}</strong>
                <span>{shortOid(actionCommit.oid)}</span>
              </div>
              <Field label="Tag 名稱">
                <UnderlineInput
                  value={newTagName}
                  onChange={(_, data) => setNewTagName(data.value)}
                  placeholder="v1.0.0"
                  autoFocus
                />
              </Field>
              <Field label="Message（選填）">
                <UnderlineTextarea
                  value={newTagMessage}
                  onChange={(_, data) => setNewTagMessage(data.value)}
                  placeholder="留空則建立 lightweight tag"
                  resize="vertical"
                />
              </Field>
              <pre className="git-command-preview"><code>{tagCommand}</code></pre>
            </div>
            <div className="modal-footer">
              <Button appearance="secondary" onClick={() => setTagDialogOpen(false)} disabled={tagBusy}>
                取消
              </Button>
              <Button appearance="primary" onClick={() => void handleCreateTag()} disabled={!newTagName.trim() || tagBusy}>
                {tagBusy ? <Spinner size="tiny" /> : "建立 Tag"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {resetDialogOpen && actionCommit ? (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => event.target === event.currentTarget && !actionBusy && setResetDialogOpen(false)}
        >
          <div className="modal small" role="dialog" aria-modal="true" aria-label="Reset Commit">
            <div className="modal-header">
              <h2>Reset 目前分支到此 Commit</h2>
              <Button
                appearance="subtle"
                icon={<Dismiss24Regular />}
                onClick={() => setResetDialogOpen(false)}
                disabled={actionBusy}
              />
            </div>
            <div className="modal-body form-stack">
              <div className="branch-source">
                <strong>{actionCommit.subject}</strong>
                <span>{shortOid(actionCommit.oid)}</span>
              </div>
              <Field label="Reset 模式">
                <UnderlineSelect
                  value={resetMode}
                  onChange={(_, data) => setResetMode(data.value as "soft" | "mixed" | "hard")}
                >
                  <option value="soft">Soft</option>
                  <option value="mixed">Mixed</option>
                  <option value="hard">Hard</option>
                </UnderlineSelect>
              </Field>
              <pre className="git-command-preview"><code>{resetCommand}</code></pre>
              <p className={`git-command-warning${resetMode === "hard" ? " destructive" : ""}`}>
                {resetMode === "soft"
                  ? "只移動 HEAD，保留 index 與工作區變更。"
                  : resetMode === "mixed"
                    ? "移動 HEAD 並重置 index，保留工作區變更。"
                    : "會丟棄 index 與工作區變更，此操作可能無法復原。"}
              </p>
            </div>
            <div className="modal-footer">
              <Button appearance="secondary" onClick={() => setResetDialogOpen(false)} disabled={actionBusy}>
                取消
              </Button>
              <Button appearance="primary" onClick={() => void handleReset()} disabled={actionBusy}>
                {actionBusy ? <Spinner size="tiny" /> : "確認 Reset"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {undoDialogOpen && undoInfo.data?.beforeOid ? (
        <GitCommandDialog
          title="復原上一次操作"
          description={`${undoInfo.data.operation}：將目前分支回復到 ${shortOid(undoInfo.data.beforeOid)}。工作區有未提交變更時無法復原。`}
          command={undoCommand}
          warning="復原會以 Hard Reset 回到操作前的 HEAD，未提交的變更不會被保留。"
          destructive
          busy={actionBusy}
          onCancel={() => setUndoDialogOpen(false)}
          onConfirm={() => void handleUndo()}
        />
      ) : null}

      {pendingAction ? (
        <GitCommandDialog
          title={pendingAction.title}
          description={pendingAction.description}
          command={pendingAction.preview.command}
          warning={pendingAction.warning}
          destructive={pendingAction.preview.destructive}
          busy={actionBusy}
          onCancel={() => setPendingAction(null)}
          onConfirm={() => void confirmPendingAction()}
        />
      ) : null}

      {dialogFile ? (
        <FileDiffDialog
          path={dialogFile.path}
          statusLabel={fileStatusLabel(dialogFile.status)}
          statusClass={fileStatusClass(dialogFile.status)}
          position={dialogIndex >= 0 ? dialogIndex + 1 : 0}
          total={orderedFiles.length}
          splitDiff={splitDiff}
          maximized={dialogMaximized}
          onPrevious={showPrevious}
          onNext={showNext}
          onToggleSplit={() => setSplitDiff((value) => !value)}
          onToggleMaximized={() => setDialogMaximized((value) => !value)}
          onClose={closeDialog}
          filesPanel={
            <>
              <div className="detail-files-heading">
                <span>變更檔案</span>
                <span className="muted">{commitFiles.length}</span>
                <div className="tree-filter-spacer" />
                <button
                  type="button"
                  className={`tree-mini-button${fileMode === "tree" ? " active" : ""}`}
                  title="樹狀目錄"
                  aria-pressed={fileMode === "tree"}
                  onClick={() => setFileMode("tree")}
                >
                  <TextBulletListTree24Regular />
                </button>
                <button
                  type="button"
                  className={`tree-mini-button${fileMode === "flat" ? " active" : ""}`}
                  title="平舖清單"
                  aria-pressed={fileMode === "flat"}
                  onClick={() => setFileMode("flat")}
                >
                  <List24Regular />
                </button>
              </div>
              {commitFiles.length === 0 ? (
                <div className="empty-state">{t("history.noFiles")}</div>
              ) : (
                <div className="detail-file-tree">
                  {renderFileRows(dialogFile.path, selectDialogFile)}
                </div>
              )}
            </>
          }
          diffContent={
            diff.isLoading ? (
              <div className="center-state"><Spinner label={t("common.loading")} /></div>
            ) : diff.data?.binary ? (
              <div className="center-state"><p>{t("changes.binary")}</p></div>
            ) : diff.data ? (
              <DiffEditor
                oldValue={diff.data.oldText}
                newValue={diff.data.newText}
                language={diff.data.language}
                dark={document.documentElement.dataset.theme === "dark"}
                renderSideBySide={splitDiff}
              />
            ) : (
              <div className="center-state"><p>{t("changes.selectFile")}</p></div>
            )
          }
        />
      ) : null}

      {contextMenu && contextCommit ? (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          items={[
            { key: "branch", label: "建立分支…", onSelect: openBranchDialog },
            { key: "tag", label: "建立 Tag…", onSelect: openTagDialog },
            {
              key: "copy",
              label: "複製 OID",
              onSelect: () => {
                void navigator.clipboard.writeText(contextCommit.oid);
                setStatusMessage(t("common.copied"));
              },
            },
            { divider: true },
            {
              key: "reset",
              label: "Reset 目前分支到此 Commit…",
              onSelect: () => {
                setResetMode("mixed");
                setResetDialogOpen(true);
              },
            },
            ...(contextIsReflog
              ? []
              : [
                  {
                    key: "revert",
                    label: "Revert 此 Commit…",
                    disabled: contextCommit.parents.length > 1 || actionBusy,
                    onSelect: () =>
                      void prepareCommitAction("revert", {
                        title: `Revert ${shortOid(contextCommit.oid)}`,
                        description: "建立一個反向 Commit，不改寫既有歷史。",
                        warning: "Revert 可能產生衝突，衝突後需到 Conflicts 頁面處理。",
                      }),
                  },
                  {
                    key: "drop",
                    label: "Drop 此 Commit…",
                    disabled: contextCommit.parents.length !== 1 || actionBusy,
                    destructive: true,
                    onSelect: () =>
                      void prepareCommitAction("drop", {
                        title: `Drop ${shortOid(contextCommit.oid)}`,
                        description: "從目前分支歷史移除此 Commit，後續 Commit 會重新套用。",
                        warning: "會改寫目前分支歷史，可能產生衝突；若已 push 過可能需要 force push。",
                      }),
                  },
                ]),
          ]}
        />
      ) : null}
    </div>
  );
}
