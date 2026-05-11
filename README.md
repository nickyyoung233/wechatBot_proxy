# wechatBot_proxy

基于 Vercel Serverless 的微信公众号代理服务：
- 接收公众号文本消息并调用 Coze 生成回复
- 通过 Vercel Cron 定时推送「模板消息」
- 模板消息点击后进入站内详情页，再跳转原文链接

## 当前能力

- 微信服务器签名校验（GET 回调验证）
- 微信文本消息处理（POST XML）
- Coze v3 Chat + 轮询完成态
- 每日定时推送（/api/cron）
- 模板消息单条推送（标题摘要 + 详情页跳转）
- 详情页分块展示（标题/核心/链接）

## 技术栈

- Node.js ESM
- Vercel Serverless Functions
- axios
- xml2js

## 项目结构

```text
api/
  index.js        # 微信入口（GET 验证 / POST 消息）
  wechat.js       # 微信签名、XML 解析、XML 回复
  coze.js         # Coze API 调用与轮询
  cron.js         # 定时任务入口
  wechatPush.js   # 模板消息推送 + 详情页URL生成
  detail.js       # 资讯详情页（HTML）
DEPLOYMENT.md
QUICKSTART.md
README.md
vercel.json
```

## 路由与行为

- GET `/`
  - 微信公众平台服务器配置校验
- POST `/`
  - 接收微信 XML 消息，仅文本消息进入 Coze
- GET `/api/cron`
  - 定时任务入口
  - 若设置了 `CRON_SECRET`，需携带 `Authorization: Bearer <CRON_SECRET>`
  - 支持 `?force=1` 手动触发并跳过鉴权
- GET `/api/detail?d=<base64url>`
  - 渲染详情页，展示 AI 生成的完整资讯内容

## 定时推送说明

当前实现为「单条模板消息 + 详情页承载全文」：
- 模板消息正文只放简短预览，避免字段显示截断
- 点击模板消息进入 `/api/detail`
- 详情页中每条资讯可点击「查看原文」跳转外链

详情链接由以下规则生成：
- 优先使用 `BASE_URL`
- 若未设置，回退 `https://<VERCEL_URL>`

## 环境变量

必填：
- `WECHAT_TOKEN`
- `WECHAT_APPID`
- `WECHAT_APPSECRET`
- `COZE_API_KEY`
- `COZE_BOT_ID`
- `WECHAT_TEMPLATE_ID`
- `WECHAT_PUSH_OPENID`

推荐填写：
- `BASE_URL`（例如 `https://your-app.vercel.app`）

可选：
- `CRON_PROMPT`
- `CRON_SECRET`
- `COZE_API_BASE`
- `COZE_POLL_INTERVAL_MS`
- `COZE_POLL_TIMEOUT_MS`
- `WECHAT_TEMPLATE_KEY_TITLE`（默认 `first`）
- `WECHAT_TEMPLATE_KEY_CONTENT`（默认 `keyword1`）
- `WECHAT_TEMPLATE_KEY_TIME`（默认 `keyword2`）
- `WECHAT_TEMPLATE_KEY_REMARK`（默认 `remark`）
- `WECHAT_TEMPLATE_TITLE`（默认 `每日情报推送`）
- `WECHAT_TEMPLATE_REMARK`（默认 `点击查看完整详情`）

## 本地开发

```bash
npm install
cp .env.example .env
npm run dev
```

补充测试：

```bash
node test.js
```

说明：`test.js` 主要用于验证 Coze 连通性。

## 部署

请参考：
- [快速开始](./QUICKSTART.md)
- [部署指南](./DEPLOYMENT.md)

## 常见问题

1. 微信服务器配置失败
- 检查 URL 可公网访问
- 检查 `WECHAT_TOKEN` 与公众号后台一致

2. 定时任务 401
- 检查 `CRON_SECRET` 与请求头 Bearer 值一致

3. 模板消息点击后详情为空
- 检查 `BASE_URL` 是否正确
- 检查 `api/detail` 是否已部署（vercel.json 已包含）

4. Coze 无回复或超时
- 检查 `COZE_API_KEY`、`COZE_BOT_ID`
- 适当增大 `COZE_POLL_TIMEOUT_MS`
