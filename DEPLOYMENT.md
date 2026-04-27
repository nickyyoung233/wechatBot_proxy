# 部署指南

## 步骤 1: 准备 Coze Bot

1. 访问 [Coze 官网](https://www.coze.com)
2. 创建或选择一个 Bot
3. 在 Bot 设置中找到 **Bot ID**
4. 在账户设置中生成 **API Key**

保存这两个值，稍后需要。

## 步骤 2: 准备 WeChat 公众号

### 2.1 获取基本信息

1. 登录 [微信公众平台](https://mp.weixin.qq.com)
2. 进入「基本配置」
3. 找到「服务器配置」部分
4. 记录：
   - AppID
   - AppSecret

### 2.2 生成 Token

1. 在「服务器配置」中的「令牌(Token)」字段填入一个自定义的随机字符串
   - 例如：`my_wechat_secret_token_2024`
   - 保存这个值

## 步骤 3: 部署到 Vercel

### 3.1 推送代码到 GitHub

```bash
# 初始化 git（如果还没有）
git init

# 添加所有文件
git add .

# 提交
git commit -m "Initial commit: WeChat Coze proxy service"

# 添加 GitHub 仓库
git remote add origin https://github.com/YOUR_USERNAME/wechatBot_proxy.git

# 推送到 GitHub
git branch -M main
git push -u origin main
```

### 3.2 在 Vercel 上创建项目

1. 访问 [Vercel 官网](https://vercel.com)
2. 使用 GitHub 账户登录
3. 点击「Add New」→「Project」
4. 选择 `wechatBot_proxy` 仓库
5. 点击「Import」

### 3.3 配置环境变量

在 Vercel 项目设置中：

1. 进入「Settings」→「Environment Variables」
2. 添加以下环境变量：

| 变量名 | 值 | 说明 |
|-------|---|-----|
| `WECHAT_TOKEN` | `my_wechat_secret_token_2024` | 步骤 2.2 中生成的 Token |
| `WECHAT_APPID` | `xxxxxxxxxxxxxxxx` | 微信公众号 AppID |
| `WECHAT_APPSECRET` | `xxxxxxxxxxxxxxxx` | 微信公众号 AppSecret |
| `COZE_API_KEY` | `pat_xxxxxxxxxxxxxxxx` | Coze API Key |
| `COZE_BOT_ID` | `xxxxxxxxxxxxxxxx` | Coze Bot ID |

3. 点击「Save」

### 3.4 部署

环境变量保存后，Vercel 会自动部署您的项目。

1. 等待部署完成（通常需要 1-2 分钟）
2. 部署完成后，您会获得一个 Vercel URL，例如：
   ```
   https://wechatbot-proxy.vercel.app
   ```

## 步骤 4: 配置 WeChat 公众号

### 4.1 配置服务器地址

1. 回到微信公众平台「基本配置」
2. 在「服务器配置」中填入：
   - **URL**：`https://your-vercel-url.vercel.app/`（用您的实际 Vercel URL 替换）
   - **Token**：`my_wechat_secret_token_2024`（与步骤 2.2 一致）
   - **EncodingAESKey**：保持原值或重新生成

3. **重要**：勾选「加密模式」对应的消息加密方式（推荐"明文模式"便于测试）
4. 点击「提交」进行验证

### 4.2 成功标志

- 如果看到「✓ 配置成功」的提示，说明配置正确
- 微信服务器可以成功连接到您的 Vercel 应用

## 步骤 5: 测试

### 5.1 本地测试（可选）

```bash
# 复制环境变量示例
cp .env.example .env

# 编辑 .env，填入实际的配置值

# 安装依赖
npm install

# 运行测试脚本
node test.js
```

### 5.2 在微信公众号测试

1. 关注您的微信公众号
2. 发送任何文本消息
3. 应该收到来自 Coze Bot 的回复

## 常见问题排查

### ❌ 微信提示「配置失败」

**原因**：Vercel URL 无法访问或签名验证失败

**解决**：
1. 确保 Vercel URL 正确且可公开访问（不要使用 localhost）
2. 检查 `WECHAT_TOKEN` 环境变量是否与公众平台设置一致
3. 在 Vercel Dashboard 中查看日志：`Deployments` → 选择最新部署 → `Logs`

### ❌ 发送消息后没有回复

**原因**：Coze API 配置不正确或网络问题

**解决**：
1. 检查 Vercel 日志中是否有错误信息
2. 验证 `COZE_API_KEY` 和 `COZE_BOT_ID` 是否正确
3. 确保 Coze Bot 已发布并能正常使用
4. 检查 Coze 账户是否有剩余的 API 调用额度

### ❌ Vercel 部署失败

**原因**：依赖安装或代码错误

**解决**：
1. 在 Vercel Dashboard 中查看部署日志
2. 确保 `package.json` 依赖版本正确
3. 在本地运行 `npm install` 验证依赖是否可安装

## 监控和维护

### 查看日志

在 Vercel Dashboard：
1. 进入项目
2. 点击「Deployments」
3. 选择最新部署
4. 点击「Logs」查看实时日志

### 更新代码

1. 在本地修改代码
2. 提交到 GitHub
3. Vercel 会自动重新部署

```bash
git add .
git commit -m "Update: fix issue XYZ"
git push
```

## 高级配置

### 添加请求日志记录

可以在 `api/index.js` 中添加更详细的日志记录。

### 添加消息类型支持

当前仅支持文本消息。可以在 `api/wechat.js` 中扩展支持图片、语音等。

### 添加速率限制

可以使用 Vercel KV 或其他解决方案实现速率限制。

## 成本估算

- **Vercel**：免费（在合理使用范围内）
- **Coze API**：按照使用量计费（具体查看 Coze 定价）
- **WeChat 公众号**：免费或认证费用（不同类型公众号不同）

## 获取帮助

- WeChat API 文档：https://developers.weixin.qq.com/doc/offiaccount/
- Coze API 文档：https://www.coze.com/docs/api
- Vercel 文档：https://vercel.com/docs
