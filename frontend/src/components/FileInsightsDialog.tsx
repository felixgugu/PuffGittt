import { useState } from "react";
import { Button, Spinner } from "@fluentui/react-components";
import { Dismiss24Regular } from "@fluentui/react-icons";
import { useQuery } from "@tanstack/react-query";
import { api } from "../bridge/api";
import { formatDate, shortOid } from "../lib/format";

interface FileInsightsDialogProps {
  root: string;
  path: string;
  onClose: () => void;
}

type InsightsTab = "history" | "blame";

export function FileInsightsDialog({ root, path, onClose }: FileInsightsDialogProps) {
  const [tab, setTab] = useState<InsightsTab>("history");
  const history = useQuery({
    queryKey: ["file-history", root, path],
    queryFn: () => api.history.fileHistory(root, path, 200),
  });
  const blame = useQuery({
    queryKey: ["blame", root, path],
    queryFn: () => api.history.blame(root, path),
    enabled: tab === "blame",
  });

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="modal file-insights-modal" role="dialog" aria-modal="true" aria-label={`${path} 的檔案資訊`}>
        <div className="modal-header">
          <h2 className="file-insights-title" title={path}>{path}</h2>
          <div className="file-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={tab === "history"}
              className={`file-tab${tab === "history" ? " active" : ""}`}
              onClick={() => setTab("history")}
            >
              File History
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "blame"}
              className={`file-tab${tab === "blame" ? " active" : ""}`}
              onClick={() => setTab("blame")}
            >
              Blame
            </button>
          </div>
          <Button appearance="subtle" icon={<Dismiss24Regular />} title="關閉" onClick={onClose} />
        </div>
        <div className="file-insights-body">
          {tab === "history" ? (
            history.isLoading ? (
              <div className="center-state"><Spinner label="載入中…" /></div>
            ) : history.isError ? (
              <div className="center-state"><p>{String((history.error as any)?.message || history.error)}</p></div>
            ) : (
              <div className="file-history-list">
                {(history.data || []).length === 0 ? <div className="empty-state">沒有歷史記錄</div> : null}
                {(history.data || []).map((commit) => (
                  <div className="file-history-row" key={commit.oid}>
                    <code>{shortOid(commit.oid)}</code>
                    <span className="file-history-subject" title={commit.subject}>{commit.subject}</span>
                    <span className="muted">{commit.author}</span>
                    <span className="muted">{formatDate(commit.date)}</span>
                  </div>
                ))}
              </div>
            )
          ) : blame.isLoading ? (
            <div className="center-state"><Spinner label="載入中…" /></div>
          ) : blame.isError ? (
            <div className="center-state"><p>{String((blame.error as any)?.message || blame.error)}</p></div>
          ) : (
            <div className="blame-list">
              {(blame.data || []).length === 0 ? <div className="empty-state">無法取得 Blame 資訊</div> : null}
              {(blame.data || []).map((line) => (
                <div className="blame-row" key={`${line.line}-${line.oid}`}>
                  <span className="blame-line-number">{line.line}</span>
                  <code className="blame-oid" title={`${line.oid} · ${line.summary}`}>{shortOid(line.oid)}</code>
                  <span className="blame-author" title={`${line.author} · ${formatDate(line.date)}`}>{line.author}</span>
                  <span className="blame-text">{line.text || " "}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
