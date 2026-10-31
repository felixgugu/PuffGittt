import type { ReactNode } from "react";
import {
  Branch24Regular,
  DocumentBulletList24Regular,
  Folder24Regular,
  History24Regular,
  PanelLeftContract24Regular,
  PanelLeftExpand24Regular,
  Warning24Regular,
  ArrowSync24Regular,
} from "@fluentui/react-icons";
import { useTranslation } from "react-i18next";
import type { RepoTab, ViewKey } from "../store";
import type { WorkspaceRepository } from "../types";

interface SidebarProps {
  activeTab?: RepoTab;
  collapsed: boolean;
  repositories: WorkspaceRepository[];
  changeCount?: number;
  hasConflicts?: boolean;
  onToggle: () => void;
  onNavigate: (view: ViewKey) => void;
  onOpenRepository: (path: string) => void;
  onOpenProjects: () => void;
}

const navItems: { key: ViewKey; icon: ReactNode }[] = [
  { key: "changes", icon: <DocumentBulletList24Regular /> },
  { key: "history", icon: <History24Regular /> },
  { key: "branches", icon: <Branch24Regular /> },
  { key: "conflicts", icon: <Warning24Regular /> },
  { key: "stashes", icon: <ArrowSync24Regular /> },
];

export function Sidebar({
  activeTab,
  collapsed,
  repositories,
  changeCount = 0,
  hasConflicts = false,
  onToggle,
  onNavigate,
  onOpenRepository,
  onOpenProjects,
}: SidebarProps) {
  const { t } = useTranslation();
  const projectRepos = repositories.filter((repo) => repo.kind === "project");
  const recentRepos = repositories.filter((repo) => repo.kind !== "project");

  return (
    <aside className={`app-sidebar${collapsed ? " collapsed" : ""}`}>
      <div className="sidebar-head">
        {!collapsed ? <span className="sidebar-workspace-label">{t("sidebar.workspace")}</span> : null}
        <button
          type="button"
          className="sidebar-toggle"
          title={collapsed ? t("sidebar.expand") : t("sidebar.collapse")}
          onClick={onToggle}
        >
          {collapsed ? <PanelLeftExpand24Regular /> : <PanelLeftContract24Regular />}
        </button>
      </div>

      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`nav-item${activeTab?.view === item.key ? " active" : ""}`}
            disabled={!activeTab}
            title={t(`nav.${item.key}`)}
            onClick={() => activeTab && onNavigate(item.key)}
          >
            <span className="nav-icon">{item.icon}</span>
            {!collapsed ? <span className="nav-label">{t(`nav.${item.key}`)}</span> : null}
            {!collapsed && item.key === "changes" && changeCount > 0 ? (
              <span className="nav-badge">{changeCount > 99 ? "99+" : changeCount}</span>
            ) : null}
            {!collapsed && item.key === "conflicts" && hasConflicts ? (
              <span className="nav-badge warning">!</span>
            ) : null}
          </button>
        ))}
      </nav>

      {!collapsed ? (
        <div className="sidebar-repos">
          <div className="sidebar-section-title">
            <span>{t("sidebar.projects")}</span>
            <button type="button" className="sidebar-mini-button" title={t("sidebar.openProjects")} onClick={onOpenProjects}>
              <Folder24Regular />
            </button>
          </div>
          <div className="repo-list">
            {projectRepos.map((repo) => (
              <button
                key={`p-${repo.path}`}
                type="button"
                className={`repo-list-item${activeTab?.repo.rootPath === repo.path ? " active" : ""}`}
                title={repo.path}
                onClick={() => onOpenRepository(repo.path)}
              >
                <span className="repo-list-name">{repo.name}</span>
                <span className="repo-list-meta">
                  <span>{repo.branch || "-"}</span>
                  {repo.changes > 0 ? <span className="repo-list-changes">{repo.changes}</span> : null}
                </span>
              </button>
            ))}
            {projectRepos.length === 0 ? <div className="repo-list-empty">{t("sidebar.noRepos")}</div> : null}
          </div>

          {recentRepos.length > 0 ? (
            <>
              <div className="sidebar-section-title">{t("sidebar.recent")}</div>
              <div className="repo-list recent">
                {recentRepos.map((repo) => (
                  <button
                    key={`r-${repo.path}`}
                    type="button"
                    className={`repo-list-item${activeTab?.repo.rootPath === repo.path ? " active" : ""}`}
                    title={repo.path}
                    onClick={() => onOpenRepository(repo.path)}
                  >
                    <span className="repo-list-name">{repo.name}</span>
                    <span className="repo-list-meta">{repo.branch || "-"}</span>
                  </button>
                ))}
              </div>
            </>
          ) : null}
        </div>
      ) : (
        <div className="sidebar-collapsed-spacer" />
      )}
    </aside>
  );
}
