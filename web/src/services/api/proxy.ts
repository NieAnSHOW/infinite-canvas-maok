import { useUserStore } from "@/stores/use-user-store";

const BASE_URL = "/xyapi";

export type ProxyRequest = {
    channelId: string;
    method: "GET" | "POST" | "PUT" | "DELETE";
    path: string;
    contentType?: string;
    body?: string | ArrayBuffer | Uint8Array;
};

export async function proxyRequest(req: ProxyRequest, signal?: AbortSignal): Promise<Response> {
    let bodyData: string = "";
    
    if (req.body) {
        if (typeof req.body === "string") {
            // JSON 字符串直接 base64 编码
            bodyData = btoa(unescape(encodeURIComponent(req.body)));
        } else {
            // ArrayBuffer 或 Uint8Array 转 base64
            const bytes = req.body instanceof Uint8Array ? req.body : new Uint8Array(req.body);
            let binary = '';
            for (let i = 0; i < bytes.length; i++) {
                binary += String.fromCharCode(bytes[i]);
            }
            bodyData = btoa(binary);
        }
    }

    const response = await fetch(`${BASE_URL}/admin/canvas/proxy`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${useUserStore.getState().accessToken}`,
        },
        body: JSON.stringify({
            channelId: req.channelId,
            method: req.method,
            path: req.path,
            contentType: req.contentType,
            body: bodyData,
        }),
        signal,
    });

    // 返回 response 让调用方处理错误消息
    return response;
}
