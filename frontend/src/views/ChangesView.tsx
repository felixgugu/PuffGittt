import { useEffect, useMemo, useRef, useState } from "react";
import {
  Badge,
  Button,
  Checkbox,
  Spinner,
} from "@fluentui/react-components";
import {
  Checkmark24Regular,
  ChevronRight24Regular,
  DocumentText24Regular,
  FolderOpen24Regular,
  History24Regular,
} from "@fluentui/react-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Panel, PanelGroup, PanelResizeHandle, type ImperativePanelHandle } from "react-resizable-panels";
import { api } from "../bridge/api";
import { useAppStore, type RepoTab } from "../store";
import type { FileChange, HunkSelection } from "../types";
import { ChangesFilesPanel } from "../components/ChangesFilesPanel";
import { DiffEditor } from "../components/DiffEditor";
import { HunkStagingPanel } from "../components/HunkStagingPanel";
import { FileInsightsDialog } from "../components/FileInsightsDialog";
import { ImageDiff } from "../components/ImageDiff";
import { UnderlineInput, UnderlineTextarea } from "../components/FormControls";
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
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [filesCollapsed, setFilesCollapsed] = useState(false);
  const [insightsOpen, setInsightsOpen] = useState(false);
  const filesPanelRef = useRef<ImperativePanelHandle>(null);

  const statusQuery = useQuery({
    queryKey: ["status", root],
    queryFn: () => api.repo.getStatus(root),
  });
  const status = statusQuery.data;
  const draftKey = `puffgittt:commit-draft:${root}`;

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

  useEffect(() => {
    setDraftLoaded(false);
    try {
      const saved = JSON.parse(localStorage.getItem(draftKey) || "null");
      setSubject(saved?.subject || "");
      setDescription(saved?.description || "");
      setAmend(!!saved?.amend);
    } catch {
      setSubject("");
      setDescription("");
      setAmend(false);
    }
    setDraftLoaded(true);
  }, [draftKey]);

  useEffect(() => {
    if (!draftLoaded) return;
    try {
      localStorage.setItem(draftKey, JSON.stringify({ subject, description, amend }));
    } catch {}
  }, [amend, description, draftKey, draftLoaded, subject]);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["status", root] });
    void queryClient.invalidateQueries({ queryKey: ["history", root] });
    void queryClient.invalidateQueries({ queryKey: ["conflicts", root] });
    void queryClient.invalidateQueries({ queryKey: ["diff", root] });
    void queryClient.invalidateQueries({ queryKey: ["change-dialog-diff", root] });
  };

  const run = async (label: string, action: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await action();
      setStatusMessage(label);
      invalidate();
      return true;
    } catch (error: any) {
      setStatusMessage(error?.message || String(error));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const stage = (files: FileChange[]) => {
    if (!files.length) return Promise.resolve(false);
    return run(t("changes.operationDone"), () => api.change.stage(root, files.map((file) => file.path)));
  };

  const unstage = (files: FileChange[]) => {
    if (!files.length) return Promise.resolve(false);
    return run(t("changes.operationDone"), () => api.change.unstage(root, files.map((file) => file.path)));
  };

  const discard = (files: FileChange[]) => {
    if (!files.length) return Promise.resolve(false);
    if (!window.confirm("確定要捨棄選取的變更嗎？此操作可能無法復原。")) return Promise.resolve(false);
    return run(t("changes.operationDone"), () => api.change.discard(root, files.map((file) => file.path)));
  };

  const applyHunksFor = (
    path: string,
    side: "staged" | "unstaged",
    patchHash: string,
    selections: HunkSelection[],
  ) => {
    const label = side === "staged" ? "已取消暫存選取的變更" : "已暫存選取的變更";
    return run(label, () => api.change.applyHunks(root, path, side, patchHash, selections));
  };

  const applyHunks = (selections: HunkSelection[]) => {
    if (!selected || !diffQuery.data) return Promise.resolve(false);
    return applyHunksFor(selected.path, selectedSide, diffQuery.data.patchHash || "", selections);
  };

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

  const stagedCount = trackedFiles.filter(fileHasStaged).length;

  return (
    <div className="changes-view">
      <PanelGroup direction="horizontal" className="changes-shell">
        <Panel
          ref={filesPanelRef}
          defaultSize={32}
          minSize={24}
          collapsible
          collapsedSize={0}
          onCollapse={() => setFilesCollapsed(true)}
          onExpand={() => setFilesCollapsed(false)}
          className="changes-left-panel"
        >
          <PanelGroup direction="vertical">
            <Panel defaultSize={58} minSize={24} className="tree-panel-shell">
              <div className="panel-card tree-card">
                <ChangesFilesPanel
                  key={`${root}-files`}
                  root={root}
                  trackedFiles={trackedFiles}
                  untrackedFiles={untrackedFiles}
                  selectedPath={selected?.path}
                  busy={busy}
                  onSelect={(file, side) => selectFile(root, { path: file.path, side })}
                  onStage={stage}
                  onUnstage={unstage}
                  onDiscard={discard}
                  onApplyHunks={(file, side, patchHash, selections) =>
                    applyHunksFor(file.path, side, patchHash, selections)
                  }
                  onCollapse={() => filesPanelRef.current?.collapse()}
                />
              </div>
            </Panel>
            <PanelResizeHandle className="resize-handle horizontal" />
            <Panel defaultSize={42} minSize={20} className="tree-panel-shell">
              <div className="panel-card commit-panel">
                <div className="panel-heading"><span>{t("changes.commit")}</span><span className="muted">{t("changes.stagedCount", { count: stagedCount })}</span></div>
                <div className="commit-form compact">
                  <UnderlineInput
                    value={subject}
                    onChange={(_, data) => setSubject(data.value)}
                    placeholder={t("changes.commitSubject")}
                    maxLength={120}
                  />
                  <UnderlineTextarea
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
          </PanelGroup>
        </Panel>

        <PanelResizeHandle className="resize-handle" />

        <Panel defaultSize={68} minSize={30} className="changes-content-panel">
          {filesCollapsed ? (
            <button
              type="button"
              className="files-expand-button"
              title="展開檔案面板"
              onClick={() => filesPanelRef.current?.expand()}
            >
              <ChevronRight24Regular />
            </button>
          ) : null}
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
                    <Button
                      size="small"
                      appearance="subtle"
                      icon={<History24Regular />}
                      title="File History / Blame"
                      aria-label="File History / Blame"
                      onClick={() => setInsightsOpen(true)}
                    />
                    <Button size="small" appearance="subtle" icon={<FolderOpen24Regular />} title={t("changes.openInExplorer")} onClick={() => void api.app.openInExplorer(root)} />
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
            {selected && diffQuery.data && !diffQuery.data.binary && !diffQuery.data.image ? (
              <HunkStagingPanel
                key={`${selected.path}:${selectedSide}:${diffQuery.data.patchHash || ""}`}
                hunks={diffQuery.data.hunks || []}
                side={selectedSide}
                busy={busy}
                onApply={applyHunks}
              />
            ) : null}
            {diffQuery.isLoading ? (
              <div className="center-state"><Spinner label={t("common.loading")} /></div>
            ) : diffQuery.data?.image ? (
              <ImageDiff
                mime={diffQuery.data.imageMime}
                oldData={diffQuery.data.oldImage}
                newData={diffQuery.data.newImage}
              />
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
      {insightsOpen && selected ? (
        <FileInsightsDialog root={root} path={selected.path} onClose={() => setInsightsOpen(false)} />
      ) : null}
    </div>
  );
}
