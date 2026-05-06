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

function buildTemplatePayload(openid, content) {
  assertRequiredEnv(['WECHAT_TEMPLATE_ID'], 'wechat-template');

  const templateId = process.env.WECHAT_TEMPLATE_ID;
  const templateUrl = process.env.WECHAT_TEMPLATE_URL;

  const keyTitle = process.env.WECHAT_TEMPLATE_KEY_TITLE || 'first';
  const keyContent = process.env.WECHAT_TEMPLATE_KEY_CONTENT || 'keyword1';
  const keyTime = process.env.WECHAT_TEMPLATE_KEY_TIME || 'keyword2';
  const keyRemark = process.env.WECHAT_TEMPLATE_KEY_REMARK || 'remark';

  const title = process.env.WECHAT_TEMPLATE_TITLE || '每日情报推送';
  const remark = process.env.WECHAT_TEMPLATE_REMARK || '点击查看详情，回复消息可继续对话。';
  const nowText = new Date().toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    hour12: false
  });

  const data = {
    [keyContent]: { value: truncateText(content, 500) }
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

  if (templateUrl) {
    payload.url = templateUrl;
  }

  return payload;
}

/**
 * 通过微信公众号模板消息接口推送文本到指定用户
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
