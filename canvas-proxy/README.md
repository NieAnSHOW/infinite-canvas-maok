# @basketikun/canvas-proxy

Infinite Canvas 的本地转发代理。浏览器直连第三方 AI 接口时经常被 CORS 拦截，启动它之后，网页会把请求先发到本机，再由本机转发到目标地址。

通过局域网 IP 等非本机地址访问 Infinite Canvas 时，浏览器直连 MiniMax 官方接口等会被 CORS 拦截；在打开页面的那台电脑上运行本代理即可解决。

代理只做转发：不改写请求体，不校验 API Key，不落盘任何日志。

## 使用

### Windows 双击启动

双击运行本目录下的 `canvas-proxy.bat`。脚本会自动检查 Node.js 环境（未安装或版本低于 18 时提示安装地址并保持窗口可读），优先运行同目录的 `index.js`；把 `canvas-proxy.bat` 和 `index.js` 一起分发即可完全离线使用，只分发 `canvas-proxy.bat` 时会自动改用 `npx` 拉取已发布包，首次运行需要联网。命令行参数原样透传，例如 `canvas-proxy.bat --port 23210`。

### 命令行启动

```bash
npx @basketikun/canvas-proxy@latest
```

默认监听 `http://127.0.0.1:23210`。把这个地址填进 Infinite Canvas 的「配置 → 本地代理」，并打开开关即可。

带上 `@latest` 是因为 npx 会缓存已下载的版本，不加就可能一直运行旧版本。

可选参数：

```bash
npx @basketikun/canvas-proxy@latest --port 23210 --host 127.0.0.1
```

也支持 `PORT` / `HOST` 环境变量。

## 转发规则

把完整目标地址接在代理地址后面：

```
http://127.0.0.1:23210/https://api.openai.com/v1/models
        └─── 代理地址 ──┘└──────── 目标地址 ────────┘
```

请求方法、请求头（除 `host` 等逐跳头外）、请求体原样转发；响应状态码、响应头和响应体原样返回，并补上宽松的 CORS 头。SSE 流式响应按块透传，不做缓冲。

访问根路径 `/` 会返回代理版本信息，可用于连通性检测，不会记入转发日志。

## 转发日志

每转发一条请求就在终端打印一行，包含时间、方法、完整目标地址、上游状态码和耗时：

```
4:05:42 PM GET https://api.openai.com/v1/models -> 200 0.9s
4:05:43 PM POST https://api.openai.com/v1/images/generations -> 200 26.4s
4:05:45 PM GET https://api.example.com/v1/models -> failed (fetch failed) 1.6s
```

日志在收到上游响应头时打印，所以流式请求会立刻出现一行，而不是等整段响应结束。日志只输出到终端，不落盘，也不包含请求头和请求体，因此不会泄露 API Key。

## 公网 HTTP 部署时请把代理放到服务器上

页面通过公网 IP 以 HTTP 打开时（例如 Docker 部署在云服务器上），Chrome 的 Local Network Access 保护会直接禁止页面访问使用者电脑的 `127.0.0.1` 或局域网地址，报错形如 `The request client is not a secure context and the resource is in more-private address space "loopback"`。这种部署下各使用者电脑上运行的 `canvas-proxy.bat` 无法被页面访问，属于浏览器安全策略，代理本身无法绕过。

解决办法是在部署页面的服务器上运行本代理并开放对应端口，所有使用者把「配置 → 本地代理」的地址填成 `http://<服务器IP>:23210`：

```bash
docker run -d --name canvas-proxy --restart unless-stopped -p 23210:23210 \
  node:22-alpine npx --yes @basketikun/canvas-proxy@latest --host 0.0.0.0
```

服务器访问 npm 较慢时可加 `-e npm_config_registry=https://registry.npmmirror.com`。注意这等于把一个公开转发端点暴露到公网，任何人都能借它中继请求，请配合安全组把端口来源限制到实际使用者，或仅在使用期间开放。

## 安全提示

代理默认只监听 `127.0.0.1`，仅本机可访问。它会转发任何请求到任何地址，请不要用 `--host 0.0.0.0` 暴露到公网。API Key 依然由浏览器持有并随请求转发，代理本身不存储。

## 环境要求

Node.js >= 18。
