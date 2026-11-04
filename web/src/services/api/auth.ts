import axios, { type AxiosRequestConfig } from "axios";

import { useUserStore, type LocalUser } from "@/stores/use-user-store";

// All backend calls go through the same-origin /xyapi prefix; Vite strips it before forwarding to xihong-admin.
const BASE_URL = "/xyapi";
const CODE_OK = 0;
const CODE_UNAUTHORIZED = 61;
const CODE_KICKED_OUT = 10010;

export class AuthError extends Error {
    constructor(
        message: string,
        public code: number,
    ) {
        super(message);
    }
}

type Envelope<T> = { code: number; message: string; data: T };
type LoginResult = { token: string; expiresIn: number; refreshToken: string; refreshExpiresIn: number };
type RefreshResult = { accessToken: string; expiresIn: number };
type MemberInfo = { id: number; username: string; nickname: string; avatar: string };
export type ClickCaptcha = { id: string; text: string[]; base64: string; width: number; height: number };

const http = axios.create({ baseURL: BASE_URL });


// Concurrent 61 responses share one refresh call.
let refreshing: Promise<string> | null = null;

export function refreshAccessToken(): Promise<string> {
    if (refreshing) return refreshing;
    refreshing = (async () => {
        const { refreshToken, refreshExpiresAt } = useUserStore.getState();
        if (!refreshToken || (refreshExpiresAt && refreshExpiresAt <= Date.now())) throw new AuthError("session expired", CODE_UNAUTHORIZED);
        const res = await http.post<Envelope<RefreshResult>>("/member/auth/refresh", { refreshToken });
        if (res.data.code !== CODE_OK || !res.data.data?.accessToken) throw new AuthError(res.data.message, res.data.code);
        useUserStore.getState().setSession({ accessToken: res.data.data.accessToken });
        return res.data.data.accessToken;
    })().finally(() => {
        refreshing = null;
    });
    return refreshing;
}

http.interceptors.request.use((config) => {
    const { accessToken } = useUserStore.getState();
    // Backend reads the raw token from Xy-User-Token (no Bearer prefix).
    if (accessToken) config.headers.set("Xy-User-Token", accessToken);
    return config;
});

// Business codes live in the body; the backend answers HTTP 200 even when unauthorized.
http.interceptors.response.use(async (response) => {
    const body = response.data as Envelope<unknown>;
    if (body?.code === CODE_OK) return response;
    if (body?.code === CODE_KICKED_OUT) {
        useUserStore.getState().clearSession();
        throw new AuthError(body.message, CODE_KICKED_OUT);
    }
    const retryConfig = response.config as typeof response.config & { _retried?: boolean };
    if (body?.code === CODE_UNAUTHORIZED && !retryConfig.url?.includes("/auth/refresh")) {
        // A replayed request that is rejected again means the session is really gone (e.g. another tab invalidated this token).
        if (retryConfig._retried) {
            useUserStore.getState().clearSession();
            throw new AuthError(body.message, CODE_UNAUTHORIZED);
        }
        let token: string;
        try {
            token = await refreshAccessToken();
        } catch {
            useUserStore.getState().clearSession();
            throw new AuthError(body.message, CODE_UNAUTHORIZED);
        }
        retryConfig._retried = true;
        retryConfig.headers.set("Xy-User-Token", token);
        return http.request(retryConfig);
    }
    throw new AuthError(body?.message || "request failed", body?.code ?? -1);
});

async function unwrap<T>(request: Promise<{ data: Envelope<T> }>): Promise<T> {
    return (await request).data.data;
}

export function getClickCaptcha() {
    return unwrap<ClickCaptcha>(http.get("/captcha/click"));
}

export async function login(input: { username: string; password: string; captchaId: string; captcha: string }) {
    const result = await unwrap<LoginResult>(http.post("/member/auth/login", input));
    useUserStore.getState().setSession({ accessToken: result.token, refreshToken: result.refreshToken, refreshExpiresIn: result.refreshExpiresIn });
    const info = await getUserInfo();
    useUserStore.getState().setSession({ user: info, accessToken: result.token });
}

export async function getUserInfo(): Promise<LocalUser> {
    const info = await unwrap<MemberInfo>(http.get("/member/user/info"));
    return { id: String(info.id), username: info.username, displayName: info.nickname || info.username, avatarUrl: info.avatar };
}

export async function logout() {
    try {
        await http.post("/member/auth/logout");
    } catch {
        // Local session is cleared regardless of the server result.
    }
    useUserStore.getState().clearSession();
}

/** On startup: swap the persisted refreshToken for a fresh in-memory accessToken. Returns whether a session exists. */
export async function restoreSession() {
    const { refreshToken } = useUserStore.getState();
    if (!refreshToken) return false;
    try {
        await refreshAccessToken();
        if (!useUserStore.getState().user) useUserStore.getState().setSession({ user: await getUserInfo(), accessToken: useUserStore.getState().accessToken });
        return true;
    } catch {
        useUserStore.getState().clearSession();
        return false;
    }
}

export function getCanvasConfig() {
    return unwrap<{ exists: boolean; version: number; config: string }>(http.get("/member/canvas/config"));
}

/** A stale version is not an error: the server answers conflict=true with its latest version and config. */
export function saveCanvasConfig(version: number, config: string) {
    return unwrap<{ conflict: boolean; version: number; config?: string }>(http.put("/member/canvas/config", { version, config }));
}
