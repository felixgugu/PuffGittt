import { useEffect, useState } from "react";
import { Badge, Button, Divider, Field, Input, Select } from "@fluentui/react-components";
import { Dismiss24Regular } from "@fluentui/react-icons";
import { useTranslation } from "react-i18next";
import type { Environment, Settings } from "../types";

interface SettingsPanelProps {
  settings?: Settings;
  environment?: Environment;
  onClose: () => void;
  onSave: (settings: Settings) => void;
  onLanguageChange: (language: "zh-TW" | "en") => void;
  onThemeChange: (theme: "system" | "light" | "dark") => void;
}

const emptySettings: Settings = {
  theme: "system",
  language: "zh-TW",
  fontFamily: "",
  gitPath: "",
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
}: SettingsPanelProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<Settings>(settings || emptySettings);

  useEffect(() => {
    if (settings) setDraft(settings);
  }, [settings]);

  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
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
                <Select
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
                </Select>
              </Field>
              <Field label={t("settings.language")}>
                <Select
                  value={draft.language}
                  onChange={(_, data) => {
                    const next = data.value as Settings["language"];
                    update("language", next);
                    onLanguageChange(next);
                  }}
                >
                  <option value="zh-TW">繁體中文</option>
                  <option value="en">English</option>
                </Select>
              </Field>
            </div>
          </section>

          <Divider />

          <section className="settings-section">
            <h3>{t("settings.git")}</h3>
            <Field label={t("settings.gitPath")} hint="Leave empty to use git from PATH">
              <Input
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
              <span>{environment?.goVersion || "-"}</span>
              <span>{environment?.wails || "-"}</span>
            </div>
          </section>

          <Divider />

          <section className="settings-section">
            <h3>{t("settings.identity")}</h3>
            <div className="form-grid">
              <Field label={t("settings.authorName")}>
                <Input value={draft.authorName} onChange={(_, data) => update("authorName", data.value)} />
              </Field>
              <Field label={t("settings.authorEmail")}>
                <Input value={draft.authorEmail} onChange={(_, data) => update("authorEmail", data.value)} />
              </Field>
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
