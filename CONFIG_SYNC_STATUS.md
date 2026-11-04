# 配置同步状态与后续工作

## 当前状态

### ✅ 已完成
1. **前端透传代理迁移**：所有 API 调用已切换到后端代理
2. **后端代理接口**：`POST /admin/canvas/proxy` 已实现
3. **后台配置页面**：xihong-admin 管理员配置页面已创建
4. **数据库迁移**：菜单已成功插入到 MySQL

### ⚠️ 缺失环节

**问题**：后端代理依赖 `xy_canvas_admin_config` 表查询渠道配置，但该表为空。

**原因**：
- `web/src/services/api/auth.ts` 定义了 `getCanvasConfig()` 和 `saveCanvasConfig()`
- 但前端没有任何地方调用这两个函数
- 用户的本地配置从未同步到服务端

**影响**：
- 所有 API 代理调用会失败：`"尚未配置生成渠道，请先保存配置"`
- generate_admin.go:59-61 会直接返回错误

## 解决方案

### 方案一：在前端添加配置同步（推荐）

在 `web/src/stores/use-config-store.ts` 添加同步逻辑：

1. **应用启动时**：调用 `getCanvasConfig()` 加载服务端配置
2. **配置变更时**：调用 `saveCanvasConfig()` 同步到服务端
3. **守卫条件**：version === 0 且本地无配置时不上传

**需要修改的文件**：
- `web/src/stores/use-config-store.ts` - 添加同步逻辑
- `web/src/App.tsx` 或 `AppProviders` - 启动时加载配置

### 方案二：手动导入配置（临时方案）

**步骤**：
1. 在 infinite-canvas-maok 前端导出配置：
   ```js
   // 在浏览器控制台执行
   const config = localStorage.getItem('ai-config-storage');
   const parsed = JSON.parse(config);
   console.log(JSON.stringify(parsed.state.config, null, 2));
   ```

2. 复制 JSON 到 xihong-admin 后台：
   - 登录后台 → `画布配置` → `管理员配置`
   - 粘贴 JSON 并保存

3. **注意**：确保 `channels[].id` 与前端一致

## 后续任务

### 必须完成
- [ ] 实现前端配置同步逻辑
- [ ] 测试完整的代理调用链路
- [ ] 验证 apiKey 掩码处理

### 可选优化
- [ ] 添加配置版本冲突处理
- [ ] 添加配置导入/导出功能
- [ ] 添加配置校验与错误提示

## 文件位置

- 后端代理逻辑：`/Users/niean/Documents/project/xihong-admin/server/addons/canvas/logic/generate_admin.go`
- 配置同步接口：`/Users/niean/Documents/project/infinite-canvas-maok/web/src/services/api/auth.ts:127-133`
- 配置存储：`/Users/niean/Documents/project/infinite-canvas-maok/web/src/stores/use-config-store.ts`
