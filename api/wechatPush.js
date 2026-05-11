import axios from 'axios';

const WECHAT_TOKEN_URL = 'https://api.weixin.qq.com/cgi-bin/token';
const WECHAT_TEMPLATE_SEND_URL = 'https://api.weixin.qq.com/cgi-bin/message/template/send';

function isMissingEnv(name) {
  const value = process.env[name];
  return typeof value !== 'string' || !value.trim();
}

function assertRequiredEnv(names, scene) {
  const missing = names.filter(isMissingEnv);
  if (missing.length > 0) {
    throw new Error(`[${scene}] Missing required env: ${missing.join(', ')}`);
  }
}

/**
 * 获取微信 access_token
 * @returns {Promise<string>}
 */
async function getAccessToken() {
  assertRequiredEnv(['WECHAT_APPID', 'WECHAT_APPSECRET'], 'wechat-token');
  const appid = process.env.WECHAT_APPID;
  const secret = process.env.WECHAT_APPSECRET;

  const response = await axios.get(WECHAT_TOKEN_URL, {
    params: {
      grant_type: 'client_credential',
      appid,
      secret
    },
    timeout: 10000
  });

  if (response.data.errcode) {
    throw new Error(`WeChat token error: ${response.data.errmsg}`);
  }

  return response.data.access_token;
}

function truncateText(text, maxLength) {
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, Math.max(0, maxLength - 3))}...`;
}

function parseNewsItems(content) {
  const blocks = content.trim().split(/\n{2,}/);
  const items = [];
  for (const block of blocks) {
    const lines = block.split('\n');
    let title = '', core = '', link = '';
    for (const line of lines) {
      if (/^标题[：:]/.test(line)) title = line.replace(/^标题[：:]\s*/, '').trim();
      else if (/^核心[：:]/.test(line)) core = line.replace(/^核心[：:]\s*/, '').trim();
      else if (/^链接[：:]/.test(line)) link = line.replace(/^链接[：:]\s*/, '').trim();
    }
    if (title) items.push({ title, core, link });
  }
  return items;
}

function buildTemplatePayload(openid, content, { itemUrl, titleOverride } = {}) {
  assertRequiredEnv(['WECHAT_TEMPLATE_ID'], 'wechat-template');

  const templateId = process.env.WECHAT_TEMPLATE_ID;
  const templateUrl = process.env.WECHAT_TEMPLATE_URL;

  const keyTitle = process.env.WECHAT_TEMPLATE_KEY_TITLE || 'first';
  const keyContent = process.env.WECHAT_TEMPLATE_KEY_CONTENT || 'keyword1';
  const keyTime = process.env.WECHAT_TEMPLATE_KEY_TIME || 'keyword2';
  const keyRemark = process.env.WECHAT_TEMPLATE_KEY_REMARK || 'remark';

  const title = titleOverride || process.env.WECHAT_TEMPLATE_TITLE || '每日情报推送';
  const remark = process.env.WECHAT_TEMPLATE_REMARK || '点击查看详情，回复消息可继续对话。';
  const nowText = new Date().toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    hour12: false
  });

  const data = {
    [keyContent]: { value: truncateText(content, 200) }
  };

  if (keyTitle) {
    data[keyTitle] = { value: truncateText(title, 120) };
  }
  if (keyTime) {
    data[keyTime] = { value: nowText };
  }
  if (keyRemark) {
    data[keyRemark] = { value: truncateText(remark, 200) };
  }

  const payload = {
    touser: openid,
    template_id: templateId,
    data
  };

  const finalUrl = itemUrl || templateUrl;
  if (finalUrl) {
    payload.url = finalUrl;
  }

  return payload;
}

/**
 * 通过微信公众号模板消息接口推送文本到指定用户（单条）
 * @param {string} openid - 目标用户的 OpenID
 * @param {string} content - 消息内容
 * @returns {Promise<void>}
 */
export async function pushWeChatMessage(openid, content) {
  if (!openid) {
    throw new Error('WECHAT_PUSH_OPENID not configured');
  }

  const normalizedContent = typeof content === 'string'
    ? content.trim()
    : String(content ?? '').trim();
  if (!normalizedContent) {
    throw new Error('Empty message content from Coze');
  }

  const accessToken = await getAccessToken();

  const response = await axios.post(
    `${WECHAT_TEMPLATE_SEND_URL}?access_token=${accessToken}`,
    buildTemplatePayload(openid, normalizedContent),
    {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000
    }
  );

  if (response.data.errcode && response.data.errcode !== 0) {
    throw new Error(`WeChat template push error [${response.data.errcode}]: ${response.data.errmsg}`);
  }
}

/**
 * 将 AI 返回的多条新闻内容解析后逐条推送模板消息
 * @param {string} openid - 目标用户的 OpenID
 * @param {string} content - AI 返回的完整内容（含多条标题/核心/链接）
 * @returns {Promise<void>}
 */
export async function pushWeChatMessages(openid, content) {
  if (!openid) {
    throw new Error('WECHAT_PUSH_OPENID not configured');
  }

  const normalizedContent = typeof content === 'string'
    ? content.trim()
    : String(content ?? '').trim();
  if (!normalizedContent) {
    throw new Error('Empty message content from Coze');
  }

  const items = parseNewsItems(normalizedContent);

  // 解析失败时降级为单条发送
  if (items.length === 0) {
    return pushWeChatMessage(openid, normalizedContent);
  }

  const accessToken = await getAccessToken();
  const baseTitle = process.env.WECHAT_TEMPLATE_TITLE || '每日情报推送';
  const total = items.length;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const msgContent = `标题：${item.title}\n核心：${item.core}`;
    const titleOverride = `${baseTitle} (${i + 1}/${total})`;

    const payload = buildTemplatePayload(openid, msgContent, {
      itemUrl: item.link || undefined,
      titleOverride
    });

    const response = await axios.post(
      `${WECHAT_TEMPLATE_SEND_URL}?access_token=${accessToken}`,
      payload,
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      }
    );

    if (response.data.errcode && response.data.errcode !== 0) {
      throw new Error(`WeChat template push error [${response.data.errcode}]: ${response.data.errmsg} (item ${i + 1})`);
    }

    // 避免触发微信接口频率限制
    if (i < items.length - 1) {
      await new Promise(r => setTimeout(r, 500));
    }
  }
}
