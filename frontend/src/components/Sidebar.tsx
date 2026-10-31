import { useEffect, useMemo, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import {
  Branch24Regular,
  DocumentBulletList24Regular,
  Folder24Regular,
  History24Regular,
  PanelLeftContract24Regular,
  PanelLeftExpand24Regular,
  Tag24Regular,
  Warning24Regular,
  ArrowSync24Regular,
} from "@fluentui/react-icons";
import { useTranslation } from "react-i18next";
import type { RepoTab, ViewKey } from "../store";
import type { WorkspaceRepository } from "../types";

interface SidebarProps {
  activeTab?: RepoTab;
  collapsed: boolean;
  branch?: string;
  repositories: WorkspaceRepository[];
  changeCount?: number;
  hasConflicts?: boolean;
  onToggle: () => void;
  onNavigate: (view: ViewKey) => void;
  onOpenRepository: (path: string) => void;
  onOpenProjects: () => void;
}

const navItems: { key: ViewKey; icon: ReactNode; label?: string }[] = [
  { key: "changes", icon: <DocumentBulletList24Regular /> },
  { key: "history", icon: <History24Regular /> },
  { key: "branches", icon: <Branch24Regular /> },
  { key: "tags", icon: <Tag24Regular />, label: "Tags" },
  { key: "conflicts", icon: <Warning24Regular /> },
  { key: "stashes", icon: <ArrowSync24Regular /> },
];

export function Sidebar({
  activeTab,
  collapsed,
  branch = "",
  repositories,
  changeCount = 0,
  hasConflicts = false,
  onToggle,
  onNavigate,
  onOpenRepository,
  onOpenProjects,
}: SidebarProps) {
  const { t } = useTranslation();
  const repoItems = useMemo(() => {
    const seen = new Set<string>();
    return repositories.filter((repo) => {
      if (seen.has(repo.path)) return false;
      seen.add(repo.path);
      return true;
    });
  }, [repositories]);
  const [reposHeight, setReposHeight] = useState(() => {
    const stored = Number(localStorage.getItem("puffgittt:sidebarReposHeight"));
    return Number.isFinite(stored) && stored >= 140 ? stored : 240;
  });

  useEffect(() => {
    localStorage.setItem("puffgittt:sidebarReposHeight", String(reposHeight));
  }, [reposHeight]);

  const beginReposResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const startY = event.clientY;
    const startHeight = reposHeight;
    const sidebarHeight = event.currentTarget.parentElement?.clientHeight || window.innerHeight;
    const maxHeight = Math.max(180, sidebarHeight - 260);
    const move = (moveEvent: PointerEvent) => {
      const next = Math.min(maxHeight, Math.max(140, startHeight + startY - moveEvent.clientY));
      setReposHeight(next);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up, { once: true });
  };

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
            title={item.key === "branches" && branch ? `${t("nav.branches")} · ${branch}` : item.label ?? t(`nav.${item.key}`)}
            onClick={() => activeTab && onNavigate(item.key)}
          >
            <span className="nav-icon">{item.icon}</span>
            {!collapsed ? <span className="nav-label">{item.label ?? t(`nav.${item.key}`)}</span> : null}
            {!collapsed && item.key === "branches" && branch ? (
              <span className="nav-branch" title={branch}>{branch}</span>
            ) : null}
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
        <>
          <div className="sidebar-repos-spacer" />
          <div
            className="sidebar-repos-resizer"
            onPointerDown={beginReposResize}
            role="separator"
            aria-orientation="horizontal"
          />
          <div className="sidebar-repos" style={{ height: reposHeight }}>
            <div className="sidebar-section-title">
              <span>{t("sidebar.projects")}</span>
              <button type="button" className="sidebar-mini-button" title={t("sidebar.openProjects")} onClick={onOpenProjects}>
                <Folder24Regular />
              </button>
            </div>
            <div className="repo-list-header" aria-hidden="true">
              <span>資料夾名稱</span>
              <span>分支</span>
              <span>數量</span>
            </div>
            <div className="repo-list">
              {repoItems.map((repo) => (
                <button
                  key={repo.path}
                  type="button"
                  className={`repo-list-item${activeTab?.repo.rootPath === repo.path ? " active" : ""}`}
                  title={repo.path}
                  onClick={() => onOpenRepository(repo.path)}
                >
                  <span className="repo-list-name">{repo.name}</span>
                  <span className="repo-list-branch">{repo.branch || "-"}</span>
                  <span className={`repo-list-changes${repo.changes > 0 ? "" : " empty"}`}>
                    {repo.changes > 0 ? repo.changes : "–"}
                  </span>
                </button>
              ))}
              {repoItems.length === 0 ? <div className="repo-list-empty">{t("sidebar.noRepos")}</div> : null}
            </div>
          </div>
        </>
      ) : (
        <div className="sidebar-collapsed-spacer" />
      )}
    </aside>
  );
}
