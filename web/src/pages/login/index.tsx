import { useEffect, useState } from "react";
import { App, Button, Form, Input } from "antd";
import { Navigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { ClickCaptchaModal } from "@/components/auth/click-captcha-modal";
import { login, restoreSession } from "@/services/api/auth";
import { useUserStore } from "@/stores/use-user-store";

type Credentials = { username: string; password: string };

export default function LoginPage() {
    const { t } = useTranslation();
    const { message } = App.useApp();
    const location = useLocation();
    const from = (location.state as { from?: string } | null)?.from || "/";
    const hydrated = useUserStore((state) => state.hydrated);
    const accessToken = useUserStore((state) => state.accessToken);
    const [credentials, setCredentials] = useState<Credentials | null>(null);
    const [loading, setLoading] = useState(false);

    // A persisted refreshToken restores the session without asking for credentials again.
    useEffect(() => {
        if (hydrated) void restoreSession();
    }, [hydrated]);

    if (accessToken) return <Navigate to={from} replace />;

    const submit = async (captchaId: string, captchaInfo: string) => {
        if (!credentials) return;
        setLoading(true);
        try {
            await login({ ...credentials, captchaId, captchaInfo });
        } catch (error) {
            message.error(error instanceof Error && error.message ? error.message : t("auth.loginFailed"));
        } finally {
            setLoading(false);
            setCredentials(null);
        }
    };

    return (
        <div className="flex h-dvh items-center justify-center bg-background px-4 text-foreground">
            <div className="w-full max-w-sm">
                <h1 className="mb-6 text-2xl font-semibold">{t("auth.title")}</h1>
                <Form layout="vertical" requiredMark={false} onFinish={(values: Credentials) => setCredentials(values)}>
                    <Form.Item name="username" label={t("auth.username")} rules={[{ required: true, message: t("auth.usernameRequired") }]}>
                        <Input autoComplete="username" autoFocus />
                    </Form.Item>
                    <Form.Item name="password" label={t("auth.password")} rules={[{ required: true, message: t("auth.passwordRequired") }]}>
                        <Input.Password autoComplete="current-password" />
                    </Form.Item>
                    <Button type="primary" htmlType="submit" block loading={loading}>
                        {t("auth.submit")}
                    </Button>
                </Form>
            </div>
            <ClickCaptchaModal open={Boolean(credentials)} onCancel={() => setCredentials(null)} onSuccess={(captchaId, captchaInfo) => void submit(captchaId, captchaInfo)} />
        </div>
    );
}
