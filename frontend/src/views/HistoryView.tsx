import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import {
  Badge,
  Button,
  Checkbox,
  Input,
  Spinner,
} from "@fluentui/react-components";
import {
  Branch24Regular,
  Copy24Regular,
  DocumentText24Regular,
  Search24Regular,
} from "@fluentui/react-icons";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { useVirtualizer } from "@tanstack/react-virtual";
import { api } from "../bridge/api";
import { useAppStore, type RepoTab } from "../store";
import { buildGraph } from "../lib/graph";
import { CommitGraph } from "../components/CommitGraph";
import { DiffEditor } from "../components/DiffEditor";
import { formatDate, shortOid } from "../lib/format";

interface HistoryViewProps {
  tab: RepoTab;
}

export function HistoryView({ tab }: HistoryViewProps) {
  const { t } = useTranslation();
  const root = tab.repo.rootPath;
  const selectCommit = useAppStore((state) => state.selectCommit);
  const setStatusMessage = useAppStore((state) => state.setStatusMessage);
  const [branch, setBranch] = useState(tab.repo.branch || "");
  const [allBranches, setAllBranches] = useState(false);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [splitDiff, setSplitDiff] = useState(false);
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

  useEffect(() => {
    if (detail.data?.files.length) {
      if (!selectedFile || !detail.data.files.some((file) => file.path === selectedFile)) {
        setSelectedFile(detail.data.files[0].path);
      }
    } else {
      setSelectedFile(null);
    }
  }, [detail.data, selectedFile]);

  const diff = useQuery({
    queryKey: ["commit-diff", root, tab.selectedCommit, selectedFile],
    queryFn: () => api.change.getDiff(root, selectedFile!, "commit", tab.selectedCommit || ""),
    enabled: !!tab.selectedCommit && !!selectedFile,
  });

  const virtualizer = useVirtualizer({
    count: commits.length,
    getScrollElement: () => listRef.current,
    estimateSize: () => 54,
    overscan: 12,
  });

  const localBranches = (branches.data || []).filter((entry) => entry.kind === "local");

  return (
    <div className="history-view">
      <div className="view-header">
        <div>
          <h1>{t("history.title")}</h1>
          <p>{root}</p>
        </div>
        <div className="view-header-actions">
          <Input
            value={search}
            onChange={(_, data) => setSearch(data.value)}
            contentBefore={<Search24Regular />}
            placeholder={t("history.search")}
            className="history-search"
          />
        </div>
      </div>

      <PanelGroup direction="horizontal" className="workspace-panels">
        <Panel defaultSize={18} minSize={14} className="panel-shell">
          <div className="panel-card branch-panel">
            <div className="panel-heading"><span>{t("branches.title")}</span></div>
            <Checkbox
              checked={allBranches}
              onChange={(_, data) => setAllBranches(!!data.checked)}
              label={t("history.allBranches")}
              className="history-all-branches"
            />
            <div className="branch-list">
              {localBranches.map((entry) => (
                <button
                  key={entry.name}
                  type="button"
                  className={`branch-item${branch === entry.name && !allBranches ? " active" : ""}`}
                  onClick={() => {
                    setAllBranches(false);
                    setBranch(entry.name);
                  }}
                >
                  <Branch24Regular />
                  <span>{entry.name}</span>
                  {entry.current ? <Badge size="small" appearance="tint" color="success">HEAD</Badge> : null}
                </button>
              ))}
            </div>
          </div>
        </Panel>

        <PanelResizeHandle className="resize-handle" />

        <Panel defaultSize={48} minSize={30} className="panel-shell">
          <div className="panel-card commit-list-panel">
            <div className="panel-heading">
              <span>{t("history.title")}</span>
              <span className="muted">{commits.length} commits</span>
            </div>
            {history.isLoading ? (
              <div className="center-state"><Spinner label={t("common.loading")} /></div>
            ) : commits.length === 0 ? (
              <div className="center-state"><DocumentText24Regular /><p>{t("history.noCommits")}</p></div>
            ) : (
              <div ref={listRef} className="commit-list-scroll">
                <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
                  {virtualizer.getVirtualItems().map((virtualRow) => {
                    const commit = commits[virtualRow.index];
                    const node = graph.nodes[virtualRow.index];
                    return (
                      <div
                        key={commit.oid}
                        className={`commit-row${tab.selectedCommit === commit.oid ? " active" : ""}`}
                        style={{ transform: `translateY(${virtualRow.start}px)`, height: 54 }}
                        onClick={() => selectCommit(root, commit.oid)}
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

        <Panel defaultSize={34} minSize={24} className="panel-shell">
          <div className="panel-card commit-detail-panel">
            <div className="panel-heading">
              <span>{t("history.details")}</span>
              {detail.data ? (
                <>
                  <Button size="small" appearance="subtle" onClick={() => setSplitDiff((value) => !value)}>
                    {splitDiff ? t("changes.inline") : t("changes.split")}
                  </Button>
                  <Button
                    size="small"
                    appearance="subtle"
                    icon={<Copy24Regular />}
                    onClick={() => {
                      void navigator.clipboard.writeText(detail.data!.commit.oid);
                      setStatusMessage(t("common.copied"));
                    }}
                  >
                    {t("history.copyOid")}
                  </Button>
                </>
              ) : null}
            </div>
            {detail.isLoading ? (
              <div className="center-state"><Spinner label={t("common.loading")} /></div>
            ) : detail.data ? (
              <div className="commit-detail-content">
                <h3>{detail.data.commit.subject}</h3>
                <div className="detail-meta">
                  <span>{detail.data.commit.author}</span>
                  <span>{formatDate(detail.data.commit.authorTime)}</span>
                  <span className="commit-oid">{detail.data.commit.oid}</span>
                </div>
                <pre className="commit-message-full">{detail.data.commit.message || detail.data.commit.subject}</pre>
                <div className="detail-section-heading">{t("history.changedFiles")}</div>
                <div className="detail-file-list">
                  {detail.data.files.map((file) => (
                    <button
                      key={file.path}
                      type="button"
                      className={`detail-file${selectedFile === file.path ? " active" : ""}`}
                      onClick={() => setSelectedFile(file.path)}
                    >
                      <span className="detail-file-status">{file.status}</span>
                      <span>{file.path}</span>
                    </button>
                  ))}
                  {detail.data.files.length === 0 ? <div className="empty-state">{t("history.noFiles")}</div> : null}
                </div>
                <div className="detail-section-heading">{t("history.diff")}</div>
                <div className="commit-diff-shell">
                  {diff.data?.binary ? (
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
                  )}
                </div>
              </div>
            ) : (
              <div className="center-state"><p>{t("history.selectCommit")}</p></div>
            )}
          </div>
        </Panel>
      </PanelGroup>
    </div>
  );
}
