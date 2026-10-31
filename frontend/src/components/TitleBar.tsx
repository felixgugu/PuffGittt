import { Add24Regular, Dismiss24Regular, Settings24Regular, Subtract24Regular } from "@fluentui/react-icons";
import { useTranslation } from "react-i18next";
import type { RepoTab } from "../store";

interface TitleBarProps {
  tabs: RepoTab[];
  activeId?: string;
  maximized: boolean;
  onActivate: (id: string) => void;
  onCloseTab: (id: string) => void;
  onOpen: () => void;
  onSettings: () => void;
  onMinimize: () => void;
  onToggleMaximize: () => void;
  onClose: () => void;
}

function MaximizeIcon({ restore }: { restore: boolean }) {
  if (restore) {
    return (
      <svg viewBox="0 0 12 12" aria-hidden="true">
        <path d="M3.5 3.5h5v5h-5zM2 2h5v1.5H3.5V7H2z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 12 12" aria-hidden="true">
      <path d="M2.5 2.5h7v7h-7z" />
    </svg>
  );
}

export function TitleBar({
  tabs,
  activeId,
  maximized,
  onActivate,
  onCloseTab,
  onOpen,
  onSettings,
  onMinimize,
  onToggleMaximize,
  onClose,
}: TitleBarProps) {
  const { t } = useTranslation();
  return (
    <div
      className="window-titlebar"
      onDoubleClick={(event) => {
        const target = event.target as HTMLElement;
        if (target.closest("button, .repo-tab")) return;
        onToggleMaximize();
      }}
    >
      <div className="repo-tabs">
        {tabs.map((tab) => (
          <div
            key={tab.repo.rootPath}
            className={`repo-tab${tab.repo.rootPath === activeId ? " active" : ""}`}
            onClick={() => onActivate(tab.repo.rootPath)}
          >
            <span className="repo-tab-name">{tab.repo.name}</span>
            <button
              type="button"
              className="repo-tab-close"
              title={t("toolbar.closeTab")}
              onClick={(event) => {
                event.stopPropagation();
                onCloseTab(tab.repo.rootPath);
              }}
            >
              <Dismiss24Regular />
            </button>
          </div>
        ))}
        <button type="button" className="titlebar-icon-button" title={t("welcome.open")} onClick={onOpen}>
          <Add24Regular />
        </button>
      </div>

      <div className="titlebar-spacer" />

      <div className="window-actions">
        <button type="button" className="titlebar-icon-button" title={t("toolbar.settings")} onClick={onSettings}>
          <Settings24Regular />
        </button>
        <button type="button" className="window-button" title={t("titlebar.minimize")} onClick={onMinimize}>
          <Subtract24Regular />
        </button>
        <button
          type="button"
          className="window-button"
          title={maximized ? t("titlebar.restore") : t("titlebar.maximize")}
          onClick={onToggleMaximize}
        >
          <MaximizeIcon restore={maximized} />
        </button>
        <button type="button" className="window-button close-button" title={t("titlebar.close")} onClick={onClose}>
          <Dismiss24Regular />
        </button>
      </div>
    </div>
  );
}
