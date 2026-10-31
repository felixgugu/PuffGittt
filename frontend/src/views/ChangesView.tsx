import { useEffect, useMemo, useRef, useState } from "react";
import {
  Badge,
  Button,
  Checkbox,
  Input,
  Spinner,
  Textarea,
} from "@fluentui/react-components";
import {
  ArrowDownload24Regular,
  ArrowClockwise24Regular,
  ArrowUndo24Regular,
  Checkmark24Regular,
  Delete24Regular,
  DocumentText24Regular,
  FolderOpen24Regular,
} from "@fluentui/react-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { useVirtualizer } from "@tanstack/react-virtual";
import { api } from "../bridge/api";
import { useAppStore, type RepoTab } from "../store";
import type { FileChange } from "../types";
import { changeCode, fileStatusClass, fileStatusLabel } from "../lib/format";
import { DiffEditor } from "../components/DiffEditor";

interface ChangesViewProps {
  tab: RepoTab;
}

interface VirtualFileListProps {
  files: FileChange[];
  side: "staged" | "unstaged";
  selectedPath?: string;
  selectedSide?: string;
  onSelect: (file: FileChange, side: "staged" | "unstaged") => void;
  onAction: (file: FileChange, side: "staged" | "unstaged") => void;
  actionLabel: string;
  emptyLabel: string;
  busy: boolean;
}

function VirtualFileList({
  files,
  side,
  selectedPath,
  selectedSide,
  onSelect,
  onAction,
  actionLabel,
  emptyLabel,
  busy,
}: VirtualFileListProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: files.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 42,
    overscan: 8,
  });

  if (files.length === 0) {
    return <div className="file-empty">{emptyLabel}</div>;
  }

  return (
    <div ref={parentRef} className="virtual-file-list">
      <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const file = files[virtualRow.index];
          const code = changeCode(file);
          const active = selectedPath === file.path && selectedSide === side;
          return (
            <div
              key={`${side}-${file.path}-${virtualRow.index}`}
              className={`file-row${active ? " active" : ""}`}
              style={{ transform: `translateY(${virtualRow.start}px)` }}
              onClick={() => onSelect(file, side)}
            >
              <span className={`file-status ${fileStatusClass(code)}`}>{fileStatusLabel(code) || code}</span>
              <span className="file-path" title={file.path}>{file.path}</span>
              {file.kind !== "conflicted" ? (
                <Button
                  size="small"
                  appearance="subtle"
                  className="file-action"
                  disabled={busy}
                  onClick={(event) => {
                    event.stopPropagation();
                    onAction(file, side);
                  }}
                  title={actionLabel}
                >
                  {side === "staged" ? <ArrowUndo24Regular /> : <ArrowDownload24Regular />}
                </Button>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ChangesView({ tab }: ChangesViewProps) {
  const { t } = useTranslation();
  const root = tab.repo.rootPath;
  const queryClient = useQueryClient();
  const selectFile = useAppStore((state) => state.selectFile);
  const setStatusMessage = useAppStore((state) => state.setStatusMessage);
  const [busy, setBusy] = useState(false);
  const [splitDiff, setSplitDiff] = useState(false);
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [amend, setAmend] = useState(false);
  const [diffSide, setDiffSide] = useState<"staged" | "unstaged">(tab.selectedFile?.side === "commit" ? "unstaged" : tab.selectedFile?.side || "unstaged");

  const statusQuery = useQuery({
    queryKey: ["status", root],
    queryFn: () => api.repo.getStatus(root),
  });
  const status = statusQuery.data;

  const stagedFiles = useMemo(
    () => (status?.files || []).filter((file) => file.kind !== "untracked" && file.kind !== "conflicted" && file.indexStatus !== "."),
    [status],
  );
  const unstagedFiles = useMemo(
    () => (status?.files || []).filter((file) => file.kind === "untracked" || file.kind === "conflicted" || file.worktreeStatus !== "."),
    [status],
  );

  const selected = tab.selectedFile;
  const selectedFile = selected ? status?.files.find((file) => file.path === selected.path) : undefined;
  const selectedSide = selected?.side === "staged" ? "staged" : "unstaged";

  useEffect(() => {
    if (!status) return;
    const all = [...stagedFiles, ...unstagedFiles];
    if (!selected || !all.some((file) => file.path === selected.path)) {
      const first = unstagedFiles[0] || stagedFiles[0];
      if (first) {
        selectFile(root, {
          path: first.path,
          side: unstagedFiles[0] ? "unstaged" : "staged",
        });
      } else {
        selectFile(root, undefined);
      }
    }
  }, [root, selectFile, selected, stagedFiles, status, unstagedFiles]);

  const diffQuery = useQuery({
    queryKey: ["diff", root, selected?.path, selectedSide],
    queryFn: () => api.change.getDiff(root, selected!.path, selectedSide, ""),
    enabled: !!selected,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["status", root] });
    void queryClient.invalidateQueries({ queryKey: ["history", root] });
    void queryClient.invalidateQueries({ queryKey: ["conflicts", root] });
    void queryClient.invalidateQueries({ queryKey: ["diff", root] });
  };

  const run = async (label: string, action: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await action();
      setStatusMessage(label);
      invalidate();
    } catch (error: any) {
      setStatusMessage(error?.message || String(error));
    } finally {
      setBusy(false);
    }
  };

  const handleStage = (file: FileChange, side: "staged" | "unstaged") =>
    void run(t("changes.operationDone"), () => (side === "staged" ? api.change.unstage(root, [file.path]) : api.change.stage(root, [file.path])));

  const handleStageAll = () => {
    const paths = unstagedFiles.map((file) => file.path);
    if (!paths.length) return;
    void run(t("changes.operationDone"), () => api.change.stage(root, paths));
  };

  const handleUnstageAll = () => {
    const paths = stagedFiles.map((file) => file.path);
    if (!paths.length) return;
    void run(t("changes.operationDone"), () => api.change.unstage(root, paths));
  };

  const handleCommit = async () => {
    if (!subject.trim() || stagedFiles.length === 0) return;
    const message = description.trim() ? `${subject.trim()}\n\n${description.trim()}` : subject.trim();
    setBusy(true);
    try {
      const result = await api.commit.commit(root, message, amend);
      setStatusMessage(result.output || result.message || t("changes.commitSuccess"));
      setSubject("");
      setDescription("");
      setAmend(false);
      invalidate();
    } catch (error: any) {
      setStatusMessage(error?.message || t("changes.commitFailed"));
    } finally {
      setBusy(false);
    }
  };

  const handleDiscard = (file: FileChange) => {
    if (!window.confirm(t("changes.discardConfirm"))) return;
    void run(t("changes.operationDone"), () => api.change.discard(root, [file.path]));
  };

  return (
    <div className="changes-view">
      <div className="view-header">
        <div>
          <h1>{t("changes.title")}</h1>
          <p>{tab.repo.rootPath}</p>
        </div>
        <div className="view-header-actions">
          <Button icon={<ArrowClockwise24Regular />} onClick={() => statusQuery.refetch()} disabled={statusQuery.isFetching}>
            {t("common.refresh")}
          </Button>
        </div>
      </div>

      <PanelGroup direction="horizontal" className="workspace-panels">
        <Panel defaultSize={24} minSize={16} className="panel-shell">
          <div className="panel-card file-panel">
            <div className="panel-heading">
              <span>{t("changes.files")}</span>
              {statusQuery.isFetching ? <Spinner size="tiny" /> : null}
            </div>
            <div className="file-section">
              <div className="file-section-heading">
                <span>{t("changes.staged")} <Badge size="small" appearance="tint">{stagedFiles.length}</Badge></span>
                <Button size="small" appearance="subtle" onClick={handleUnstageAll} disabled={busy || stagedFiles.length === 0}>
                  {t("changes.unstageAll")}
                </Button>
              </div>
              <VirtualFileList
                files={stagedFiles}
                side="staged"
                selectedPath={selected?.path}
                selectedSide={selected?.side}
                onSelect={(file, side) => {
                  setDiffSide(side);
                  selectFile(root, { path: file.path, side });
                }}
                onAction={handleStage}
                actionLabel={t("changes.unstage")}
                emptyLabel={t("changes.noStaged")}
                busy={busy}
              />
            </div>
            <div className="file-section">
              <div className="file-section-heading">
                <span>{t("changes.unstaged")} <Badge size="small" appearance="tint">{unstagedFiles.length}</Badge></span>
                <Button size="small" appearance="subtle" onClick={handleStageAll} disabled={busy || unstagedFiles.length === 0}>
                  {t("changes.stageAll")}
                </Button>
              </div>
              <VirtualFileList
                files={unstagedFiles}
                side="unstaged"
                selectedPath={selected?.path}
                selectedSide={selected?.side}
                onSelect={(file, side) => {
                  setDiffSide(side);
                  selectFile(root, { path: file.path, side });
                }}
                onAction={handleStage}
                actionLabel={t("changes.stage")}
                emptyLabel={t("changes.noUnstaged")}
                busy={busy}
              />
            </div>
          </div>
        </Panel>

        <PanelResizeHandle className="resize-handle" />

        <Panel defaultSize={46} minSize={24} className="panel-shell">
          <div className="panel-card diff-panel">
            <div className="panel-heading">
              <span>{selected ? selected.path : t("changes.diff")}</span>
              <div className="panel-heading-actions">
                {selected ? (
                  <>
                    <Badge appearance="tint" color={selectedSide === "staged" ? "success" : "informative"}>
                      {selectedSide === "staged" ? t("changes.staged") : t("changes.unstaged")}
                    </Badge>
                    <Button size="small" appearance="subtle" onClick={() => setSplitDiff((value) => !value)}>
                      {splitDiff ? t("changes.inline") : t("changes.split")}
                    </Button>
                    <Button size="small" appearance="subtle" icon={<FolderOpen24Regular />} title={t("changes.openInExplorer")} onClick={() => void api.app.openInExplorer(root)} />
                    <Button size="small" appearance="subtle" icon={<Delete24Regular />} title={t("changes.discard")} onClick={() => selectedFile && handleDiscard(selectedFile)} />
                  </>
                ) : null}
              </div>
            </div>
            {diffQuery.isLoading ? (
              <div className="center-state"><Spinner label={t("common.loading")} /></div>
            ) : diffQuery.data?.binary ? (
              <div className="center-state"><DocumentText24Regular /><p>{t("changes.binary")}</p></div>
            ) : diffQuery.data ? (
              <>
                {diffQuery.data.truncated ? <div className="inline-warning">{t("changes.truncated")}</div> : null}
                <DiffEditor
                  oldValue={diffQuery.data.oldText}
                  newValue={diffQuery.data.newText}
                  language={diffQuery.data.language}
                  dark={document.documentElement.dataset.theme === "dark"}
                  emptyText={t("changes.selectFile")}
                  renderSideBySide={splitDiff}
                />
              </>
            ) : (
              <div className="center-state"><DocumentText24Regular /><p>{t("changes.selectFile")}</p></div>
            )}
          </div>
        </Panel>

        <PanelResizeHandle className="resize-handle" />

        <Panel defaultSize={30} minSize={20} className="panel-shell">
          <div className="panel-card commit-panel">
            <div className="panel-heading">
              <span>{t("changes.commit")}</span>
              <span className="muted">{t("changes.stagedCount", { count: stagedFiles.length })}</span>
            </div>
            <div className="commit-form">
              <Input
                value={subject}
                onChange={(_, data) => setSubject(data.value)}
                placeholder={t("changes.commitSubject")}
                maxLength={120}
              />
              <Textarea
                value={description}
                onChange={(_, data) => setDescription(data.value)}
                placeholder={t("changes.commitDescription")}
                resize="vertical"
              />
              <Checkbox checked={amend} onChange={(_, data) => setAmend(!!data.checked)} label={t("changes.amend")} />
              <Button
                appearance="primary"
                icon={busy ? <Spinner size="tiny" /> : <Checkmark24Regular />}
                onClick={() => void handleCommit()}
                disabled={busy || stagedFiles.length === 0 || !subject.trim()}
              >
                {t("changes.commitAction")}
              </Button>
              {stagedFiles.length > 0 ? (
                <div className="commit-summary">
                  <span>{t("changes.stagedCount", { count: stagedFiles.length })}</span>
                </div>
              ) : null}
            </div>
            <div className="commit-tips">
              <div><span className="tip-dot" />{t("changes.commitTipStaged")}</div>
              <div><span className="tip-dot" />{t("changes.staged")} → Commit → Repository</div>
            </div>
          </div>
        </Panel>
      </PanelGroup>
    </div>
  );
}
