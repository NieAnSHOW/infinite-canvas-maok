# Backend Proxy Migration Status

## Completed Backend Infrastructure

✅ **Server-side (xihong-admin canvas addon):**
- API: `POST /admin/canvas/proxy {channelId, method, path, contentType, body(base64)}`
- Logic: Reads `xy_canvas_admin_config` by adminId, matches channel by `channelId`, injects auth headers (Gemini: `x-goog-api-key`, others: `Authorization: Bearer`), transparent passthrough with SSE support
- Config safety: GetAdminConfig masks apiKey as `"***"`, SaveAdminConfig merges back original keys
- Database: `xy_canvas_admin_config` table created (MySQL + PostgreSQL)
- Routes: AdminAuth middleware, no menu permission checks

✅ **Frontend Infrastructure:**
- `proxy.ts`: Base64-encodes request body, POSTs to `/admin/canvas/proxy`
- `proxy-helpers.ts`: `proxyFetch(channelId, path, {method, body, contentType})`
- `use-config-store.ts`: Added `channelId` to `resolveModelRequestConfig` return, `getChannelById` helper
- `auth.ts`: Added `getCanvasConfig()` and `saveCanvasConfig()`

## Required Frontend Migration

### 1. image.ts - Text Generation (SSE)
**Lines to change:** 580, 667, 728
**Current:** Direct `fetch()` to OpenAI/Gemini/MiniMax with `config.apiKey`
**New pattern:**
```typescript
const response = await proxyFetch(requestConfig.channelId, path, {
    method: "POST",
    body: JSON.stringify(bodyObj),
    contentType: "application/json",
    signal: options?.signal
});
```

### 2. image.ts - Image Generation
**Lines to change:** 813 (FormData), 863, 870
**Current:** Direct fetch with Authorization header
**Note:** Line 813 uses FormData for `/images/edits`, needs base64 encoding

### 3. video.ts - Video Generation
**Lines to change:** 187, 238, 311
**Current:** Direct POST/GET with provider-specific headers
**New:** Use `proxyFetch(requestConfig.channelId, ...)`

### 4. audio.ts - Audio Generation
**Line to change:** 50 (Blob body)
**Current:** Direct fetch with Blob
**New:** Convert Blob to ArrayBuffer, let proxy.ts base64-encode it

### 5. model-plugin.ts - Custom Script HTTP
**Lines to change:** 47-74 (createPluginHttp, pluginUrl)
**Current:** Scripts inject `config.apiKey` and call providers directly
**Critical:** All 12 built-in scripts break when apiKey becomes `"***"`
**Solution:** Rewrite `createPluginHttp` to POST via `/admin/canvas/proxy` with channelId, pass dummy apiKey to scripts

### 6. Config Initialization
**Add to:** `web/src/components/app-providers.tsx` or similar startup hook
**New:** Call `getCanvasConfig()` on app mount, merge into config store if `exists: true`

## Migration Strategy

1. **Phase 1:** Wire config loading (`getCanvasConfig` → store initialization)
2. **Phase 2:** Replace direct calls in `image.ts` text/image paths
3. **Phase 3:** Replace `video.ts` and `audio.ts`
4. **Phase 4:** Rewrite `model-plugin.ts` for scripts
5. **Phase 5:** Delete dead code (`buildApiUrl`, `geminiHeaders`, direct apiKey usage)
6. **Phase 6:** Build and verify

## Build Status
- ✅ Backend compiles
- ✅ Frontend compiles (no migration done yet)
- ⚠️ Proxy code has zero importers - no actual cutover

## Next Steps
User requested full cutover ("全面转向后端"). Need to:
1. Complete all 6 call-site replacements above
2. Remove direct-call helpers
3. Verify build
4. Report which endpoints were exercised
