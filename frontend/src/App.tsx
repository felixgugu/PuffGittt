import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Badge,
  Button,
  FluentProvider,
  Select,
  Spinner,
  webDarkTheme,
  webLightTheme,
} from "@fluentui/react-components";
import {
  Add24Regular,
  ArrowDownload24Regular,
  ArrowSync24Regular,
  ArrowUpload24Regular,
  Branch24Regular,
  Dismiss24Regular,
  DocumentBulletList24Regular,
  FolderOpen24Regular,
  History24Regular,
  Settings24Regular,
  Warning24Regular,
} from "@fluentui/react-icons";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import i18n from "./i18n";
import { api, setNativeTheme } from "./bridge/api";
import { useActiveTab, useAppStore, type ThemeMode, type ViewKey } from "./store";
import type { Environment, Repository, Settings, Status } from "./types";
import { WelcomeView } from "./views/WelcomeView";
import { ChangesView } from "./views/ChangesView";
import { HistoryView } from "./views/HistoryView";
import { BranchesView } from "./views/BranchesView";
import { ConflictsView } from "./views/ConflictsView";
import { StashesView } from "./views/StashesView";
import { SettingsPanel } from "./components/SettingsPanel";
import { StatusBar } from "./components/StatusBar";
import appIcon from "./assets/appicon.png";

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

export default function App() {
  const { t } = useTranslation();
  const systemDark = useSystemDark();
  const theme = useAppStore((state) => state.theme);
  const setTheme = useAppStore((state) => state.setTheme);
  const language = useAppStore((state) => state.language);
  const setLanguage = useAppStore((state) => state.setLanguage);
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
  const replaceRepo = useAppStore((state) => state.replaceRepo);
  const activeTab = useActiveTab();
  const queryClient = useQueryClient();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const dark = theme === "dark" || (theme === "system" && systemDark);
  const root = activeTab?.repo.rootPath;

  const statusQuery = useQuery({
    queryKey: ["status", root],
    queryFn: () => api.repo.getStatus(root!),
    enabled: !!root,
    refetchInterval: 10_000,
  });
  const branchesQuery = useQuery({
    queryKey: ["branches", root],
    queryFn: () => api.repo.getBranches(root!),
    enabled: !!root,
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
    setNativeTheme(theme);
  }, [dark, theme]);

  useEffect(() => {
    if (!status) return;
    if (activeTab && status.repo.revision !== activeTab.repo.revision) {
      replaceRepo(status.repo);
    }
  }, [activeTab, replaceRepo, status]);

  const invalidateRepo = () => {
    if (!root) return;
    void queryClient.invalidateQueries({ queryKey: ["status", root] });
    void queryClient.invalidateQueries({ queryKey: ["branches", root] });
    void queryClient.invalidateQueries({ queryKey: ["history", root] });
    void queryClient.invalidateQueries({ queryKey: ["conflicts", root] });
    void queryClient.invalidateQueries({ queryKey: ["stashes", root] });
    void queryClient.invalidateQueries({ queryKey: ["remotes", root] });
  };

  const openRepository = async (repo: Repository) => {
    openTab(repo);
    setStatusMessage(t("changes.operationDone"));
    invalidateRepo();
  };

  const handleOpenFolder = async () => {
    try {
      const path = await api.app.pickFolder(t("toolbar.openFolder"));
      if (!path) return;
      const repo = await api.app.openRepository(path);
      await openRepository(repo);
    } catch (error: any) {
      setStatusMessage(error?.message || t("welcome.openFailed"));
    }
  };

  const handleSync = async (kind: "fetch" | "pull" | "push") => {
    if (!root || !activeTab) return;
    const branch = status?.repo.branch || activeTab.repo.branch || "";
    setBusy(kind);
    try {
      const remote = status?.repo.upstream?.split("/")[0] || "origin";
      const result =
        kind === "fetch"
          ? await api.sync.fetch(root, remote)
          : kind === "pull"
            ? await api.sync.pull(root, remote, branch, "merge")
            : await api.sync.push(root, remote, branch);
      setStatusMessage(result.output || result.message);
      invalidateRepo();
    } catch (error: any) {
      setStatusMessage(error?.message || String(error));
    } finally {
      setBusy(null);
    }
  };

  const handleSwitchBranch = async (name: string) => {
    if (!root || !name) return;
    setBusy("branch");
    try {
      const result = await api.branch.switch(root, name);
      setStatusMessage(result.message);
      invalidateRepo();
    } catch (error: any) {
      setStatusMessage(error?.message || String(error));
    } finally {
      setBusy(null);
    }
  };

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
    } catch (error: any) {
      setStatusMessage(error?.message || t("settings.saveFailed"));
    }
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

  const localBranches = useMemo(
    () => (branchesQuery.data || []).filter((branch) => branch.kind === "local"),
    [branchesQuery.data],
  );

  const navItems: { key: ViewKey; label: string; icon: ReactNode }[] = [
    { key: "changes", label: t("nav.changes"), icon: <DocumentBulletList24Regular /> },
    { key: "history", label: t("nav.history"), icon: <History24Regular /> },
    { key: "branches", label: t("nav.branches"), icon: <Branch24Regular /> },
    { key: "conflicts", label: t("nav.conflicts"), icon: <Warning24Regular /> },
    { key: "stashes", label: t("nav.stashes"), icon: <ArrowSync24Regular /> },
  ];

  return (
    <FluentProvider theme={dark ? webDarkTheme : webLightTheme} className="app-provider">
      <div className="app-shell">
        <header className="app-header">
          <div className="tab-strip">
            <div className="brand">
              <img src={appIcon} alt="" className="brand-icon" />
              <div>
                <div className="brand-title">PuffGittt</div>
                <div className="brand-subtitle">{t("app.subtitle")}</div>
              </div>
            </div>
            <div className="repo-tabs">
              {tabs.map((tab) => (
                <div
                  key={tab.repo.rootPath}
                  className={`repo-tab${tab.repo.rootPath === activeId ? " active" : ""}`}
                  onClick={() => setActive(tab.repo.rootPath)}
                >
                  <span className="repo-tab-name">{tab.repo.name}</span>
                  <button
                    type="button"
                    className="repo-tab-close"
                    title={t("toolbar.closeTab")}
                    onClick={(event) => {
                      event.stopPropagation();
                      closeTab(tab.repo.rootPath);
                    }}
                  >
                    <Dismiss24Regular />
                  </button>
                </div>
              ))}
              <Button appearance="subtle" icon={<Add24Regular />} title={t("welcome.open")} onClick={handleOpenFolder} />
            </div>
            <div className="header-actions">
              <Button
                appearance="subtle"
                icon={<FolderOpen24Regular />}
                title={t("welcome.open")}
                onClick={handleOpenFolder}
              />
              <Button
                appearance="subtle"
                icon={<Settings24Regular />}
                title={t("toolbar.settings")}
                onClick={() => setSettingsOpen(true)}
              />
            </div>
          </div>

          {activeTab ? (
            <div className="command-bar">
              <div className="command-group">
                <span className="field-label">{t("toolbar.branch")}</span>
                <Select
                  className="branch-select"
                  value={status?.repo.branch || activeTab.repo.branch || ""}
                  disabled={!localBranches.length || busy === "branch"}
                  onChange={(_, data) => void handleSwitchBranch(data.value)}
                >
                  {localBranches.map((branch) => (
                    <option key={branch.name} value={branch.name}>
                      {branch.name}
                      {branch.current ? "  ✓" : ""}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="command-group">
                <Button
                  appearance="subtle"
                  icon={busy === "fetch" ? <Spinner size="tiny" /> : <ArrowDownload24Regular />}
                  onClick={() => void handleSync("fetch")}
                  disabled={!!busy}
                >
                  Fetch
                </Button>
                <Button
                  appearance="subtle"
                  icon={busy === "pull" ? <Spinner size="tiny" /> : <ArrowSync24Regular />}
                  onClick={() => void handleSync("pull")}
                  disabled={!!busy}
                >
                  Pull
                  {status && status.behind > 0 ? <Badge appearance="filled" size="small">{status.behind}</Badge> : null}
                </Button>
                <Button
                  appearance="subtle"
                  icon={busy === "push" ? <Spinner size="tiny" /> : <ArrowUpload24Regular />}
                  onClick={() => void handleSync("push")}
                  disabled={!!busy}
                >
                  Push
                  {status && status.ahead > 0 ? <Badge appearance="filled" size="small">{status.ahead}</Badge> : null}
                </Button>
                <Button
                  appearance="subtle"
                  icon={<ArrowSync24Regular />}
                  title={t("toolbar.refresh")}
                  onClick={() => invalidateRepo()}
                />
              </div>
              <div className="command-spacer" />
              <div className="command-status">
                {status ? (
                  <>
                    <Badge appearance="tint" color="informative">{status.repo.branch || "HEAD"}</Badge>
                    <span>{status.files.length} {t("status.changed")}</span>
                    {status.repo.operation !== "normal" ? (
                      <Badge appearance="tint" color="warning">
                        {t(`status.operation${status.repo.operation.charAt(0).toUpperCase()}${status.repo.operation.slice(1)}`)}
                      </Badge>
                    ) : null}
                  </>
                ) : null}
                {statusQuery.isFetching ? <Spinner size="tiny" /> : null}
              </div>
            </div>
          ) : null}
        </header>

        <div className="app-body">
          <aside className="app-sidebar">
            <div className="nav-section-label">{activeTab?.repo.name || t("app.title")}</div>
            {navItems.map((item) => (
              <button
                key={item.key}
                type="button"
                className={`nav-item${activeTab?.view === item.key ? " active" : ""}`}
                disabled={!activeTab}
                title={item.label}
                onClick={() => activeTab && setView(activeTab.repo.rootPath, item.key)}
              >
                <span className="nav-icon">{item.icon}</span>
                <span className="nav-label">{item.label}</span>
                {item.key === "changes" && status && status.files.length > 0 ? (
                  <span className="nav-badge">{status.files.length}</span>
                ) : null}
                {item.key === "conflicts" && status?.files.some((file) => file.kind === "conflicted") ? (
                  <span className="nav-badge warning">!</span>
                ) : null}
              </button>
            ))}
            <button
              type="button"
              className="nav-item"
              title={t("nav.settings")}
              onClick={() => setSettingsOpen(true)}
            >
              <span className="nav-icon"><Settings24Regular /></span>
              <span className="nav-label">{t("nav.settings")}</span>
            </button>
            <div className="sidebar-spacer" />
            <div className="sidebar-footer">
              <span className="sidebar-dot" />
              <span>{environment?.gitFound ? environment.gitVersion.replace("git version ", "Git ") : t("settings.gitMissing")}</span>
            </div>
          </aside>

          <main className="workspace">
            {!activeTab ? (
              <WelcomeView
                onOpen={handleOpenFolder}
                onRepoOpened={openRepository}
                onError={setStatusMessage}
                onOpenRecent={async (path) => {
                  try {
                    const repo = await api.app.openRepository(path);
                    await openRepository(repo);
                  } catch (error: any) {
                    setStatusMessage(error?.message || String(error));
                  }
                }}
              />
            ) : activeTab.view === "changes" ? (
              <ChangesView tab={activeTab} />
            ) : activeTab.view === "history" ? (
              <HistoryView tab={activeTab} />
            ) : activeTab.view === "branches" ? (
              <BranchesView tab={activeTab} />
            ) : activeTab.view === "conflicts" ? (
              <ConflictsView tab={activeTab} />
            ) : (
              <StashesView tab={activeTab} />
            )}
          </main>
        </div>

        <StatusBar
          status={status}
          environment={environment}
          language={language}
          message={statusMessage}
        />
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
        />
      ) : null}
    </FluentProvider>
  );
}
