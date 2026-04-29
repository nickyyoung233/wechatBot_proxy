# wechatBot_proxy

一个 每日定时推送定制化消息的智能代理服务： 基于 Coze AI Bot做智能化Agent，通过WeChat测试公众号进行推送， 部署在vercel上执行定时调度

## 功能特性

- ✅ 微信公众号（个人测试版）消息接收与验证
- ✅ 接入 Coze AI Bot 提供智能回复
- ✅ 定时推送功能（Vercel Cron）
- ✅ 微信客服消息推送（支持分段发送）
- ✅ 智能响应格式处理（段落分隔符）
- ✅ 部署在 Vercel Serverless 平台
- ✅ 最小化实现，快速上手

## 前置要求

- Node.js 18+
- WeChat 公众号（需要获取 Token、AppID、AppSecret）
- Coze 账户（API Key， Bot ID）
   - API Key: 该令牌需要支持chat和messageList权限
   - Bot：一个配置检索功能的agent
- Vercel 账户（用于部署）

## 本地开发

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env`，填入真实的配置：

```bash
cp .env.example .env
```

编辑 `.env` 文件：

```env
# WeChat Configuration
WECHAT_TOKEN=your_wechat_token_here
WECHAT_APPID=your_wechat_appid_here
WECHAT_APPSECRET=your_wechat_appsecret_here

# Coze Configuration
COZE_API_KEY=your_coze_api_key_here
COZE_BOT_ID=your_coze_bot_id_here

PORT=3000
```

### 3. 本地运行

```bash
npm run dev
```

服务将在 `http://localhost:3000` 启动

### 4. 本地测试

```bash
node test.js
```

## 部署到 Vercel

### 1. 推送到 GitHub

```bash
git add .
git commit -m "Initial commit"
git push origin main
```

### 2. 在 Vercel 部署

访问 [Vercel Dashboard](https://vercel.com/dashboard)，连接 GitHub 项目。

### 3. 配置环境变量

在 Vercel 项目设置中，添加以下环境变量：

**必需：**
- `WECHAT_TOKEN` - 微信服务器验证令牌
- `WECHAT_APPID` - 微信公众号 AppID
- `WECHAT_APPSECRET` - 微信公众号密钥
- `COZE_API_KEY` - Coze API 密钥
- `COZE_BOT_ID` - Coze Bot ID

**可选（定时推送）：**
- `WECHAT_PUSH_OPENID` - 推送目标用户 OpenID
- `CRON_PROMPT` - 定时任务触发词
- `CRON_SECRET` - Cron 请求鉴权密钥

**可选（Coze 性能调优）：**
- `COZE_API_BASE` - Coze API 基础 URL（默认 https://api.coze.com）
- `COZE_POLL_INTERVAL_MS` - 轮询间隔（默认 1500ms）
- `COZE_POLL_TIMEOUT_MS` - 轮询超时（默认 60000ms）

### 4. 配置 WeChat 公众号

在微信公众平台后台：

1. 进入"基本配置"
2. 填入 Vercel 部署后的 URL（如 `https://your-project.vercel.app/`）
3. 填入 `WECHAT_TOKEN`
4. 提交验证

## 项目结构

```
├── api/
│   ├── index.js          # Vercel serverless 入口点
│   ├── wechat.js         # 微信消息处理、验证
│   ├── coze.js           # Coze API 调用（v3 API with polling）
│   ├── wechatPush.js     # 微信客服消息推送
│   └── cron.js           # 定时任务处理（Vercel Cron）
├── package.json          # 项目依赖配置
├── vercel.json           # Vercel 部署配置（Cron 调度）
├── .env.example          # 环境变量示例
├── QUICKSTART.md         # 快速开始指南
├── DEPLOYMENT.md         # 完整部署文档
└── README.md
```

## API 工作流程

```
1. 用户在微信公众号发送消息
   ↓
2. WeChat 服务器向您的应用发送 POST 请求
   ↓
3. 应用验证签名（verifyWeChat）
   ↓
4. 解析 WeChat XML 消息
   ↓
5. 调用 Coze API 获取 AI 回复
   ↓
6. 返回 XML 格式的回复给 WeChat
   ↓
7. 用户收到回复
```

## 获取配置信息

### WeChat Token

在微信公众平台 → 基本配置 → 服务器配置中自定义设置

### Coze API Key 和 Bot ID

1. 访问 [Coze 官网](https://www.coze.com)
2. 创建或选择一个 Bot
3. 在 Bot 设置中获取 Bot ID
4. 在账户设置中生成 API Key

## 常见问题

### 1. 微信验证失败

- 检查 `WECHAT_TOKEN` 是否与微信公众平台中设置的一致
- 确保 URL 正确且可公开访问
- 确保服务器配置中消息加密方式与代码兼容

### 2. 没有收到 Coze 回复

- 检查 `COZE_API_KEY` 和 `COZE_BOT_ID` 是否正确
- 查看 Vercel 日志了解具体错误信息
- 若出现 404，自动尝试备用 API 域名（.com → .cn）

### 3. 消息解析错误

- 确保微信公众号使用的是文本消息
- 检查 XML 编码是否为 UTF-8
- 检查 POST 请求体是否正确传递

### 4. 定时推送不工作

- 检查 Vercel Cron Jobs 是否有历史执行记录
- 确保环境变量 `WECHAT_PUSH_OPENID` 已配置
- 确认 `CRON_SECRET` 与 vercel.json 中的配置一致
- Hobby 套餐 Cron 有 ±1 小时的弹性时间窗口

### 5. 推送消息出现 44004 错误

- 确保推送内容非空
- 检查目标 OpenID 在 48 小时内与公众号有过互动
- 查看 Coze 是否正常返回回复内容

## 许可证

MIT

## 相关资源

- [WeChat 公众平台文档](https://developers.weixin.qq.com/doc/offiaccount/Message_Management/Service_Center_messages.html)
- [Coze API 文档](https://www.coze.com/docs/api)
- [Vercel 文档](https://vercel.com/docs)
