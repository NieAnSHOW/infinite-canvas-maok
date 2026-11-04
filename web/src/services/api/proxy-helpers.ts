import { proxyRequest } from "./proxy";
import { getChannelById } from "@/stores/use-config-store";

export async function proxyFetch(channelId: string, path: string, options: {
    method: "GET" | "POST" | "PUT" | "DELETE";
    body?: string | ArrayBuffer | Uint8Array;
    contentType?: string;
    signal?: AbortSignal;
}): Promise<Response> {
    const channel = getChannelById(channelId);
    if (!channel) throw new Error(`Channel ${channelId} not found`);

    return proxyRequest({
        channelId,
        method: options.method,
        path,
        contentType: options.contentType || "application/json",
        body: options.body,
    }, options.signal);
}
