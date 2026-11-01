import { useEffect, useState } from "react";
import { Badge, Button, Spinner } from "@fluentui/react-components";
import {
  ArrowSync24Regular,
  ArrowRight24Regular,
  Checkmark24Regular,
  Dismiss24Regular,
  Save24Regular,
  Warning24Regular,
} from "@fluentui/react-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api } from "../bridge/api";
import { useAppStore, type RepoTab } from "../store";

interface ConflictsViewProps {
  tab: RepoTab;
}

export function ConflictsView({ tab }: ConflictsViewProps) {
  const { t } = useTranslation();
  const root = tab.repo.rootPath;
  const queryClient = useQueryClient();
  const setStatusMessage = useAppStore((state) => state.setStatusMessage);
  const [selected, setSelected] = useState<string | null>(null);
  const [result, setResult] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const conflicts = useQuery({
    queryKey: ["conflicts", root],
    queryFn: () => api.conflict.list(root),
    refetchInterval: 5_000,
  });
  const status = useQuery({ queryKey: ["status", root], queryFn: () => api.repo.getStatus(root) });

  useEffect(() => {
    if (conflicts.data?.length && !selected) {
      setSelected(conflicts.data[0].path);
    }
    if (conflicts.data && conflicts.data.length === 0) {
      setSelected(null);
    }
  }, [conflicts.data, selected]);

  const versions = useQuery({
    queryKey: ["conflict-versions", root, selected],
    queryFn: () => api.conflict.getVersions(root, selected!),
    enabled: !!selected,
  });

  useEffect(() => {
    if (versions.data) setResult(versions.data.result);
  }, [versions.data]);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["conflicts", root] });
    void queryClient.invalidateQueries({ queryKey: ["status", root] });
    void queryClient.invalidateQueries({ queryKey: ["history", root] });
    void queryClient.invalidateQueries({ queryKey: ["conflict-versions", root] });
  };

  const run = async (key: string, action: () => Promise<{ message?: string } | void>, success: string) => {
    setBusy(key);
    try {
      const value = await action();
      setStatusMessage((value && "message" in value && value.message) || success);
      invalidate();
    } catch (error: any) {
      setStatusMessage(error?.message || String(error));
    } finally {
      setBusy(null);
    }
  };

  const operation = status.data?.repo.operation || versions.data?.operation || "normal";

  return (
    <div className="conflicts-view">
      <div className="conflict-shell">
        <div className="panel-card conflict-file-panel">
          <div className="panel-heading">
            <span>{t("conflicts.title")}</span>
            <div className="panel-heading-actions">
              <span className="muted">{conflicts.data?.length || 0}</span>
              {operation !== "normal" ? (
                <>
                  <Badge size="small" appearance="tint" color="warning">{operation}</Badge>
                  <Button
                    size="small"
                    appearance="subtle"
                    icon={<ArrowSync24Regular />}
                    title={t("conflicts.continue")}
                    aria-label={t("conflicts.continue")}
                    onClick={() => void run("continue", () => api.conflict.continue(root, operation), t("common.confirm"))}
                    disabled={!!busy}
                  />
                  <Button
                    size="small"
                    appearance="subtle"
                    icon={<Dismiss24Regular />}
                    title={t("conflicts.abort")}
                    aria-label={t("conflicts.abort")}
                    onClick={() => void run("abort", () => api.conflict.abort(root, operation), t("common.cancel"))}
                    disabled={!!busy}
                  />
                  {operation === "rebasing" || operation === "cherryPicking" || operation === "reverting" ? (
                    <Button
                      size="small"
                      appearance="subtle"
                      icon={<ArrowRight24Regular />}
                      title="Skip 目前步驟"
                      aria-label="Skip 目前步驟"
                      onClick={() => void run("skip", () => api.conflict.skip(root, operation), "已略過目前步驟")}
                      disabled={!!busy}
                    />
                  ) : null}
                </>
              ) : null}
            </div>
          </div>
          {conflicts.isLoading ? <div className="center-state"><Spinner /></div> : null}
          {conflicts.data?.map((file) => (
            <button
              key={file.path}
              type="button"
              className={`conflict-file${selected === file.path ? " active" : ""}`}
              onClick={() => setSelected(file.path)}
            >
              <Warning24Regular />
              <span>{file.path}</span>
            </button>
          ))}
          {conflicts.data?.length === 0 ? <div className="empty-state">{t("conflicts.noConflicts")}</div> : null}
        </div>

        <div className="conflict-main">
          {versions.data?.binary ? (
            <div className="center-state"><p>{t("conflicts.binary")}</p></div>
          ) : versions.data ? (
            <>
              <div className="three-way">
                <div className="conflict-pane">
                  <div className="conflict-pane-heading">{t("conflicts.base")}</div>
                  <pre>{versions.data.base}</pre>
                </div>
                <div className="conflict-pane">
                  <div className="conflict-pane-heading">{versions.data.oursLabel || t("conflicts.ours")}</div>
                  <pre>{versions.data.ours}</pre>
                </div>
                <div className="conflict-pane">
                  <div className="conflict-pane-heading">{versions.data.theirsLabel || t("conflicts.theirs")}</div>
                  <pre>{versions.data.theirs}</pre>
                </div>
              </div>
              <div className="conflict-result">
                <div className="conflict-pane-heading">
                  <span>{t("conflicts.result")}</span>
                  <div className="tree-filter-spacer" />
                  <button
                    type="button"
                    className="tree-action-link"
                    disabled={!!busy}
                    onClick={() => setResult(versions.data!.ours)}
                  >
                    採用 Ours
                  </button>
                  <button
                    type="button"
                    className="tree-action-link"
                    disabled={!!busy}
                    onClick={() => setResult(versions.data!.theirs)}
                  >
                    採用 Theirs
                  </button>
                  <button
                    type="button"
                    className="tree-action-link"
                    disabled={!!busy}
                    onClick={() => {
                      const ours = versions.data!.ours || "";
                      const theirs = versions.data!.theirs || "";
                      setResult(`${ours}${ours && !ours.endsWith("\n") ? "\n" : ""}${theirs}`);
                    }}
                  >
                    保留兩邊
                  </button>
                </div>
                <textarea value={result} onChange={(event) => setResult(event.target.value)} />
              </div>
              <div className="conflict-actions">
                <Button
                  icon={<Save24Regular />}
                  disabled={!!busy}
                  onClick={() => void run("save", () => api.conflict.saveResult(root, selected!, result), t("conflicts.resultSaved"))}
                >
                  {t("conflicts.save")}
                </Button>
                <Button
                  appearance="primary"
                  icon={<Checkmark24Regular />}
                  disabled={!!busy}
                  onClick={() => void run("resolve", () => api.conflict.resolve(root, selected!), t("conflicts.resolvedOne"))}
                >
                  {t("conflicts.resolve")}
                </Button>
              </div>
            </>
          ) : (
            <div className="center-state"><p>{t("conflicts.noConflicts")}</p></div>
          )}
        </div>
      </div>
    </div>
  );
}
