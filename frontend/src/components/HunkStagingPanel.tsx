import { useState } from "react";
import { Checkbox } from "@fluentui/react-components";
import { ChevronDown24Regular, ChevronRight24Regular } from "@fluentui/react-icons";
import type { DiffHunk, HunkSelection } from "../types";

interface HunkStagingPanelProps {
  hunks: DiffHunk[];
  side: "staged" | "unstaged";
  busy?: boolean;
  onApply: (selections: HunkSelection[]) => Promise<boolean>;
}

export function HunkStagingPanel({ hunks, side, busy, onApply }: HunkStagingPanelProps) {
  const [expanded, setExpanded] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const actionLabel = side === "staged" ? "取消暫存" : "加入暫存";

  if (hunks.length === 0) return null;

  const changedCounts = hunks.map(
    (hunk) => hunk.lines.filter((line) => line.kind !== "context").length,
  );
  const totalChanged = changedCounts.reduce((sum, value) => sum + value, 0);

  const toggleLine = (key: string, value: boolean) => {
    setSelected((current) => {
      const next = new Set(current);
      if (value) next.add(key);
      else next.delete(key);
      return next;
    });
  };

  const selectedFor = (hunkIndex: number) =>
    hunks[hunkIndex].lines
      .map((line, lineIndex) => ({ line, lineIndex }))
      .filter(({ line, lineIndex }) => line.kind !== "context" && selected.has(`${hunkIndex}:${lineIndex}`))
      .map(({ lineIndex }) => lineIndex);

  const apply = async (selections: HunkSelection[]) => {
    const ok = await onApply(selections);
    if (ok) setSelected(new Set());
  };

  return (
    <div className="hunk-panel">
      <div className="hunk-panel-heading">
        <button
          type="button"
          className="hunk-panel-toggle"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
        >
          {expanded ? <ChevronDown24Regular /> : <ChevronRight24Regular />}
          <span>Hunk 動作</span>
        </button>
        <span className="muted">
          {hunks.length} hunks · {totalChanged} 變更行
        </span>
        <div className="tree-filter-spacer" />
        <span className="muted">勾選變更行後可{actionLabel}部分內容</span>
      </div>
      {expanded ? (
        <div className="hunk-panel-body">
          {hunks.map((hunk, hunkIndex) => {
            const selectedLines = selectedFor(hunkIndex);
            const changed = hunk.lines
              .map((line, lineIndex) => ({ line, lineIndex }))
              .filter(({ line }) => line.kind !== "context");
            const added = changed.filter(({ line }) => line.kind === "add").length;
            const deleted = changed.filter(({ line }) => line.kind === "delete").length;
            return (
              <div className="hunk-block" key={`${hunk.header}-${hunkIndex}`}>
                <div className="hunk-block-heading">
                  <code>{`@@ -${hunk.oldStart},${hunk.oldCount} +${hunk.newStart},${hunk.newCount} @@`}</code>
                  <span className="hunk-stat add">+{added}</span>
                  <span className="hunk-stat delete">-{deleted}</span>
                  <div className="tree-filter-spacer" />
                  <button
                    type="button"
                    className="tree-action-link"
                    disabled={!!busy}
                    onClick={() => void apply([{ hunk: hunkIndex, lines: [] }])}
                  >
                    {actionLabel}整個 Hunk
                  </button>
                  {selectedLines.length > 0 ? (
                    <button
                      type="button"
                      className="tree-action-link"
                      disabled={!!busy}
                      onClick={() => void apply([{ hunk: hunkIndex, lines: selectedLines }])}
                    >
                      {actionLabel}選取行（{selectedLines.length}）
                    </button>
                  ) : null}
                </div>
                <div className="hunk-lines">
                  {changed.map(({ line, lineIndex }) => {
                    const key = `${hunkIndex}:${lineIndex}`;
                    return (
                      <div
                        key={key}
                        className={`hunk-line ${line.kind}`}
                        onClick={() => toggleLine(key, !selected.has(key))}
                      >
                        <Checkbox
                          className="hunk-checkbox"
                          checked={selected.has(key)}
                          onChange={(_, data) => toggleLine(key, data.checked === true)}
                          onClick={(event) => event.stopPropagation()}
                          aria-label={`${line.kind === "add" ? "新增" : "刪除"}第 ${line.kind === "add" ? line.newLine : line.oldLine} 行`}
                        />
                        <span className="hunk-line-number">
                          {line.kind === "add" ? line.newLine : line.oldLine}
                        </span>
                        <span className="hunk-line-prefix">{line.kind === "add" ? "+" : "-"}</span>
                        <span className="hunk-line-text" title={line.text}>{line.text || " "}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
