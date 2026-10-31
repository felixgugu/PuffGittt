import { useEffect, useMemo, useState } from "react";
import {
  Badge,
  Button,
  Checkbox,
  Input,
  Spinner,
  Textarea,
} from "@fluentui/react-components";
import {
  Checkmark24Regular,
  Delete24Regular,
  DocumentText24Regular,
  FolderOpen24Regular,
} from "@fluentui/react-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { api } from "../bridge/api";
import { useAppStore, type RepoTab } from "../store";
import type { FileChange } from "../types";
import { FileTree } from "../components/FileTree";
import { DiffEditor } from "../components/DiffEditor";
import { fileHasStaged, fileHasUnstaged } from "../lib/fileTree";
import { changeCode, fileStatusClass, fileStatusLabel } from "../lib/format";

interface ChangesViewProps {
  tab: RepoTab;
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

  const statusQuery = useQuery({
    queryKey: ["status", root],
    queryFn: () => api.repo.getStatus(root),
  });
  const status = statusQuery.data;

  const trackedFiles = useMemo(
    () => (status?.files || []).filter((file) => file.kind !== "untracked"),
    [status],
  );
  const untrackedFiles = useMemo(
    () => (status?.files || []).filter((file) => file.kind === "untracked"),
    [status],
  );

  const selected = tab.selectedFile;
  const selectedSide = selected?.side === "staged" ? "staged" : "unstaged";
  const selectedFile = selected ? status?.files.find((file) => file.path === selected.path) : undefined;

  useEffect(() => {
    if (!status) return;
    const all = [...trackedFiles, ...untrackedFiles];
    if (!selected || !all.some((file) => file.path === selected.path)) {
      const first = trackedFiles.find(fileHasUnstaged) || trackedFiles.find(fileHasStaged) || untrackedFiles[0];
      if (first) {
        selectFile(root, {
          path: first.path,
          side: fileHasUnstaged(first) ? "unstaged" : "staged",
        });
      } else {
        selectFile(root, undefined);
      }
    }
  }, [root, selectFile, selected, status, trackedFiles, untrackedFiles]);

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

  const stage = (files: FileChange[]) => {
    if (!files.length) return;
    void run(t("changes.operationDone"), () => api.change.stage(root, files.map((file) => file.path)));
  };

  const unstage = (files: FileChange[]) => {
    if (!files.length) return;
    void run(t("changes.operationDone"), () => api.change.unstage(root, files.map((file) => file.path)));
  };

  const stageAllTracked = () => stage(trackedFiles.filter(fileHasUnstaged));
  const unstageAllTracked = () => unstage(trackedFiles.filter(fileHasStaged));
  const stageAllUntracked = () => stage(untrackedFiles);

  const handleCommit = async () => {
    const stagedCount = trackedFiles.filter(fileHasStaged).length;
    if (!subject.trim() || stagedCount === 0) return;
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

  const stagedCount = trackedFiles.filter(fileHasStaged).length;

  return (
    <div className="changes-view">
      <PanelGroup direction="horizontal" className="changes-shell">
        <Panel defaultSize={32} minSize={24} className="changes-left-panel">
          <PanelGroup direction="vertical">
            <Panel defaultSize={38} minSize={18} className="tree-panel-shell">
              <div className="panel-card tree-card">
                <FileTree
                  key={`${root}-tracked`}
                  title={t("changes.trackedFiles")}
                  files={trackedFiles}
                  storageKey={`${root}-tracked`}
                  selectedPath={selected?.path}
                  emptyText={t("changes.treeEmpty")}
                  busy={busy}
                  filterable
                  onSelect={(file, side) => selectFile(root, { path: file.path, side })}
                  onStage={(file) => stage([file])}
                  onUnstage={(file) => unstage([file])}
                  onStageAll={stageAllTracked}
                  onUnstageAll={unstageAllTracked}
                />
              </div>
            </Panel>
            <PanelResizeHandle className="resize-handle horizontal" />
            <Panel defaultSize={26} minSize={18} className="tree-panel-shell">
              <div className="panel-card commit-panel">
                <div className="panel-heading"><span>{t("changes.commit")}</span><span className="muted">{t("changes.stagedCount", { count: stagedCount })}</span></div>
                <div className="commit-form compact">
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
                  <div className="commit-form-footer">
                    <Checkbox checked={amend} onChange={(_, data) => setAmend(!!data.checked)} label={t("changes.amend")} />
                    <Button
                      appearance="primary"
                      icon={busy ? <Spinner size="tiny" /> : <Checkmark24Regular />}
                      onClick={() => void handleCommit()}
                      disabled={busy || stagedCount === 0 || !subject.trim()}
                    >
                      {t("changes.commitAction")}
                    </Button>
                  </div>
                  <div className="commit-hint">{t("changes.commitTipStaged")}</div>
                </div>
              </div>
            </Panel>
            <PanelResizeHandle className="resize-handle horizontal" />
            <Panel defaultSize={36} minSize={18} className="tree-panel-shell">
              <div className="panel-card tree-card">
                <FileTree
                  key={`${root}-untracked`}
                  title={t("changes.untrackedFiles")}
                  files={untrackedFiles}
                  storageKey={`${root}-untracked`}
                  selectedPath={selected?.path}
                  emptyText={t("changes.treeEmpty")}
                  busy={busy}
                  onSelect={(file, side) => selectFile(root, { path: file.path, side })}
                  onStage={(file) => stage([file])}
                  onStageAll={stageAllUntracked}
                />
              </div>
            </Panel>
          </PanelGroup>
        </Panel>

        <PanelResizeHandle className="resize-handle" />

        <Panel defaultSize={68} minSize={30} className="changes-content-panel">
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
            {selected && selectedFile ? (
              <div className="selected-file-summary">
                <span className={`selected-status ${fileStatusClass(changeCode(selectedFile))}`}>{fileStatusLabel(changeCode(selectedFile))}</span>
                <span className="selected-path">{selectedFile.path}</span>
              </div>
            ) : null}
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
      </PanelGroup>
    </div>
  );
}
