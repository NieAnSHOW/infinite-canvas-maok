import { saveAs } from "file-saver";

import i18n from "@/i18n";
import { useConfigStore, type AiConfig, type WebdavSyncConfig } from "@/stores/use-config-store";
import { usePromptSourceStore, type PromptSourceSchedule } from "@/stores/use-prompt-source-store";
import type { PromptSource } from "@/services/api/prompt-source-presets";

type AppConfigFile = {
    app: "infinite-canvas";
    version: 1;
    exportedAt: string;
    config: AiConfig;
    webdav: WebdavSyncConfig;
    promptSources: {
        sources: PromptSource[];
        schedule: PromptSourceSchedule;
    };
};

export function snapshotAppConfig(): AppConfigFile {
    const { config, webdav } = useConfigStore.getState();
    const { sources, schedule } = usePromptSourceStore.getState();
    return { app: "infinite-canvas", version: 1, exportedAt: new Date().toISOString(), config, webdav, promptSources: { sources, schedule } };
}

/** True when the local config holds anything worth keeping (keys, scripts, WebDAV credentials, custom prompt sources). A fresh profile has none and must not be uploaded as a member's initial config. */
export function hasUserConfig() {
    const { config, webdav } = useConfigStore.getState();
    const { sources } = usePromptSourceStore.getState();
    return config.channels.some((channel) => channel.apiKey.trim() || channel.models.some((model) => model.script?.trim())) || Boolean(webdav.url.trim() || webdav.username.trim() || webdav.password) || sources.some((source) => !source.builtIn);
}

/** Applies a config file through each store's persist merge, so old or partial JSON is normalized the same way as on page reload. */
export function applyAppConfig(data: AppConfigFile) {
    if (data.app !== "infinite-canvas" || data.version !== 1 || !data.config || !data.webdav || !data.promptSources) throw new Error(i18n.t("config.invalidFile"));
    const { merge: mergeConfig } = useConfigStore.persist.getOptions();
    const { merge: mergePrompts } = usePromptSourceStore.persist.getOptions();
    useConfigStore.setState(mergeConfig!({ config: data.config, webdav: data.webdav }, useConfigStore.getState()));
    usePromptSourceStore.setState(mergePrompts!(data.promptSources, usePromptSourceStore.getState()));
}

export function exportAppConfig() {
    saveAs(new Blob([JSON.stringify(snapshotAppConfig(), null, 2)], { type: "application/json;charset=utf-8" }), "infinite-canvas-config.json");
}

/** Back to factory defaults for the config JSON stores; used when a different member signs in on this browser. */
export function resetAppConfig() {
    const { config, webdav } = useConfigStore.getInitialState();
    const { sources, schedule } = usePromptSourceStore.getInitialState();
    useConfigStore.setState({ config, webdav });
    usePromptSourceStore.setState({ sources, schedule });
}

export async function importAppConfig(file: File) {
    let data: AppConfigFile;
    try {
        data = JSON.parse(await file.text()) as AppConfigFile;
    } catch {
        throw new Error(i18n.t("config.invalidFile"));
    }
    applyAppConfig(data);
}
