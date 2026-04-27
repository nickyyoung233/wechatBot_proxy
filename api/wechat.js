import crypto from 'crypto';
import { parseStringPromise, Builder } from 'xml2js';

const WECHAT_TOKEN = process.env.WECHAT_TOKEN;

/**
 * 验证WeChat服务器请求
 * @param {string} signature - 微信服务器发来的signature
 * @param {string} timestamp - 时间戳
 * @param {string} nonce - 随机数
 * @returns {boolean}
 */
export function verifyWeChat(signature, timestamp, nonce) {
  if (!WECHAT_TOKEN) {
    console.error('WECHAT_TOKEN not configured');
    return false;
  }

  const arr = [WECHAT_TOKEN, timestamp, nonce].sort();
  const str = arr.join('');
  const sha1 = crypto.createHash('sha1').update(str).digest('hex');
  return sha1 === signature;
}

/**
 * 解析微信消息XML
 * @param {string} xmlData - WeChat XML消息
 * @returns {Promise<Object>} 解析后的消息对象
 */
export async function parseWeChatMessage(xmlData) {
  try {
    const result = await parseStringPromise(xmlData);

    const msg = result.xml;
    return {
      fromUser: msg.FromUserName?.[0] || '',
      toUser: msg.ToUserName?.[0] || '',
      content: msg.Content?.[0] || '',
      msgType: msg.MsgType?.[0] || 'text',
      createTime: msg.CreateTime?.[0] || '',
      msgId: msg.MsgId?.[0] || ''
    };
  } catch (error) {
    console.error('Parse WeChat message error:', error.message);
    throw error;
  }
}

/**
 * 生成WeChat XML回复
 * @param {string} fromUser - 接收者OpenID
 * @param {string} toUser - 发送者OpenID
 * @param {string} content - 回复内容
 * @returns {string} XML格式的回复
 */
export function createWeChatReply(fromUser, toUser, content) {
  const timestamp = Math.floor(Date.now() / 1000);
  const xml = `<xml>
<ToUserName><![CDATA[${fromUser}]]></ToUserName>
<FromUserName><![CDATA[${toUser}]]></FromUserName>
<CreateTime>${timestamp}</CreateTime>
<MsgType><![CDATA[text]]></MsgType>
<Content><![CDATA[${content}]]></Content>
</xml>`;

  return xml;
}
