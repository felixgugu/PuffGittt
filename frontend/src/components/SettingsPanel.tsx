import { useEffect, useState } from "react";
import {
  Badge,
  Button,
  Divider,
  Field,
  Slider,
} from "@fluentui/react-components";
import { Dismiss24Regular, FolderOpen24Regular } from "@fluentui/react-icons";
import { useTranslation } from "react-i18next";
import { api } from "../bridge/api";
import { UnderlineInput, UnderlineSelect } from "./FormControls";
import type { Environment, Settings } from "../types";

interface SettingsPanelProps {
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
  settings,
  environment,
  onClose,
  onSave,
  onLanguageChange,
  onThemeChange,
  onFontSizeChange,
}: SettingsPanelProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<Settings>(settings || emptySettings);

  useEffect(() => {
    if (settings) setDraft(settings);
  }, [settings]);

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
