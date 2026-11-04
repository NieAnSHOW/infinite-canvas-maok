import type { MouseEvent } from "react";
import { useCallback, useEffect, useState } from "react";
import { Button, Modal, Spin } from "antd";
import { RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";

import { getClickCaptcha, type ClickCaptcha } from "@/services/api/auth";

type ClickCaptchaModalProps = {
    open: boolean;
    onCancel: () => void;
    /** captchaInfo format required by the backend: `x1,y1-x2,y2;imageWidth;imageHeight`. */
    onSuccess: (captchaId: string, captchaInfo: string) => void;
};

export function ClickCaptchaModal({ open, onCancel, onSuccess }: ClickCaptchaModalProps) {
    const { t } = useTranslation();
    const [data, setData] = useState<ClickCaptcha | null>(null);
    const [points, setPoints] = useState<{ x: number; y: number }[]>([]);
    const [loading, setLoading] = useState(false);
    const [failed, setFailed] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        setPoints([]);
        setFailed(false);
        try {
            setData(await getClickCaptcha());
        } catch {
            setFailed(true);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (open) void load();
    }, [open, load]);

    // The backend validates against the rendered image size, so read width/height from the element.
    const handleClick = (event: MouseEvent<HTMLImageElement>) => {
        if (!data || points.length >= data.text.length) return;
        const next = [...points, { x: Math.round(event.nativeEvent.offsetX), y: Math.round(event.nativeEvent.offsetY) }];
        setPoints(next);
        if (next.length === data.text.length) {
            const img = event.currentTarget;
            onSuccess(data.id, `${next.map((point) => `${point.x},${point.y}`).join("-")};${img.width};${img.height}`);
        }
    };

    return (
        <Modal open={open} onCancel={onCancel} footer={null} centered destroyOnHidden title={t("auth.captchaTitle")} width={data ? data.width + 48 : 400}>
            <Spin spinning={loading}>
                <div className="flex min-h-40 flex-col items-center gap-3">
                    {failed ? <div className="py-10 text-sm text-stone-500">{t("auth.captchaLoadFailed")}</div> : null}
                    {data && !failed ? (
                        <>
                            <div className="text-sm">{t("auth.captchaTip", { text: data.text.join(" ") })}</div>
                            <div className="relative inline-block">
                                <img src={data.base64} width={data.width} height={data.height} alt="" draggable={false} className="block cursor-crosshair select-none" onClick={handleClick} />
                                {points.map((point, index) => (
                                    <span key={index} className="pointer-events-none absolute flex size-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-xs text-white" style={{ left: point.x, top: point.y }}>
                                        {index + 1}
                                    </span>
                                ))}
                            </div>
                        </>
                    ) : null}
                    <Button size="small" type="text" icon={<RefreshCw className="size-3.5" />} disabled={loading} onClick={() => void load()}>
                        {t("auth.captchaRefresh")}
                    </Button>
                </div>
            </Spin>
        </Modal>
    );
}
