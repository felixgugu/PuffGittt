import { useEffect, useState } from "react";
import {
  Badge,
  Button,
  Checkbox,
  Divider,
  Field,
  Slider,
} from "@fluentui/react-components";
import {
  ArrowClockwise24Regular,
  ArrowDownload24Regular,
  ArrowUpload24Regular,
  Dismiss24Regular,
  FolderOpen24Regular,
} from "@fluentui/react-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api } from "../bridge/api";
import { UnderlineInput, UnderlineSelect } from "./FormControls";
import type { Environment, LFSStatus, RemoteTestResult, SSHHostKey, Settings } from "../types";

interface SettingsPanelProps {
  root?: string;
  settings?: Settings;
  environment?: Environment;
  onClose: () => void;
  onSave: (settings: Settings) => void;
  onLanguageChange: (language: "zh-TW" | "en") => void;
  onThemeChange: (theme: "system" | "light" | "dark") => void;
  onFontSizeChange: (size: number) => void;
}

const emptySettings: Settings = {
  theme: "system",
  language: "zh-TW",
  fontFamily: "",
  baseFontSize: 14,
  gitPath: "",
  projectsRoot: "",
  authorName: "",
  authorEmail: "",
  recent: [],
};

export function SettingsPanel({
  root,
  settings,
  environment,
  onClose,
  onSave,
  onLanguageChange,
  onThemeChange,
  onFontSizeChange,
}: SettingsPanelProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Settings>(settings || emptySettings);
  const [lfsPattern, setLfsPattern] = useState("");
  const [lfsBusy, setLfsBusy] = useState<string | null>(null);
  const [lfsMessage, setLfsMessage] = useState("");
  const [authRemote, setAuthRemote] = useState("");
  const [authUser, setAuthUser] = useState("");
  const [authToken, setAuthToken] = useState("");
  const [authRemember, setAuthRemember] = useState(true);
  const [authBusy, setAuthBusy] = useState(false);
  const [authResult, setAuthResult] = useState<RemoteTestResult | null>(null);
  const [hostKeys, setHostKeys] = useState<SSHHostKey[]>([]);
  const lfs = useQuery({
    queryKey: ["lfs", root],
    queryFn: () => api.repo.getLfs(root!),
    enabled: !!root,
  });
  const remotes = useQuery({
    queryKey: ["remotes", root],
    queryFn: () => api.sync.listRemotes(root!),
    enabled: !!root,
  });
  const remoteName = remotes.data?.[0]?.name || "";

  const authStatus = useQuery({
    queryKey: ["remoteAuth", root, authRemote],
    queryFn: () => api.remoteAuth.status(root!, authRemote),
    enabled: !!root && !!authRemote,
    retry: false,
  });
  const sshKeys = useQuery({
    queryKey: ["sshKeys"],
    queryFn: () => api.remoteAuth.sshKeys(),
    enabled: !!root,
    retry: false,
  });

  useEffect(() => {
    if (settings) setDraft(settings);
  }, [settings]);

  useEffect(() => {
    if (!authRemote && remotes.data?.length) {
      setAuthRemote(remotes.data[0].name);
    }
  }, [authRemote, remotes.data]);

  useEffect(() => {
    if (authStatus.data?.username) setAuthUser(authStatus.data.username);
  }, [authStatus.data?.username]);

  const authProtocol = authStatus.data?.protocol || "";
  const isHTTPRemote = authProtocol === "https" || authProtocol === "http";
  const isSSHRemote = authProtocol === "ssh";
  const authHost = authStatus.data?.host || authResult?.host || "";

  const runAuth = async (action: () => Promise<RemoteTestResult>) => {
    setAuthBusy(true);
    setAuthResult(null);
    try {
      const result = await action();
      setAuthResult(result);
      if (result.ok) {
        void authStatus.refetch();
        void queryClient.invalidateQueries({ queryKey: ["remotes", root] });
      }
      return result;
    } catch (error: any) {
      setAuthResult({
        ok: false,
        message: error?.message || String(error),
        authRequired: false,
        hostKeyRequired: false,
      });
      return null;
    } finally {
      setAuthBusy(false);
    }
  };

  const forgetCredential = async () => {
    if (!root || !authRemote) return;
    setAuthBusy(true);
    setAuthResult(null);
    try {
      const result = await api.remoteAuth.forget(root, authRemote);
      setAuthResult({
        ok: true,
        message: result.message,
        authRequired: false,
        hostKeyRequired: false,
      });
      void authStatus.refetch();
    } catch (error: any) {
      setAuthResult({
        ok: false,
        message: error?.message || String(error),
        authRequired: false,
        hostKeyRequired: false,
      });
    } finally {
      setAuthBusy(false);
    }
  };

  const scanHostKeys = async () => {
    if (!authHost) return;
    setAuthBusy(true);
    setAuthResult(null);
    try {
      setHostKeys(await api.remoteAuth.sshHostKeys(authHost));
    } catch (error: any) {
      setAuthResult({
        ok: false,
        message: error?.message || String(error),
        authRequired: false,
        hostKeyRequired: false,
      });
    } finally {
      setAuthBusy(false);
    }
  };

  const trustHostKey = async (hostKey: SSHHostKey) => {
    setAuthBusy(true);
    try {
      const result = await api.remoteAuth.trustHost(hostKey.key);
      setHostKeys((keys) => keys.filter((entry) => entry.key !== hostKey.key));
      setAuthResult({
        ok: true,
        message: result.message,
        authRequired: false,
        hostKeyRequired: false,
      });
      void authStatus.refetch();
    } catch (error: any) {
      setAuthResult({
        ok: false,
        message: error?.message || String(error),
        authRequired: false,
        hostKeyRequired: false,
      });
    } finally {
      setAuthBusy(false);
    }
  };

  const refreshLfs = () => {
    void queryClient.invalidateQueries({ queryKey: ["lfs", root] });
    void queryClient.invalidateQueries({ queryKey: ["status", root] });
  };

  const runLfs = async (key: string, action: () => Promise<{ message: string }>) => {
    setLfsBusy(key);
    try {
      const result = await action();
      setLfsMessage(result.message);
      refreshLfs();
    } catch (error: any) {
      setLfsMessage(error?.message || String(error));
    } finally {
      setLfsBusy(null);
    }
  };

  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const pickProjectsRoot = async () => {
    const path = await api.app.pickFolder(t("settings.projectsRoot"));
    if (path) update("projectsRoot", path);
  };

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="settings-modal" role="dialog" aria-modal="true" aria-label={t("settings.title")}>
        <div className="modal-header">
          <div>
            <h2>{t("settings.title")}</h2>
            <p>{t("settings.aboutBody")}</p>
          </div>
          <Button appearance="subtle" icon={<Dismiss24Regular />} onClick={onClose} />
        </div>

        <div className="settings-content">
          <section className="settings-section">
            <h3>{t("settings.appearance")}</h3>
            <div className="form-grid">
              <Field label={t("settings.theme")}>
                <UnderlineSelect
                  value={draft.theme}
                  onChange={(_, data) => {
                    const next = data.value as Settings["theme"];
                    update("theme", next);
                    onThemeChange(next);
                  }}
                >
                  <option value="system">{t("settings.system")}</option>
                  <option value="light">{t("settings.light")}</option>
                  <option value="dark">{t("settings.dark")}</option>
                </UnderlineSelect>
              </Field>
              <Field label={t("settings.language")}>
                <UnderlineSelect
                  value={draft.language}
                  onChange={(_, data) => {
                    const next = data.value as Settings["language"];
                    update("language", next);
                    onLanguageChange(next);
                  }}
                >
                  <option value="zh-TW">繁體中文</option>
                  <option value="en">English</option>
                </UnderlineSelect>
              </Field>
              <Field label={`${t("settings.fontSize")} (${draft.baseFontSize}px)`} hint={t("settings.fontSizeHint")}>
                <Slider
                  min={12}
                  max={20}
                  step={1}
                  value={draft.baseFontSize}
                  onChange={(_, data) => {
                    update("baseFontSize", data.value);
                    onFontSizeChange(data.value);
                  }}
                />
              </Field>
              <Field label={t("settings.fontFamily")}>
                <UnderlineInput
                  value={draft.fontFamily}
                  placeholder="Segoe UI Variable Text"
                  onChange={(_, data) => update("fontFamily", data.value)}
                />
              </Field>
            </div>
          </section>

          <Divider />

          <section className="settings-section">
            <h3>{t("settings.projects")}</h3>
            <Field label={t("settings.projectsRoot")} hint={t("settings.projectsHint")}>
              <div className="input-with-button">
                <UnderlineInput value={draft.projectsRoot} onChange={(_, data) => update("projectsRoot", data.value)} />
                <Button icon={<FolderOpen24Regular />} onClick={() => void pickProjectsRoot()}>
                  {t("settings.browse")}
                </Button>
              </div>
            </Field>
          </section>

          <Divider />

          <section className="settings-section">
            <h3>{t("settings.git")}</h3>
            <Field label={t("settings.gitPath")} hint={t("settings.gitPathHint")}>
              <UnderlineInput
                value={draft.gitPath}
                placeholder="git.exe"
                onChange={(_, data) => update("gitPath", data.value)}
              />
            </Field>
            <div className="environment-line">
              <Badge appearance="tint" color={environment?.gitFound ? "success" : "danger"}>
                {environment?.gitFound ? t("settings.gitFound") : t("settings.gitMissing")}
              </Badge>
              <span>{environment?.gitVersion || "-"}</span>
            </div>
          </section>

          <Divider />

          <section className="settings-section">
            <h3>{t("settings.identity")}</h3>
            <div className="form-grid">
              <Field label={t("settings.authorName")}>
                <UnderlineInput value={draft.authorName} onChange={(_, data) => update("authorName", data.value)} />
              </Field>
              <Field label={t("settings.authorEmail")}>
                <UnderlineInput value={draft.authorEmail} onChange={(_, data) => update("authorEmail", data.value)} />
              </Field>
            </div>
          </section>

          <Divider />

          <section className="settings-section">
            <h3>Git LFS</h3>
            {!root ? (
              <p className="muted">請先開啟一個 repository。</p>
            ) : lfs.isLoading ? (
              <p className="muted">載入中…</p>
            ) : lfs.data ? (
              <>
                <div className="environment-line">
                  <Badge appearance="tint" color={lfs.data.installed ? "success" : "warning"}>
                    {lfs.data.installed ? "已安裝" : "未安裝"}
                  </Badge>
                  <span>{lfs.data.version || "git lfs not found"}</span>
                  <Button
                    size="small"
                    appearance="subtle"
                    icon={<ArrowClockwise24Regular />}
                    title="重新整理"
                    onClick={() => void lfs.refetch()}
                    disabled={!!lfsBusy}
                  />
                </div>
                {!lfs.data.installed ? (
                  <p className="muted">請先安裝 Git LFS，並執行 `git lfs install`。</p>
                ) : (
                  <>
                    <Field label="追蹤 pattern">
                      <div className="input-with-button">
                        <UnderlineInput
                          value={lfsPattern}
                          onChange={(_, data) => setLfsPattern(data.value)}
                          placeholder="*.psd"
                        />
                        <Button
                          onClick={() => {
                            if (!lfsPattern.trim()) return;
                            void runLfs("track", () => api.repo.trackLfs(root, lfsPattern.trim())).then(() => setLfsPattern(""));
                          }}
                          disabled={!lfsPattern.trim() || !!lfsBusy}
                        >
                          Track
                        </Button>
                      </div>
                    </Field>
                    <div className="remote-list">
                      {lfs.data.patterns.map((pattern) => (
                        <div className="remote-row" key={pattern}>
                          <div className="remote-copy"><strong>{pattern}</strong></div>
                          <Button
                            size="small"
                            appearance="subtle"
                            icon={<Dismiss24Regular />}
                            title="取消追蹤"
                            disabled={!!lfsBusy}
                            onClick={() => void runLfs("untrack", () => api.repo.untrackLfs(root, pattern))}
                          />
                        </div>
                      ))}
                      {lfs.data.patterns.length === 0 ? <div className="empty-state">尚未追蹤任何 pattern</div> : null}
                    </div>
                    <div className="muted">
                      {lfs.data.files.length} 個 LFS 檔案
                      {lfs.data.files.length > 0 ? `：${lfs.data.files.slice(0, 5).join("、")}` : ""}
                    </div>
                    <div className="settings-actions">
                      <Button
                        size="small"
                        icon={<ArrowDownload24Regular />}
                        onClick={() => void runLfs("pull", () => api.repo.pullLfs(root))}
                        disabled={!!lfsBusy}
                      >
                        Pull LFS
                      </Button>
                      <Button
                        size="small"
                        icon={<ArrowUpload24Regular />}
                        onClick={() => void runLfs("push", () => api.repo.pushLfs(root, remoteName))}
                        disabled={!remoteName || !!lfsBusy}
                      >
                        Push LFS
                      </Button>
                    </div>
                    {lfsMessage ? <p className="muted">{lfsMessage}</p> : null}
                  </>
                )}
              </>
            ) : null}
          </section>

          <Divider />

          <section className="settings-section">
            <h3>遠端認證</h3>
            {!root ? (
              <p className="muted">請先開啟一個 repository。</p>
            ) : remotes.isLoading ? (
              <p className="muted">載入中…</p>
            ) : !remotes.data || remotes.data.length === 0 ? (
              <p className="muted">此 repository 尚未設定 remote。</p>
            ) : (
              <>
                <Field label="Remote">
                  <UnderlineSelect
                    value={authRemote}
                    onChange={(_, data) => {
                      setAuthRemote(data.value);
                      setAuthUser("");
                      setAuthToken("");
                      setAuthResult(null);
                      setHostKeys([]);
                    }}
                  >
                    {(remotes.data || []).map((entry) => (
                      <option key={entry.name} value={entry.name}>
                        {entry.name}
                      </option>
                    ))}
                  </UnderlineSelect>
                </Field>

                {authStatus.isLoading ? (
                  <p className="muted">正在檢查認證狀態…</p>
                ) : authStatus.data ? (
                  <>
                    <div className="environment-line">
                      <Badge appearance="tint" color={isHTTPRemote ? "informative" : "brand"}>
                        {(authStatus.data.protocol || "unknown").toUpperCase()}
                      </Badge>
                      <span>{authStatus.data.host || "-"}</span>
                    </div>
                    <div className="auth-url">{authStatus.data.url}</div>
                    <div className="auth-badges">
                      {isHTTPRemote ? (
                        <Badge appearance="tint" color={authStatus.data.hasCredential ? "success" : "warning"}>
                          {authStatus.data.hasCredential ? "已儲存憑證" : "尚未儲存憑證"}
                        </Badge>
                      ) : null}
                      {isSSHRemote ? (
                        <>
                          <Badge appearance="tint" color={authStatus.data.sshKeyFound ? "success" : "warning"}>
                            {authStatus.data.sshKeyFound ? "找到 SSH key" : "未找到 SSH key"}
                          </Badge>
                          <Badge appearance="tint" color={authStatus.data.hostKeyKnown ? "success" : "warning"}>
                            {authStatus.data.hostKeyKnown ? "host key 已信任" : "host key 未信任"}
                          </Badge>
                        </>
                      ) : null}
                    </div>
                    {authStatus.data.credentialHelper ? (
                      <div className="muted">credential.helper: {authStatus.data.credentialHelper}</div>
                    ) : null}
                  </>
                ) : null}

                <div className="settings-actions">
                  <Button
                    size="small"
                    onClick={() => void runAuth(() => api.remoteAuth.test(root, authRemote))}
                    disabled={!authRemote || authBusy}
                  >
                    測試連線
                  </Button>
                  {isHTTPRemote ? (
                    <Button
                      size="small"
                      onClick={() => void forgetCredential()}
                      disabled={!authRemote || authBusy || !authStatus.data?.hasCredential}
                    >
                      清除憑證
                    </Button>
                  ) : null}
                  {isSSHRemote ? (
                    <Button size="small" onClick={() => void scanHostKeys()} disabled={!authHost || authBusy}>
                      掃描 host key
                    </Button>
                  ) : null}
                </div>

                {isHTTPRemote ? (
                  <div className="form-grid">
                    <Field label="Username">
                      <UnderlineInput
                        value={authUser}
                        onChange={(_, data) => setAuthUser(data.value)}
                        placeholder="x-access-token"
                      />
                    </Field>
                    <Field label="Personal Access Token">
                      <UnderlineInput
                        type="password"
                        value={authToken}
                        onChange={(_, data) => setAuthToken(data.value)}
                        placeholder="ghp_..."
                      />
                    </Field>
                  </div>
                ) : null}

                {isHTTPRemote ? (
                  <>
                    <Checkbox
                      checked={authRemember}
                      onChange={(_, data) => setAuthRemember(!!data.checked)}
                      label="記住憑證（存入系統 credential helper）"
                    />
                    <div className="settings-actions">
                      <Button
                        appearance="primary"
                        size="small"
                        onClick={() =>
                          void runAuth(() =>
                            api.remoteAuth.save(root, authRemote, authUser, authToken, authRemember),
                          ).then((result) => {
                            if (result?.ok) setAuthToken("");
                          })
                        }
                        disabled={!authRemote || !authToken.trim() || authBusy}
                      >
                        驗證並儲存
                      </Button>
                    </div>
                    <p className="muted">
                      GitHub 不再接受帳號密碼。Classic PAT 需要 repo scope；Fine-grained PAT 需要此 repository 的
                      Contents 讀寫權限。Token 只會經由 stdin 傳給 Git，不會出現在指令或日誌中。
                    </p>
                  </>
                ) : null}

                {isSSHRemote ? (
                  <>
                    <div className="muted">
                      {sshKeys.data?.agentRunning
                        ? `SSH agent 已啟動（${sshKeys.data.agentKeys} 個 identity）`
                        : "SSH agent 未啟動；請確認 ssh-agent 服務或改用 HTTPS。"}
                    </div>
                    {sshKeys.data?.keys.length ? (
                      <div className="remote-list">
                        {sshKeys.data.keys.map((key) => (
                          <div className="remote-row" key={key.path}>
                            <div className="remote-copy">
                              <strong>{key.type}</strong>
                              <span className="muted">{key.path}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </>
                ) : null}

                {hostKeys.length > 0 ? (
                  <div className="remote-list">
                    {hostKeys.map((hostKey) => (
                      <div className="remote-row" key={hostKey.key}>
                        <div className="remote-copy">
                          <strong>{hostKey.algorithm}</strong>
                          <span className="muted">{hostKey.fingerprint || "fingerprint 無法計算"}</span>
                        </div>
                        <Button size="small" onClick={() => void trustHostKey(hostKey)} disabled={authBusy}>
                          信任
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : null}

                {authResult ? (
                  <p className={authResult.ok ? "muted auth-result" : "inline-warning auth-result"}>
                    {authResult.message}
                  </p>
                ) : null}
              </>
            )}
          </section>

          <Divider />

          <section className="settings-section">
            <h3>{t("settings.about")}</h3>
            <div className="about-grid">
              <span className="about-label">PuffGittt</span>
              <span>v0.1.0</span>
              <span className="about-label">{t("settings.gitVersion")}</span>
              <span>{environment?.gitVersion || "-"}</span>
              <span className="about-label">{t("settings.goVersion")}</span>
              <span>{environment?.goVersion || "-"}</span>
              <span className="about-label">{t("settings.wailsVersion")}</span>
              <span>{environment?.wails || "-"}</span>
            </div>
          </section>
        </div>

        <div className="modal-footer">
          <Button appearance="secondary" onClick={onClose}>{t("common.cancel")}</Button>
          <Button appearance="primary" onClick={() => onSave(draft)}>{t("common.save")}</Button>
        </div>
      </div>
    </div>
  );
}
