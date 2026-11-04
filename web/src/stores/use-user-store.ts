import { create } from "zustand";
import { persist } from "zustand/middleware";

import { localForageStorage } from "@/lib/localforage-storage";

export type LocalUser = {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string;
};

type UserStore = {
    hydrated: boolean;
    user: LocalUser | null;
    /** Kept in memory only; recovered from refreshToken after a page reload. */
    accessToken: string;
    refreshToken: string;
    /** Absolute session limit (ms epoch); the server never extends it on refresh. */
    refreshExpiresAt: number;
    /** Member id the local config JSON belongs to; kept across sign-out so a different member signing in on this browser starts from defaults. */
    configOwnerId: string;
    setSession: (session: { user?: LocalUser | null; accessToken: string; refreshToken?: string; refreshExpiresIn?: number }) => void;
    clearSession: () => void;
    setConfigOwner: (id: string) => void;
};

const USER_STORE_KEY = "infinite-canvas:user_store";

export const useUserStore = create<UserStore>()(
    persist(
        (set) => ({
            hydrated: false,
            user: null,
            accessToken: "",
            refreshToken: "",
            refreshExpiresAt: 0,
            configOwnerId: "",
            setConfigOwner: (configOwnerId) => set({ configOwnerId }),
            setSession: ({ user, accessToken, refreshToken, refreshExpiresIn }) =>
                set((state) => ({
                    user: user === undefined ? state.user : user,
                    accessToken,
                    refreshToken: refreshToken ?? state.refreshToken,
                    refreshExpiresAt: refreshExpiresIn ? Date.now() + refreshExpiresIn * 1000 : state.refreshExpiresAt,
                })),
            clearSession: () => set({ user: null, accessToken: "", refreshToken: "", refreshExpiresAt: 0 }),
        }),
        {
            name: USER_STORE_KEY,
            storage: {
                getItem: async (name) => {
                    const value = await localForageStorage.getItem(name);
                    return value ? JSON.parse(value) : null;
                },
                setItem: (name, value) => localForageStorage.setItem(name, JSON.stringify(value)),
                removeItem: (name) => localForageStorage.removeItem(name),
            },
            partialize: (state) => ({ user: state.user, refreshToken: state.refreshToken, refreshExpiresAt: state.refreshExpiresAt, configOwnerId: state.configOwnerId }) as never,
            onRehydrateStorage: () => () => {
                useUserStore.setState({ hydrated: true });
            },
        },
    ),
);
