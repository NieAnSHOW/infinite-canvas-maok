import { useEffect } from "react";

import { getCanvasConfig, saveCanvasConfig } from "@/services/api/auth";
import { applyAppConfig, hasUserConfig, resetAppConfig, snapshotAppConfig } from "@/services/config-file";
import { useConfigStore } from "@/stores/use-config-store";
import { usePromptSourceStore } from "@/stores/use-prompt-source-store";
import { useUserStore } from "@/stores/use-user-store";

const UPLOAD_DEBOUNCE_MS = 2000;

/** Binds the full local config JSON to the signed-in member: pull once after sign-in, then debounce-upload every change. The server copy wins on version conflicts. */
export function useConfigSync() {
    const memberId = useUserStore((state) => (state.accessToken ? state.user?.id : undefined));

    useEffect(() => {
        if (!memberId) return;
        let cancelled = false;
        let ready = false; // stays false until the first pull succeeds, so a failed pull never overwrites the server copy
        let version = 0;
        let timer = 0;
        let queue: Promise<unknown> = Promise.resolve();

        const apply = (json: string) => {
            ready = false; // applying fires the store subscriptions; do not echo it back to the server
            try {
                applyAppConfig(JSON.parse(json));
            } finally {
                ready = true;
            }
        };
        const upload = async () => {
            if (version === 0 && !hasUserConfig()) return; // server has no record and local holds only defaults (a fresh profile): keep it empty so another browser's real config is never overwritten later, whichever path triggered this upload
            const result = await saveCanvasConfig(version, JSON.stringify(snapshotAppConfig()));
            version = result.version;
            if (result.conflict && result.config) apply(result.config);
        };
        const schedule = () => {
            if (!ready) return;
            window.clearTimeout(timer);
            timer = window.setTimeout(() => {
                queue = queue.then(upload).catch((error) => console.error("config upload failed", error));
            }, UPLOAD_DEBOUNCE_MS);
        };

        const unsubscribe = [useConfigStore.subscribe(schedule), usePromptSourceStore.subscribe(schedule)];

        // The local config belongs to the previous member: start from defaults before pulling, so their channels and keys never leak or get uploaded as this member's initial config.
        const { configOwnerId, setConfigOwner } = useUserStore.getState();
        if (configOwnerId && configOwnerId !== memberId) resetAppConfig();

        getCanvasConfig()
            .then(async (remote) => {
                if (cancelled) return;
                version = remote.version;
                if (remote.exists) {
                    apply(remote.config);
                } else {
                    await upload();
                    ready = true;
                }
                setConfigOwner(memberId);
            })
            .catch((error) => console.error("config pull failed", error));

        return () => {
            cancelled = true;
            window.clearTimeout(timer);
            unsubscribe.forEach((stop) => stop());
        };
    }, [memberId]);
}
