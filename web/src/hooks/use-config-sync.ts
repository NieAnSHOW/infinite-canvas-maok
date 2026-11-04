import { useEffect, useRef } from "react";
import { useUserStore } from "@/stores/use-user-store";
import { useConfigStore, type AiConfig } from "@/stores/use-config-store";
import { getCanvasConfig, saveCanvasConfig } from "@/services/api/auth";

type ServerConfigPayload = Partial<{
    channelMode: AiConfig['channelMode'];
    channels: AiConfig['channels'];
}>;

let serverVersion = 0;

/**
 * 从服务端加载配置并合并到本地 store
 * 关键：只合并服务端实际存在的字段，保留本地真实 apiKey
 */
async function loadServerConfig() {
    try {
        const resp = await getCanvasConfig();
        
        if (!resp.exists) return;
        
        serverVersion = resp.version;
        const serverConfig: ServerConfigPayload = JSON.parse(resp.config);
        const localConfig = useConfigStore.getState().config;
        
        // 只合并服务端实际存在的字段
        const updates: Partial<AiConfig> = {};
        
        if (serverConfig.channelMode) {
            updates.channelMode = serverConfig.channelMode;
        }
        
        if (serverConfig.channels) {
            // 合并 channels：以服务端结构为准，但保留本地真实 apiKey
            updates.channels = serverConfig.channels.map(serverCh => {
                const localCh = localConfig.channels.find(c => c.id === serverCh.id);
                return {
                    ...serverCh,
                    // 服务端 apiKey 是 ***，用本地真实值替换
                    apiKey: localCh?.apiKey || serverCh.apiKey,
                };
            });
        }
        
        useConfigStore.setState({
            config: {
                ...localConfig,
                ...updates,
            }
        });
    } catch (err) {
        console.error("Failed to load server config:", err);
    }
}

/**
 * 保存本地配置到服务端
 * 处理冲突：如果 conflict: true，重新拉取再合并
 */
export async function syncConfigToServer() {
    const localConfig = useConfigStore.getState().config;
    
    const payload: ServerConfigPayload = {
        channelMode: localConfig.channelMode,
        channels: localConfig.channels,
    };
    
    try {
        const resp = await saveCanvasConfig(serverVersion, JSON.stringify(payload));
        
        if (resp.conflict) {
            // 冲突：服务端已被其他端修改，重新拉取
            console.warn("Config conflict, reloading from server");
            await loadServerConfig();
            return { success: false, conflict: true };
        }
        
        serverVersion = resp.version;
        return { success: true, conflict: false };
    } catch (err) {
        console.error("Failed to save server config:", err);
        return { success: false, conflict: false };
    }
}

/**
 * Hook：登录后加载配置，并订阅配置变更自动保存
 */
export function useConfigSync() {
    const accessToken = useUserStore(state => state.accessToken);
    const hasLoadedRef = useRef(false);
    const lastSyncedConfig = useRef<string>("");
    
    // 登录后加载配置（订阅 accessToken 变化）
    useEffect(() => {
        if (!accessToken) {
            hasLoadedRef.current = false;
            return;
        }
        
        if (hasLoadedRef.current) return;
        
        hasLoadedRef.current = true;
        loadServerConfig().then(() => {
            // 记录初始配置快照，避免刚加载完就触发保存
            const config = useConfigStore.getState().config;
            lastSyncedConfig.current = JSON.stringify({
                channelMode: config.channelMode,
                channels: config.channels,
            });
        });
    }, [accessToken]);
    
    // 配置变更时自动保存（去重避免重复请求）
    useEffect(() => {
        if (!accessToken) return;
        
        const unsubscribe = useConfigStore.subscribe((state) => {
            const currentSnapshot = JSON.stringify({
                channelMode: state.config.channelMode,
                channels: state.config.channels,
            });
            
            // 配置未变化，跳过
            if (currentSnapshot === lastSyncedConfig.current) return;
            
            lastSyncedConfig.current = currentSnapshot;
            syncConfigToServer();
        });
        
        return unsubscribe;
    }, [accessToken]);
}
