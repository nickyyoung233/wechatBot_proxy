# 快速开始

## 1. 准备账号与信息

- 微信公众号（测试号可）
- Coze 账号（准备 Bot）
- Vercel 账号

需要的关键值：
- `WECHAT_TOKEN`
- `WECHAT_APPID`
- `WECHAT_APPSECRET`
- `COZE_API_KEY`
- `COZE_BOT_ID`
- `WECHAT_TEMPLATE_ID`
- `WECHAT_PUSH_OPENID`

## 2. 本地启动

```bash
npm install
cp .env.example .env
npm run dev
```

可选测试：

```bash
node test.js
```

## 3. 部署到 Vercel

1. 推送仓库到 GitHub
2. 在 Vercel 导入项目
3. 配置环境变量
4. 部署完成后拿到域名

强烈建议额外配置：
- `BASE_URL=https://你的固定生产域名`

## 4. 微信公众平台配置

在公众号后台「基本配置 -> 服务器配置」填写：
- URL: `https://你的域名/`
- Token: 与 `WECHAT_TOKEN` 一致

验证通过后即可收发消息。

## 5. 配置定时推送

项目内 `vercel.json` 已配置：
- `0 0 * * *`（UTC）
- 对应北京时间每天 08:00 左右触发

如你设置了 `CRON_SECRET`，外部手动调用需带鉴权头：

```bash
curl -i "https://你的域名/api/cron" \
  -H "Authorization: Bearer 你的CRON_SECRET"
```

手动强制触发（跳过鉴权）可用于联调：

```bash
curl -i "https://你的域名/api/cron?force=1"
```

## 6. 当前推送形态

- 只发送 1 条模板消息
- 模板消息包含资讯预览
- 点击后跳转 `/api/detail`
- 详情页展示完整资讯分段与原文跳转按钮

## 7. 最小环境变量模板

```env
WECHAT_TOKEN=xxx
WECHAT_APPID=xxx
WECHAT_APPSECRET=xxx
COZE_API_KEY=xxx
COZE_BOT_ID=xxx
WECHAT_TEMPLATE_ID=xxx
WECHAT_PUSH_OPENID=xxx
BASE_URL=https://your-app.vercel.app
```
