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
  const items = [];
  // 以「标题：」为起始标记切割多条新闻，兼容单换行和双换行
  const blocks = content.trim().split(/(?=^标题[：:])/m);
  for (const block of blocks) {
    const lines = block.split('\n');
    let title = '', core = '', link = '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (/^标题[：:]/.test(trimmed)) title = trimmed.replace(/^标题[：:]\s*/, '');
      else if (/^核心[：:]/.test(trimmed)) core = trimmed.replace(/^核心[：:]\s*/, '');
      else if (/^链接[：:]/.test(trimmed)) link = trimmed.replace(/^链接[：:]\s*/, '');
    }
    if (title) items.push({ title, core, link });
  }
  return items;
}

function buildDetailUrl(item) {
  const baseUrl = process.env.BASE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '');
  if (!baseUrl) return '';
  try {
    const encoded = Buffer.from(JSON.stringify({
      title: item.title,
      core: item.core,
      link: item.link
    })).toString('base64url');
    return `${baseUrl}/api/detail?d=${encoded}`;
  } catch {
    return '';
  }
}

function buildTemplatePayload(openid, content, { itemUrl, titleOverride } = {}) {
  assertRequiredEnv(['WECHAT_TEMPLATE_ID'], 'wechat-template');

  const templateId = process.env.WECHAT_TEMPLATE_ID;

  const keyTitle = process.env.WECHAT_TEMPLATE_KEY_TITLE || 'first';
  const keyContent = process.env.WECHAT_TEMPLATE_KEY_CONTENT || 'keyword1';
  const keyTime = process.env.WECHAT_TEMPLATE_KEY_TIME || 'keyword2';
  const keyRemark = process.env.WECHAT_TEMPLATE_KEY_REMARK || 'remark';

  const title = titleOverride || process.env.WECHAT_TEMPLATE_TITLE || '每日情报推送';
  const remark = process.env.WECHAT_TEMPLATE_REMARK || '点击查看完整详情';
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
    data[keyRemark] = { value: remark };
  }

  const payload = {
    touser: openid,
    template_id: templateId,
    data
  };

  if (itemUrl) {
    payload.url = itemUrl;
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
  console.log(`[WechatPush] Parsed ${items.length} news items`);

  // 解析失败时降级为单条发送
  if (items.length === 0) {
    console.warn('[WechatPush] No items parsed, falling back to single message');
    return pushWeChatMessage(openid, normalizedContent);
  }

  const accessToken = await getAccessToken();
  const baseTitle = process.env.WECHAT_TEMPLATE_TITLE || '每日情报推送';
  const total = items.length;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    // keyword1 只放核心描述，first 字段放序号+文章标题
    const msgContent = item.core;
    const titleOverride = `(${i + 1}/${total}) ${item.title}`;
    const detailUrl = buildDetailUrl(item);

    const payload = buildTemplatePayload(openid, msgContent, {
      itemUrl: detailUrl || undefined,
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
