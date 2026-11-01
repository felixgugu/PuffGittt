import { Badge, Spinner } from "@fluentui/react-components";
import { useTranslation } from "react-i18next";
import type { Status, TaskInfo } from "../types";

interface StatusBarProps {
  status?: Status;
  language: string;
  message?: string;
  task?: TaskInfo;
  onCancelTask?: (id: string) => void;
}

export function StatusBar({ status, language, message, task, onCancelTask }: StatusBarProps) {
  const { t } = useTranslation();
  return (
    <footer className="status-bar">
      <div className="status-left">
        <span className="status-branch">{status?.repo.branch || t("toolbar.noBranch")}</span>
        {status ? (
          <>
            <span>{status.files.length} {t("status.changed")}</span>
            {status.repo.upstream ? (
              <span>
                {status.ahead > 0 ? t("status.ahead", { count: status.ahead }) : null}
                {status.ahead > 0 && status.behind > 0 ? " / " : null}
                {status.behind > 0 ? t("status.behind", { count: status.behind }) : null}
                {status.ahead === 0 && status.behind === 0 ? t("status.upToDate") : null}
              </span>
            ) : (
              <span>{t("status.noUpstream")}</span>
            )}
            {status.repo.operation !== "normal" ? (
              <Badge appearance="tint" color="warning">{status.repo.operation}</Badge>
            ) : null}
          </>
        ) : null}
      </div>
      {task ? (
        <div className="status-task" title={task.message || task.operation}>
          <Spinner size="extra-tiny" />
          <span className="status-task-operation">{task.operation}</span>
          <span className="status-task-message">
            {task.message || (task.state === "queued" ? "等待中" : "執行中")}
          </span>
          {task.cancellable && task.state === "running" && onCancelTask ? (
            <button type="button" className="status-task-cancel" onClick={() => onCancelTask(task.id)}>
              取消
            </button>
          ) : null}
        </div>
      ) : (
        <div className="status-message" title={message}>{message || ""}</div>
      )}
      <div className="status-right">
        <span>{language === "zh-TW" ? "繁體中文" : "English"}</span>
        <span>UTF-8</span>
      </div>
    </footer>
  );
}
