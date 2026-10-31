import { useState } from "react";
import { Button, Field, Input, Spinner } from "@fluentui/react-components";
import {
  Add24Regular,
  ArrowDownload24Regular,
  Code24Regular,
  Dismiss24Regular,
  FolderOpen24Regular,
} from "@fluentui/react-icons";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api } from "../bridge/api";
import type { Repository } from "../types";

interface WelcomeViewProps {
  onOpen: () => void;
  onOpenRecent: (path: string) => void;
  onRepoOpened: (repo: Repository) => void;
  onError: (message: string) => void;
}

export function WelcomeView({ onOpen, onOpenRecent, onRepoOpened, onError }: WelcomeViewProps) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<"clone" | "init" | null>(null);
  const [busy, setBusy] = useState(false);
  const [cloneUrl, setCloneUrl] = useState("");
  const [cloneParent, setCloneParent] = useState("");
  const [cloneName, setCloneName] = useState("");
  const [initPath, setInitPath] = useState("");
  const [initBranch, setInitBranch] = useState("main");

  const recent = useQuery({ queryKey: ["recent"], queryFn: () => api.app.listRecent() });
  const workspace = useQuery({
    queryKey: ["workspaceRepositories", "welcome"],
    queryFn: () => api.app.listWorkspaceRepositories(),
  });

  const pickFolder = async (setter: (value: string) => void, title: string) => {
    try {
      const path = await api.app.pickFolder(title);
      if (path) setter(path);
    } catch (error: any) {
      onError(error?.message || String(error));
    }
  };

  const handleClone = async () => {
    if (!cloneUrl.trim() || !cloneParent.trim() || !cloneName.trim()) return;
    setBusy(true);
    try {
      const repo = await api.app.cloneRepository(cloneUrl.trim(), cloneParent.trim(), cloneName.trim());
      setMode(null);
      onRepoOpened(repo);
    } catch (error: any) {
      onError(error?.message || String(error));
    } finally {
      setBusy(false);
    }
  };

  const handleInit = async () => {
    if (!initPath.trim()) return;
    setBusy(true);
    try {
      const repo = await api.app.initializeRepository(initPath.trim(), initBranch.trim() || "main");
      setMode(null);
      onRepoOpened(repo);
    } catch (error: any) {
      onError(error?.message || String(error));
    } finally {
      setBusy(false);
    }
  };

  const projectRepos = (workspace.data || []).filter((repo) => repo.kind === "project");
  const projectPaths = new Set(projectRepos.map((repo) => repo.path.toLowerCase()));
  const recentEntries = (recent.data || []).filter((entry) => !projectPaths.has(entry.path.toLowerCase()));

  return (
    <div className="welcome-view">
      <div className="welcome-inner">
        <div className="welcome-heading">
          <h1>{t("welcome.title")}</h1>
          <p>{t("welcome.subtitle")}</p>
        </div>

        <div className="welcome-actions">
          <Button appearance="primary" size="large" icon={<FolderOpen24Regular />} onClick={onOpen}>
            {t("welcome.open")}
          </Button>
          <Button size="large" icon={<ArrowDownload24Regular />} onClick={() => setMode("clone")}>
            {t("welcome.clone")}
          </Button>
          <Button size="large" icon={<Add24Regular />} onClick={() => setMode("init")}>
            {t("welcome.init")}
          </Button>
        </div>

        {projectRepos.length > 0 ? (
          <div className="welcome-section">
            <div className="section-heading">{t("sidebar.projects")}</div>
            <div className="recent-grid">
              {projectRepos.map((repo) => (
                <button
                  key={repo.path}
                  type="button"
                  className="recent-card"
                  onClick={() => onOpenRecent(repo.path)}
                >
                  <FolderOpen24Regular />
                  <span>
                    <strong>{repo.name}</strong>
                    <small>{repo.branch || repo.path}</small>
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="welcome-section">
          <div className="section-heading">{t("welcome.recent")}</div>
          {recent.isLoading ? <Spinner size="small" /> : null}
          {!recent.isLoading && recentEntries.length === 0 ? (
            <div className="empty-state">{t("welcome.noRecent")}</div>
          ) : null}
          <div className="recent-grid">
            {recentEntries.map((entry) => (
              <button
                key={entry.path}
                type="button"
                className="recent-card"
                onClick={() => onOpenRecent(entry.path)}
              >
                <FolderOpen24Regular />
                <span>
                  <strong>{entry.name}</strong>
                  <small>{entry.path}</small>
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {mode ? (
        <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !busy && setMode(null)}>
          <div className="modal small" role="dialog" aria-modal="true">
            <div className="modal-header">
              <h2>{mode === "clone" ? t("welcome.cloneTitle") : t("welcome.initTitle")}</h2>
              <Button appearance="subtle" icon={<Dismiss24Regular />} onClick={() => setMode(null)} disabled={busy} />
            </div>
            <div className="modal-body form-stack">
              {mode === "clone" ? (
                <>
                  <Field label={t("welcome.cloneUrl")}>
                    <Input value={cloneUrl} onChange={(_, data) => setCloneUrl(data.value)} placeholder="https://github.com/owner/repo.git" />
                  </Field>
                  <Field label={t("welcome.cloneParent")}>
                    <div className="input-with-button">
                      <Input value={cloneParent} onChange={(_, data) => setCloneParent(data.value)} />
                      <Button icon={<FolderOpen24Regular />} onClick={() => void pickFolder(setCloneParent, t("welcome.cloneParent"))} />
                    </div>
                  </Field>
                  <Field label={t("welcome.cloneName")}>
                    <Input value={cloneName} onChange={(_, data) => setCloneName(data.value)} />
                  </Field>
                </>
              ) : (
                <>
                  <Field label={t("welcome.initPath")}>
                    <div className="input-with-button">
                      <Input value={initPath} onChange={(_, data) => setInitPath(data.value)} />
                      <Button icon={<FolderOpen24Regular />} onClick={() => void pickFolder(setInitPath, t("welcome.initPath"))} />
                    </div>
                  </Field>
                  <Field label={t("welcome.initBranch")}>
                    <Input value={initBranch} onChange={(_, data) => setInitBranch(data.value)} />
                  </Field>
                </>
              )}
            </div>
            <div className="modal-footer">
              <Button appearance="secondary" onClick={() => setMode(null)} disabled={busy}>
                {t("common.cancel")}
              </Button>
              <Button
                appearance="primary"
                icon={busy ? <Spinner size="tiny" /> : <Code24Regular />}
                onClick={() => void (mode === "clone" ? handleClone() : handleInit())}
                disabled={busy}
              >
                {mode === "clone" ? t("welcome.clone") : t("welcome.init")}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
