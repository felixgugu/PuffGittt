import { Badge } from "@fluentui/react-components";
import { useTranslation } from "react-i18next";
import type { Environment, Status } from "../types";

interface StatusBarProps {
  status?: Status;
  environment?: Environment;
  language: string;
  message?: string;
}

export function StatusBar({ status, environment, language, message }: StatusBarProps) {
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
              <Badge appearance="tint" color="warning">
                {status.repo.operation}
              </Badge>
            ) : null}
          </>
        ) : null}
      </div>
      <div className="status-message" title={message}>{message || ""}</div>
      <div className="status-right">
        <span>{environment?.gitFound ? environment.gitVersion.replace("git version ", "Git ") : t("settings.gitMissing")}</span>
        <span>{language === "zh-TW" ? "繁體中文" : "English"}</span>
        <span>UTF-8</span>
      </div>
    </footer>
  );
}
