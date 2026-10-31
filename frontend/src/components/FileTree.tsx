import { useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@fluentui/react-components";
import {
  ArrowUndo24Regular,
  Checkmark24Regular,
  ChevronDown24Regular,
  ChevronRight24Regular,
  Document24Regular,
  Folder24Regular,
  FolderOpen24Regular,
} from "@fluentui/react-icons";
import { useTranslation } from "react-i18next";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { FileChange } from "../types";
import {
  allDirectoryPaths,
  fileHasStaged,
  fileHasUnstaged,
  filterFiles,
  flattenTree,
  type TreeFilter,
} from "../lib/fileTree";
import { fileStatusClass, fileStatusLabel } from "../lib/format";

interface FileTreeProps {
  title: string;
  files: FileChange[];
  storageKey: string;
  selectedPath?: string;
  emptyText: string;
  busy?: boolean;
  filterable?: boolean;
  onSelect: (file: FileChange, side: "staged" | "unstaged") => void;
  onStage?: (file: FileChange) => void;
  onUnstage?: (file: FileChange) => void;
  onStageAll?: () => void;
  onUnstageAll?: () => void;
}

export function FileTree({
  title,
  files,
  storageKey,
  selectedPath,
  emptyText,
  busy,
  filterable = false,
  onSelect,
  onStage,
  onUnstage,
  onStageAll,
  onUnstageAll,
}: FileTreeProps) {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<TreeFilter>("all");
  const loadExpanded = (list: FileChange[]): Set<string> => {
    try {
      const saved = localStorage.getItem(`puffgittt:tree:${storageKey}`);
      if (saved) {
        const parsed = JSON.parse(saved) as string[];
        if (parsed.length > 0) return new Set(parsed);
      }
    } catch {}
    return new Set(allDirectoryPaths(list));
  };
  const [expanded, setExpanded] = useState<Set<string>>(() => loadExpanded(files));
  const scrollRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(files.length > 0);

  useEffect(() => {
    if (initializedRef.current || files.length === 0) return;
    initializedRef.current = true;
    setExpanded(loadExpanded(files));
  }, [files, storageKey]);

  useEffect(() => {
    if (!initializedRef.current) return;
    try {
      localStorage.setItem(`puffgittt:tree:${storageKey}`, JSON.stringify([...expanded]));
    } catch {}
  }, [expanded, storageKey]);

  const visibleFiles = useMemo(
    () => (filterable ? filterFiles(files, filter) : files),
    [files, filter, filterable],
  );
  const rows = useMemo(() => flattenTree(visibleFiles, expanded), [visibleFiles, expanded]);
  const stagedCount = useMemo(() => files.filter(fileHasStaged).length, [files]);
  const unstagedCount = useMemo(() => files.filter(fileHasUnstaged).length, [files]);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 28,
    overscan: 12,
  });

  const toggleDir = (path: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const expandAll = () => setExpanded(new Set(allDirectoryPaths(visibleFiles)));
  const collapseAll = () => setExpanded(new Set());

  return (
    <section className="tree-panel">
      <div className="tree-heading">
        <div className="tree-heading-main">
          <span className="tree-title">{title}</span>
          <Badge size="small" appearance="tint">{visibleFiles.length}</Badge>
        </div>
        <div className="tree-heading-actions">
          <button type="button" className="tree-mini-button" title={t("changes.expandAll")} onClick={expandAll}>
            <ChevronDown24Regular />
          </button>
          <button type="button" className="tree-mini-button" title={t("changes.collapseAll")} onClick={collapseAll}>
            <ChevronRight24Regular />
          </button>
        </div>
      </div>

      {filterable ? (
        <div className="tree-filters">
          <button type="button" className={`tree-filter${filter === "all" ? " active" : ""}`} onClick={() => setFilter("all")}>
            {t("changes.filterAll")}
          </button>
          <button type="button" className={`tree-filter${filter === "staged" ? " active" : ""}`} onClick={() => setFilter("staged")}>
            {t("changes.filterStaged")} <span>{stagedCount}</span>
          </button>
          <button type="button" className={`tree-filter${filter === "unstaged" ? " active" : ""}`} onClick={() => setFilter("unstaged")}>
            {t("changes.filterUnstaged")} <span>{unstagedCount}</span>
          </button>
          <div className="tree-filter-spacer" />
          {onUnstageAll && stagedCount > 0 ? (
            <button type="button" className="tree-action-link" onClick={onUnstageAll} disabled={busy}>
              {t("changes.unstageAll")}
            </button>
          ) : null}
          {onStageAll && unstagedCount > 0 ? (
            <button type="button" className="tree-action-link" onClick={onStageAll} disabled={busy}>
              {t("changes.stageAll")}
            </button>
          ) : null}
        </div>
      ) : onStageAll && visibleFiles.length > 0 ? (
        <div className="tree-filters">
          <div className="tree-filter-spacer" />
          <button type="button" className="tree-action-link" onClick={onStageAll} disabled={busy}>
            {t("changes.stageAll")}
          </button>
        </div>
      ) : null}

      {rows.length === 0 ? (
        <div className="empty-state">{emptyText}</div>
      ) : (
        <div ref={scrollRef} className="tree-scroll">
          <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const row = rows[virtualRow.index];
              const isSelected = row.type === "file" && row.path === selectedPath;
              const staged = row.file ? fileHasStaged(row.file) : false;
              const unstaged = row.file ? fileHasUnstaged(row.file) : false;
              return (
                <div
                  key={`${row.type}-${row.path}`}
                  className={`tree-row${isSelected ? " selected" : ""}${row.type === "dir" ? " directory" : ""}`}
                  style={{
                    transform: `translateY(${virtualRow.start}px)`,
                    paddingLeft: 8 + row.depth * 14,
                  }}
                  onClick={() => {
                    if (row.type === "dir") {
                      toggleDir(row.path);
                    } else if (row.file) {
                      const side =
                        filter === "staged"
                          ? "staged"
                          : filter === "unstaged"
                            ? "unstaged"
                            : unstaged
                              ? "unstaged"
                              : "staged";
                      onSelect(row.file, side);
                    }
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
                      <span className="tree-name">{row.name}</span>
                      {row.status ? (
                        <span className={`tree-status ${fileStatusClass(row.status)}`}>{fileStatusLabel(row.status)}</span>
                      ) : null}
                      <span className="tree-count">{row.count}</span>
                    </>
                  ) : (
                    <>
                      <span className="tree-chevron spacer" />
                      <span className="tree-icon"><Document24Regular /></span>
                      <span className="tree-name" title={row.path}>{row.name}</span>
                      {row.status ? (
                        <span className={`tree-status ${fileStatusClass(row.status)}`}>{fileStatusLabel(row.status)}</span>
                      ) : null}
                      {staged ? <span className="tree-state-dot staged" title={t("changes.staged")} /> : null}
                      {unstaged ? <span className="tree-state-dot unstaged" title={t("changes.unstaged")} /> : null}
                      <span className="tree-row-actions" onClick={(event) => event.stopPropagation()}>
                        {unstaged && onStage ? (
                          <button type="button" className="tree-row-button" title={t("changes.stage")} disabled={busy} onClick={() => onStage(row.file!)}>
                            <Checkmark24Regular />
                          </button>
                        ) : null}
                        {staged && onUnstage ? (
                          <button type="button" className="tree-row-button" title={t("changes.unstage")} disabled={busy} onClick={() => onUnstage(row.file!)}>
                            <ArrowUndo24Regular />
                          </button>
                        ) : null}
                      </span>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
