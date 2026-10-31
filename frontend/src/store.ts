import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Environment, Repository, Settings } from "./types";

export type ViewKey = "changes" | "history" | "branches" | "tags" | "conflicts" | "stashes" | "settings";
export type ThemeMode = "system" | "light" | "dark";

export interface SelectedFile {
  path: string;
  side: "staged" | "unstaged" | "commit";
}

export interface RepoTab {
  repo: Repository;
  view: ViewKey;
  selectedFile?: SelectedFile;
  selectedCommit?: string;
  historyBranch?: string;
}

interface AppState {
  tabs: RepoTab[];
  activeId?: string;
  lastRepoPath?: string;
  lastView?: ViewKey;
  theme: ThemeMode;
  language: "zh-TW" | "en";
  sidebarCollapsed: boolean;
  settings?: Settings;
  environment?: Environment;
  statusMessage?: string;
  openTab: (repo: Repository) => void;
  closeTab: (id: string) => void;
  setActive: (id: string) => void;
  setView: (id: string, view: ViewKey) => void;
  selectFile: (id: string, file?: SelectedFile) => void;
  selectCommit: (id: string, oid?: string) => void;
  setHistoryBranch: (id: string, branch?: string) => void;
  setTheme: (theme: ThemeMode) => void;
  setLanguage: (language: "zh-TW" | "en") => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setSettings: (settings: Settings) => void;
  setEnvironment: (environment: Environment) => void;
  setStatusMessage: (message?: string) => void;
  replaceRepo: (repo: Repository) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      tabs: [],
      theme: "system",
      language: "zh-TW",
      sidebarCollapsed: false,
      openTab: (repo) => {
        const existing = get().tabs.find((tab) => tab.repo.rootPath === repo.rootPath);
        if (existing) {
          set({
            tabs: get().tabs.map((tab) =>
              tab.repo.rootPath === repo.rootPath ? { ...tab, repo } : tab,
            ),
            activeId: existing.repo.rootPath,
            lastRepoPath: repo.rootPath,
            lastView: existing.view,
          });
          return;
        }
        const tab: RepoTab = { repo, view: "changes" };
        set({
          tabs: [...get().tabs, tab],
          activeId: repo.rootPath,
          lastRepoPath: repo.rootPath,
          lastView: tab.view,
        });
      },
      closeTab: (id) => {
        const tabs = get().tabs.filter((tab) => tab.repo.rootPath !== id);
        const activeId = get().activeId === id ? tabs[tabs.length - 1]?.repo.rootPath : get().activeId;
        const activeTab = tabs.find((tab) => tab.repo.rootPath === activeId);
        set({
          tabs,
          activeId,
          lastRepoPath: activeTab?.repo.rootPath,
          lastView: activeTab?.view,
        });
      },
      setActive: (id) => {
        const tab = get().tabs.find((entry) => entry.repo.rootPath === id);
        set({
          activeId: id,
          lastRepoPath: tab?.repo.rootPath,
          lastView: tab?.view,
        });
      },
      setView: (id, view) =>
        set((state) => ({
          tabs: state.tabs.map((tab) => (tab.repo.rootPath === id ? { ...tab, view } : tab)),
          lastView: state.activeId === id ? view : state.lastView,
        })),
      selectFile: (id, file) =>
        set({
          tabs: get().tabs.map((tab) => (tab.repo.rootPath === id ? { ...tab, selectedFile: file } : tab)),
        }),
      selectCommit: (id, oid) =>
        set({
          tabs: get().tabs.map((tab) => (tab.repo.rootPath === id ? { ...tab, selectedCommit: oid } : tab)),
        }),
      setHistoryBranch: (id, historyBranch) =>
        set({
          tabs: get().tabs.map((tab) => (tab.repo.rootPath === id ? { ...tab, historyBranch } : tab)),
        }),
      setTheme: (theme) => set({ theme }),
      setLanguage: (language) => set({ language }),
      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
      setSettings: (settings) => {
        set({ settings, theme: settings.theme as ThemeMode, language: settings.language });
      },
      setEnvironment: (environment) => set({ environment }),
      setStatusMessage: (statusMessage) => set({ statusMessage }),
      replaceRepo: (repo) =>
        set({
          tabs: get().tabs.map((tab) => (tab.repo.rootPath === repo.rootPath ? { ...tab, repo } : tab)),
        }),
    }),
    {
      name: "puffgittt:ui",
      partialize: (state) => ({
        theme: state.theme,
        language: state.language,
        sidebarCollapsed: state.sidebarCollapsed,
        lastRepoPath: state.lastRepoPath,
        lastView: state.lastView,
      }),
    },
  ),
);

export const useActiveTab = () =>
  useAppStore((state) => state.tabs.find((tab) => tab.repo.rootPath === state.activeId));
