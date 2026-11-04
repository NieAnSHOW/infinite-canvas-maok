import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Spin } from "antd";
import { Navigate, useLocation } from "react-router-dom";

import { restoreSession } from "@/services/api/auth";
import { useUserStore } from "@/stores/use-user-store";

/** Blocks child routes until a session exists: swaps the persisted refreshToken for an accessToken once, else redirects to /login. */
export function AuthGuard({ children }: { children: ReactNode }) {
    const location = useLocation();
    const hydrated = useUserStore((state) => state.hydrated);
    const accessToken = useUserStore((state) => state.accessToken);
    const [restored, setRestored] = useState(false);

    useEffect(() => {
        if (!hydrated) return;
        if (useUserStore.getState().accessToken) {
            setRestored(true);
            return;
        }
        void restoreSession().finally(() => setRestored(true));
    }, [hydrated]);

    if (!hydrated || !restored) {
        return (
            <div className="flex h-dvh items-center justify-center bg-background">
                <Spin />
            </div>
        );
    }
    if (!accessToken) return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
    return <>{children}</>;
}
