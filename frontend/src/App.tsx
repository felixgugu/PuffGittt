import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { FluentProvider, Spinner } from "@fluentui/react-components";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import i18n from "./i18n";
import { api, setNativeTheme } from "./bridge/api";
import { useActiveTab, useAppStore, type ThemeMode, type ViewKey } from "./store";
import type { Environment, Repository, Settings } from "./types";
import { WelcomeView } from "./views/WelcomeView";
import { ChangesView } from "./views/ChangesView";
import { HistoryView } from "./views/HistoryView";
import { BranchesView } from "./views/BranchesView";
import { TagsView } from "./views/TagsView";
import { ConflictsView } from "./views/ConflictsView";
import { StashesView } from "./views/StashesView";
import { SettingsPanel } from "./components/SettingsPanel";
import { StatusBar } from "./components/StatusBar";
import { TitleBar } from "./components/TitleBar";
import { Sidebar } from "./components/Sidebar";
import { puffDarkTheme, puffLightTheme } from "./theme";

function useSystemDark(): boolean {
  const [dark, setDark] = useState(() => window.matchMedia("(prefers-color-scheme: dark)").matches);
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => setDark(media.matches);
    media.addEventListener("change", handler);
    return () => media.removeEventListener("change", handler);
  }, []);
  return dark;
}

const BASE_FONT_SIZE = 14;
const ROOT_FONT_SIZE = 16;

function rootFontSize(base: number): string {
  return `${(base / BASE_FONT_SIZE) * ROOT_FONT_SIZE}px`;
}

export default function App() {
  const { t } = useTranslation();
  const systemDark = useSystemDark();
  const theme = useAppStore((state) => state.theme);
  const setTheme = useAppStore((state) => state.setTheme);
  const language = useAppStore((state) => state.language);
  const setLanguage = useAppStore((state) => state.setLanguage);
  const sidebarCollapsed = useAppStore((state) => state.sidebarCollapsed);
  const setSidebarCollapsed = useAppStore((state) => state.setSidebarCollapsed);
  const settings = useAppStore((state) => state.settings);
  const setSettings = useAppStore((state) => state.setSettings);
  const environment = useAppStore((state) => state.environment);
  const setEnvironment = useAppStore((state) => state.setEnvironment);
  const statusMessage = useAppStore((state) => state.statusMessage);
  const setStatusMessage = useAppStore((state) => state.setStatusMessage);
  const tabs = useAppStore((state) => state.tabs);
  const activeId = useAppStore((state) => state.activeId);
  const setActive = useAppStore((state) => state.setActive);
  const closeTab = useAppStore((state) => state.closeTab);
  const openTab = useAppStore((state) => state.openTab);
  const setView = useAppStore((state) => state.setView);
  const lastRepoPath = useAppStore((state) => state.lastRepoPath);
  const lastView = useAppStore((state) => state.lastView);
  const activeTab = useActiveTab();
  const queryClient = useQueryClient();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const [restoring, setRestoring] = useState(() => !!lastRepoPath);
  const restoreRef = useRef(false);
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const stored = Number(localStorage.getItem("puffgittt:sidebarWidth"));
    return Number.isFinite(stored) && stored >= 200 && stored <= 320 ? stored : 240;
  });

  const dark = theme === "dark" || (theme === "system" && systemDark);
  const root = activeTab?.repo.rootPath;
  const baseFontSize = settings?.baseFontSize || 14;

  const statusQuery = useQuery({
    queryKey: ["status", root],
    queryFn: () => api.repo.getStatus(root!),
    enabled: !!root,
    refetchInterval: 10_000,
  });
  const workspaceQuery = useQuery({
    queryKey: ["workspaceRepositories", settings?.projectsRoot],
    queryFn: () => api.app.listWorkspaceRepositories(),
    enabled: !!settings,
  });
  const status = statusQuery.data;

  useEffect(() => {
    api.app.getSettings().then((loaded) => {
      setSettings(loaded);
      i18n.changeLanguage(loaded.language);
      setNativeTheme(loaded.theme);
    }).catch(() => {});
    api.app.getEnvironment().then(setEnvironment).catch(() => {});
  }, [setEnvironment, setSettings]);

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    document.documentElement.style.colorScheme = dark ? "dark" : "light";
    document.documentElement.style.fontSize = rootFontSize(baseFontSize);
    const family = settings?.fontFamily?.trim();
    if (family) {
      document.documentElement.style.setProperty("--font-app", `"${family}", var(--font-ui)`);
    } else {
      document.documentElement.style.removeProperty("--font-app");
    }
    setNativeTheme(theme);
  }, [baseFontSize, dark, settings?.fontFamily, theme]);

  useEffect(() => {
    localStorage.setItem("puffgittt:sidebarWidth", String(sidebarWidth));
  }, [sidebarWidth]);

  useEffect(() => {
    const sync = () => api.window.isMaximized().then(setMaximized).catch(() => {});
    sync();
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  }, []);

  const invalidateRepo = (target = root) => {
    if (!target) return;
    void queryClient.invalidateQueries({ queryKey: ["status", target] });
    void queryClient.invalidateQueries({ queryKey: ["branches", target] });
    void queryClient.invalidateQueries({ queryKey: ["tags", target] });
    void queryClient.invalidateQueries({ queryKey: ["history", target] });
    void queryClient.invalidateQueries({ queryKey: ["reflog", target] });
    void queryClient.invalidateQueries({ queryKey: ["undo", target] });
    void queryClient.invalidateQueries({ queryKey: ["conflicts", target] });
    void queryClient.invalidateQueries({ queryKey: ["stashes", target] });
    void queryClient.invalidateQueries({ queryKey: ["remotes", target] });
    void queryClient.invalidateQueries({ queryKey: ["workspaceRepositories"] });
    void queryClient.invalidateQueries({ queryKey: ["recent"] });
  };

  const openRepository = async (repo: Repository) => {
    openTab(repo);
    setStatusMessage(t("changes.operationDone"));
    invalidateRepo(repo.rootPath);
  };

  const openPath = async (path: string) => {
    try {
      const repo = await api.app.openRepository(path);
      await openRepository(repo);
    } catch (error: any) {
      setStatusMessage(error?.message || t("welcome.openFailed"));
    }
  };

  const handleOpenFolder = async () => {
    try {
      const path = await api.app.pickFolder(t("toolbar.openFolder"));
      if (!path) return;
      await openPath(path);
    } catch (error: any) {
      setStatusMessage(error?.message || t("welcome.openFailed"));
    }
  };

  useEffect(() => {
    if (restoreRef.current || !lastRepoPath) return;
    restoreRef.current = true;
    void (async () => {
      try {
        const repo = await api.app.openRepository(lastRepoPath);
        openTab(repo);
        if (lastView) setView(repo.rootPath, lastView);
        invalidateRepo(repo.rootPath);
      } catch (error: any) {
        useAppStore.setState({ lastRepoPath: undefined, lastView: undefined });
        setStatusMessage(`無法開啟上次使用的儲存庫：${error?.message || error}`);
      } finally {
        setRestoring(false);
      }
    })();
  }, [lastRepoPath, lastView]);

  const handleSaveSettings = async (next: Settings) => {
    try {
      const saved = await api.app.saveSettings(next);
      setSettings(saved);
      setTheme(saved.theme as ThemeMode);
      setLanguage(saved.language);
      i18n.changeLanguage(saved.language);
      setNativeTheme(saved.theme);
      setSettingsOpen(false);
      setStatusMessage(t("settings.saved"));
      void queryClient.invalidateQueries({ queryKey: ["workspaceRepositories"] });
    } catch (error: any) {
      setStatusMessage(error?.message || t("settings.saveFailed"));
    }
  };

  const handleOpenProjectsFolder = () => {
    const path = settings?.projectsRoot;
    if (!path) {
      setSettingsOpen(true);
      return;
    }
    void api.app.openInExplorer(path).catch((error: any) => {
      setStatusMessage(error?.message || String(error));
    });
  };

  const beginSidebarResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (sidebarCollapsed) return;
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = sidebarWidth;
    const move = (moveEvent: PointerEvent) => {
      const next = Math.min(320, Math.max(200, startWidth + moveEvent.clientX - startX));
      setSidebarWidth(next);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up, { once: true });
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.key.toLowerCase() === "o") {
        event.preventDefault();
        void handleOpenFolder();
      } else if (event.ctrlKey && event.key === ",") {
        event.preventDefault();
        setSettingsOpen(true);
      } else if (event.ctrlKey && activeTab && ["1", "2", "3"].includes(event.key)) {
        event.preventDefault();
        const view = event.key === "1" ? "changes" : event.key === "2" ? "history" : "branches";
        setView(activeTab.repo.rootPath, view as ViewKey);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  return (
    <FluentProvider theme={dark ? puffDarkTheme : puffLightTheme} className="app-provider">
      <div
        className={`app-shell${sidebarCollapsed ? " sidebar-collapsed" : ""}`}
        style={{ "--sidebar-width": `${sidebarCollapsed ? 72 : sidebarWidth}px` } as CSSProperties}
      >
        <div className="app-header">
          <TitleBar
            tabs={tabs}
            activeId={activeId}
            maximized={maximized}
            onActivate={setActive}
            onCloseTab={closeTab}
            onOpen={handleOpenFolder}
            onSettings={() => setSettingsOpen(true)}
            onMinimize={() => void api.window.minimize()}
            onToggleMaximize={() => {
              void api.window.toggleMaximize();
              setTimeout(() => api.window.isMaximized().then(setMaximized).catch(() => {}), 120);
            }}
            onClose={() => void api.window.close()}
          />
        </div>

        <div className="app-body">
          <Sidebar
            activeTab={activeTab}
            collapsed={sidebarCollapsed}
            branch={status?.repo.branch || activeTab?.repo.branch || ""}
            repositories={workspaceQuery.data || []}
            changeCount={status?.files.length || 0}
            hasConflicts={!!status?.files.some((file) => file.kind === "conflicted")}
            onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
            onNavigate={(view) => activeTab && setView(activeTab.repo.rootPath, view)}
            onOpenRepository={(path) => void openPath(path)}
            onOpenProjects={handleOpenProjectsFolder}
          />
          {!sidebarCollapsed ? (
            <div className="sidebar-resizer" onPointerDown={beginSidebarResize} role="separator" aria-orientation="vertical" />
          ) : null}

          <main className="workspace">
            {restoring ? (
              <div className="center-state"><Spinner label={t("common.loading")} /></div>
            ) : !activeTab ? (
              <WelcomeView
                onOpen={handleOpenFolder}
                onRepoOpened={openRepository}
                onError={setStatusMessage}
                onOpenRecent={(path) => void openPath(path)}
              />
            ) : activeTab.view === "changes" ? (
              <ChangesView tab={activeTab} />
            ) : activeTab.view === "history" ? (
              <HistoryView tab={activeTab} />
            ) : activeTab.view === "branches" ? (
              <BranchesView tab={activeTab} />
            ) : activeTab.view === "tags" ? (
              <TagsView tab={activeTab} />
            ) : activeTab.view === "conflicts" ? (
              <ConflictsView tab={activeTab} />
            ) : (
              <StashesView tab={activeTab} />
            )}
          </main>
        </div>

        <StatusBar status={status} language={language} message={statusMessage} />
      </div>

      {settingsOpen ? (
        <SettingsPanel
          settings={settings}
          environment={environment}
          onClose={() => setSettingsOpen(false)}
          onSave={handleSaveSettings}
          onLanguageChange={(next) => {
            setLanguage(next);
            i18n.changeLanguage(next);
          }}
          onThemeChange={(next) => {
            setTheme(next);
            setNativeTheme(next);
          }}
          onFontSizeChange={(next) => {
            document.documentElement.style.fontSize = rootFontSize(next);
          }}
        />
      ) : null}
    </FluentProvider>
  );
}
