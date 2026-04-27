import axios from 'axios';

const WECHAT_TOKEN_URL = 'https://api.weixin.qq.com/cgi-bin/token';
const WECHAT_SEND_URL = 'https://api.weixin.qq.com/cgi-bin/message/custom/send';

// 微信客服消息文本最大长度
const MAX_MSG_LENGTH = 2000;

/**
 * 获取微信 access_token
 * @returns {Promise<string>}
 */
async function getAccessToken() {
  const appid = process.env.WECHAT_APPID;
  const secret = process.env.WECHAT_APPSECRET;

  if (!appid || !secret) {
    throw new Error('WECHAT_APPID or WECHAT_APPSECRET not configured');
  }

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

/**
 * 将长文本拆分为多段（WeChat 单条消息上限 2000 字）
 * @param {string} text
 * @returns {string[]}
 */
function splitMessage(text) {
  const chunks = [];
  for (let i = 0; i < text.length; i += MAX_MSG_LENGTH) {
    chunks.push(text.slice(i, i + MAX_MSG_LENGTH));
  }
  return chunks;
}

/**
 * 通过微信客服消息接口推送文本到指定用户
 * 注意：目标用户需在 48 小时内与公众号有过互动（发送过消息）
 * @param {string} openid - 目标用户的 OpenID
 * @param {string} content - 消息内容
 * @returns {Promise<void>}
 */
export async function pushWeChatMessage(openid, content) {
  if (!openid) {
    throw new Error('WECHAT_PUSH_OPENID not configured');
  }

  const accessToken = await getAccessToken();
  const chunks = splitMessage(content);

  for (const chunk of chunks) {
    const response = await axios.post(
      `${WECHAT_SEND_URL}?access_token=${accessToken}`,
      {
        touser: openid,
        msgtype: 'text',
        text: { content: chunk }
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      }
    );

    if (response.data.errcode && response.data.errcode !== 0) {
      throw new Error(`WeChat push error [${response.data.errcode}]: ${response.data.errmsg}`);
    }
  }
}
