import { Button, Spinner } from "@fluentui/react-components";

interface GitCommandDialogProps {
  title: string;
  description?: string;
  command: string;
  warning?: string;
  destructive?: boolean;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function GitCommandDialog({
  title,
  description,
  command,
  warning,
  destructive,
  busy,
  onCancel,
  onConfirm,
}: GitCommandDialogProps) {
  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !busy && onCancel()}>
      <div className="modal small git-command-dialog" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-header">
          <h2>{title}</h2>
        </div>
        <div className="modal-body git-command-dialog-body">
          {description ? <p className="git-command-description">{description}</p> : null}
          <pre className="git-command-preview"><code>{command}</code></pre>
          {warning ? <p className={`git-command-warning${destructive ? " destructive" : ""}`}>{warning}</p> : null}
        </div>
        <div className="modal-footer">
          <Button appearance="secondary" onClick={onCancel} disabled={busy}>
            取消
          </Button>
          <Button appearance="primary" onClick={onConfirm} disabled={busy}>
            {busy ? <Spinner size="tiny" /> : "確認執行"}
          </Button>
        </div>
      </div>
    </div>
  );
}
