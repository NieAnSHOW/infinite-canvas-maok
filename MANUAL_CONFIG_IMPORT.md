# 手动导入配置步骤（临时方案）

## ⚠️ 重要前提

**账号必须一致**：后端代理会按 `admin_id = 当前登录管理员` 查询配置。
- 在 xihong-admin 后台保存配置的账号
- 必须就是 infinite-canvas 前端将要登录的那个 admin 账号
- 否则代理仍会报"尚未配置生成渠道"

## 步骤 1：导出前端配置

在 infinite-canvas-maok 前端页面打开浏览器控制台（F12），执行以下代码：

```javascript
// 获取配置（正确的 localStorage key）
const stored = localStorage.getItem('infinite-canvas:ai_config_store');
const parsed = JSON.parse(stored);

// 提取需要的配置字段
const exportConfig = {
  channels: parsed.state.config.channels,
  channelMode: parsed.state.config.channelMode
};

// 输出 JSON（复制这个结果）
console.log(JSON.stringify(exportConfig, null, 2));

// 如果上面报错，可能没有配置，执行：
console.log(parsed);
```

## 步骤 2：登录 xihong-admin 后台

1. 访问 xihong-admin 后台
2. **使用将要在 infinite-canvas 前端登录的同一个账号**（重要！）
3. 导航到：`画布配置` → `管理员配置`

如果看不到菜单，需要：
- 使用超级管理员账号登录
- 或在角色管理中为你的角色绑定该菜单权限
- 退出重新登录

## 步骤 3：粘贴并保存配置

1. 在配置页面的文本框中，粘贴步骤 1 复制的 JSON
2. 点击"保存配置"按钮
3. 确认保存成功（会显示版本号）

## 步骤 4：验证配置已同步

执行以下命令验证：

```bash
docker exec xihong-mysql mysql -uroot -pxihong123456 xygo -e "SELECT admin_id, version, LENGTH(config) as config_size FROM xy_canvas_admin_config" 2>&1 | grep -v Warning
```

应该能看到一条配置记录，`admin_id` 应该是你登录的管理员 ID。

## 步骤 5：测试代理调用

在 infinite-canvas 前端使用同一个账号登录，尝试生成图片/视频，验证代理是否正常工作。

## ⚠️ 重要注意事项

1. **channelId 必须匹配**：前端调用时使用的 `channelId` 必须与后台 JSON 中 `channels[].id` 一致
2. **apiKey 完整性**：确保 apiKey 是完整的真实密钥，不是 `***`
3. **JSON 格式**：必须是有效的 JSON 格式
4. **账号一致性**：前后端必须使用同一个 admin 账号

## 后续工作

这是临时方案，每次前端配置变更都需要手动同步到后台。

后续仍需要实现自动同步逻辑（在 `use-config-store.ts` 中添加配置同步），否则维护成本较高。
