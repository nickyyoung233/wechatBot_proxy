# 快速开始 (Quick Start)

## 5分钟快速部署

### 前置要求

- GitHub 账户
- Vercel 账户（免费）
- WeChat 公众号
- Coze 账户

### 快速步骤

#### 1️⃣ 获取配置信息

**Coze：**
- 登录 https://www.coze.com
- 创建或选择 Bot → 获取 **Bot ID**
- 账户设置 → 生成 **API Key**

**WeChat：**
- 登录 https://mp.weixin.qq.com
- 基本配置 → 记录 **AppID** 和 **AppSecret**
- 自定义一个 **Token**（例如：`my_token_123`）

#### 2️⃣ 推送到 GitHub

```bash
git add .
git commit -m "Deploy"
git push
```

#### 3️⃣ 在 Vercel 部署

1. 访问 https://vercel.com/dashboard
2. "Add New" → "Project"
3. 选择此仓库并导入
4. 环境变量设置：

```
WECHAT_TOKEN=my_token_123
WECHAT_APPID=your_appid
WECHAT_APPSECRET=your_appsecret
COZE_API_KEY=your_coze_key
COZE_BOT_ID=your_coze_bot_id
```

5. 点击 Deploy

#### 4️⃣ 配置 WeChat

1. 微信公众平台 → 基本配置
2. 服务器配置：
   - URL: `https://your-vercel-url.vercel.app/`
   - Token: `my_token_123`
   - 选择消息加密方式（明文/兼容/密文模式都支持）
3. 点击"提交"验证

#### 5️⃣（可选）配置定时推送

若要启用每天定时发送情报到用户：

1. 获取用户 OpenID（发送消息后从 WeChat 回调中获取）
2. 在 Vercel 环境变量中添加：
   ```
   WECHAT_PUSH_OPENID=user_openid_here
   CRON_PROMPT=【定时任务触发】：现在请开始执行今日前端技术情报总结。
   CRON_SECRET=your_random_secret
   ```
3. 在 `vercel.json` 中配置触发时间（UTC 时区）：
   ```json
   "schedule": "0 0 * * *"  // 每天 UTC 00:00（北京时间 08:00）
   ```
4. 部署后，Cron 会在指定时间自动触发

**时区说明：** 所有时间都使用 UTC 时区
- 北京时间 08:00 = UTC 00:00
- 北京时间 14:35 = UTC 06:35
- 北京时间 20:00 = UTC 12:00

#### 6️⃣ 测试

1. **消息对话测试**：关注公众号，发送文本消息，等待 Coze 回复
2. **定时推送测试**（如配置）：
   ```bash
   curl -i "https://your-vercel-url.vercel.app/api/cron" \
     -H "Authorization: Bearer your_cron_secret"
   ```

---

## 本地开发

```bash
# 1. 复制环境变量
cp .env.example .env

# 2. 编辑 .env（填入实际配置）
nano .env

# 3. 安装依赖
npm install

# 4. 测试（可选）
node test.js

# 5. 本地开发服务器
npm run dev
```

## 项目结构

```
api/
├── index.js      ← Vercel 入口
├── wechat.js     ← WeChat 处理
└── coze.js       ← Coze API 调用
```

## 关键代码说明

### WeChat 消息流程

```javascript
// 1. 验证签名
verifyWeChat(signature, timestamp, nonce)

// 2. 解析 XML
await parseWeChatMessage(xmlData)

// 3. 调用 Coze（自动轮询直到完成）
await askCoze(userMessage, userId)

// 4. 提取格式化回复（role=assistant type=answer，用 --- 分隔段落）
extractAnswerFromMessages(messages)

// 5. 生成回复
createWeChatReply(toUser, fromUser, content)
```

### 定时推送流程

```javascript
// 1. Vercel Cron 按时触发 /api/cron
// 2. 调用 Coze 获取 AI 回复
await askCoze(cronPrompt, 'cron_scheduled_task')

// 3. 推送给目标用户（自动分段，2000字/段）
await pushWeChatMessage(openid, aiResponse)
```

### 环境变量

| 变量 | 说明 | 必需 |
|-----|------|------|
| `WECHAT_TOKEN` | 微信服务器验证令牌 | ✅ |
| `WECHAT_APPID` | 微信公众号 AppID | ✅ |
| `WECHAT_APPSECRET` | 微信公众号密钥 | ✅ |
| `COZE_API_KEY` | Coze API 密钥 | ✅ |
| `COZE_BOT_ID` | Coze Bot 唯一标识 | ✅ |
| `WECHAT_PUSH_OPENID` | 推送目标用户 OpenID | ❌ |
| `CRON_PROMPT` | 定时任务触发词 | ❌ |
| `CRON_SECRET` | Cron 请求鉴权密钥 | ❌ |
| `COZE_API_BASE` | Coze API 基础 URL | ❌ |
| `COZE_POLL_INTERVAL_MS` | Coze 轮询间隔（ms） | ❌ |
| `COZE_POLL_TIMEOUT_MS` | Coze 轮询超时（ms） | ❌ |

## 常见错误

| 错误 | 原因 | 解决 |
|------|------|------|
| 配置失败 | URL 错误或 Token 不匹配 | 检查 Vercel URL 和 Token |
| 无回复 | Coze API 配置错误 | 验证 API Key 和 Bot ID |
| 502 错误 | 服务异常 | 查看 Vercel 日志 |

## 后续优化

- 💬 支持图片/语音消息
- ⏱️ 添加消息速率限制
- 💾 持久化对话历史
- 🔐 支持消息加密
- 📊 添加使用统计

## 更多文档

- [完整部署指南](./DEPLOYMENT.md)
- [WeChat API 文档](https://developers.weixin.qq.com/doc/offiaccount/)
- [Coze API 文档](https://www.coze.com/docs/api)

---

**需要帮助？** 检查日志：

```bash
# Vercel 日志
vercel logs --follow

# 本地测试
node test.js
```
