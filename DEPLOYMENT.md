# 部署指南

## 目标

将项目部署到 Vercel，实现：
- 公众号消息自动回复
- 每日定时模板推送
- 模板点击进入详情页查看完整资讯

## 步骤 1：准备 Coze

1. 登录 Coze
2. 创建或选择一个 Bot
3. 获取：
- `COZE_API_KEY`
- `COZE_BOT_ID`

## 步骤 2：准备微信公众号

在微信公众平台记录：
- `AppID`
- `AppSecret`
- 自定义 `Token`

## 步骤 3：部署 Vercel

1. 代码推送到 GitHub
2. Vercel 导入仓库
3. 配置环境变量
4. 点击 Deploy

## 步骤 4：配置环境变量

必填：
- `WECHAT_TOKEN`
- `WECHAT_APPID`
- `WECHAT_APPSECRET`
- `COZE_API_KEY`
- `COZE_BOT_ID`
- `WECHAT_TEMPLATE_ID`
- `WECHAT_PUSH_OPENID`

推荐：
- `BASE_URL=https://你的生产域名`

可选：
- `CRON_PROMPT`
- `CRON_SECRET`
- `COZE_API_BASE`
- `COZE_POLL_INTERVAL_MS`
- `COZE_POLL_TIMEOUT_MS`
- `WECHAT_TEMPLATE_KEY_TITLE`
- `WECHAT_TEMPLATE_KEY_CONTENT`
- `WECHAT_TEMPLATE_KEY_TIME`
- `WECHAT_TEMPLATE_KEY_REMARK`
- `WECHAT_TEMPLATE_TITLE`
- `WECHAT_TEMPLATE_REMARK`

## 步骤 5：公众号服务器配置

在「基本配置 -> 服务器配置」填写：
- URL：`https://你的域名/`
- Token：与 `WECHAT_TOKEN` 一致

保存并验证成功后，消息回调将进入本项目。

## 步骤 6：验证接口

1. 会话回复验证
- 给公众号发送文本消息
- 预期：收到 Coze 文本回复

2. Cron 验证
- 如有 `CRON_SECRET`：

```bash
curl -i "https://你的域名/api/cron" \
  -H "Authorization: Bearer 你的CRON_SECRET"
```

- 强制触发联调：

```bash
curl -i "https://你的域名/api/cron?force=1"
```

3. 详情页验证
- 打开模板消息后应进入 `/api/detail`
- 预期：资讯按条展示，可点击「查看原文」

## 关键说明

1. 调度时区
- `vercel.json` 的 cron 使用 UTC
- 当前默认 `0 0 * * *`，即北京时间约 08:00

2. 安全
- 建议配置 `CRON_SECRET` 防止 `/api/cron` 被外部滥用

3. 详情页域名
- 若 `BASE_URL` 未配置，会回退 `VERCEL_URL`
- 为避免多环境域名波动，生产建议固定 `BASE_URL`

## 故障排查

1. 微信验证失败
- 检查域名和 token
- 检查 Vercel 日志中签名验证信息

2. cron 返回 401
- 检查 `Authorization: Bearer ...`
- 检查 `CRON_SECRET`

3. 模板消息发送失败
- 检查 `WECHAT_TEMPLATE_ID` 与字段映射
- 检查 `WECHAT_PUSH_OPENID`

4. 详情页空白
- 检查 `BASE_URL`
- 检查是否已部署 `api/detail.js`

5. Coze 超时
- 增加 `COZE_POLL_TIMEOUT_MS`
- 检查 Coze 服务状态与配额
