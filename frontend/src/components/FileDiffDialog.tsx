import { useEffect, type ReactNode } from "react";
import { Button } from "@fluentui/react-components";
import {
  ArrowMaximize24Regular,
  ArrowMinimize24Regular,
  ChevronLeft24Regular,
  ChevronRight24Regular,
  Dismiss24Regular,
} from "@fluentui/react-icons";

interface FileDiffDialogProps {
  path: string;
  statusLabel: string;
  statusClass: string;
  position: number;
  total: number;
  splitDiff: boolean;
  maximized: boolean;
  filesPanel: ReactNode;
  diffContent: ReactNode;
  onPrevious: () => void;
  onNext: () => void;
  onToggleSplit: () => void;
  onToggleMaximized: () => void;
  onClose: () => void;
}

export function FileDiffDialog({
  path,
  statusLabel,
  statusClass,
  position,
  total,
  splitDiff,
  maximized,
  filesPanel,
  diffContent,
  onPrevious,
  onNext,
  onToggleSplit,
  onToggleMaximized,
  onClose,
}: FileDiffDialogProps) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div
        className={`modal diff-dialog${maximized ? " maximized" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={path}
      >
        <div className="diff-dialog-header">
          <div className="diff-dialog-title">
            <span className={`detail-file-status ${statusClass}`}>{statusLabel}</span>
            <span className="diff-dialog-path" title={path}>{path}</span>
          </div>
          <div className="diff-dialog-toolbar">
            <span className="muted">{position} / {total}</span>
            <Button
              size="small"
              appearance="subtle"
              icon={<ChevronLeft24Regular />}
              title="上一個檔案"
              disabled={position <= 1 || total === 0}
              onClick={onPrevious}
            />
            <Button
              size="small"
              appearance="subtle"
              icon={<ChevronRight24Regular />}
              title="下一個檔案"
              disabled={total === 0 || position >= total}
              onClick={onNext}
            />
            <Button size="small" appearance="subtle" onClick={onToggleSplit}>
              {splitDiff ? "單欄" : "並排"}
            </Button>
            <Button
              size="small"
              appearance="subtle"
              icon={maximized ? <ArrowMinimize24Regular /> : <ArrowMaximize24Regular />}
              title={maximized ? "還原" : "最大化"}
              onClick={onToggleMaximized}
            />
            <Button
              size="small"
              appearance="subtle"
              icon={<Dismiss24Regular />}
              title="關閉"
              onClick={onClose}
            />
          </div>
        </div>
        <div className="diff-dialog-body">
          <aside className="diff-dialog-files">{filesPanel}</aside>
          <section className="diff-dialog-content">{diffContent}</section>
        </div>
      </div>
    </div>
  );
}
