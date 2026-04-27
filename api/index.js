import { verifyWeChat, parseWeChatMessage, createWeChatReply } from './wechat.js';
import { askCoze } from './coze.js';

/**
 * 处理GET请求 - WeChat服务器验证
 */
async function handleGet(req) {
  const { signature, timestamp, nonce, echostr } = req.query;

  if (!signature || !timestamp || !nonce) {
    return {
      statusCode: 400,
      body: 'Missing required parameters'
    };
  }

  if (verifyWeChat(signature, timestamp, nonce)) {
    return {
      statusCode: 200,
      body: echostr || 'success'
    };
  }

  return {
    statusCode: 403,
    body: 'Invalid signature'
  };
}

/**
 * 处理POST请求 - 接收并回复WeChat消息
 */
async function handlePost(req) {
  try {
    const { signature, timestamp, nonce } = req.query;

    // 验证签名
    if (!verifyWeChat(signature, timestamp, nonce)) {
      return {
        statusCode: 403,
        body: 'Invalid signature'
      };
    }

    // 获取请求体
    let body = req.body;
    if (typeof body === 'string') {
      body = body;
    } else if (typeof body === 'object') {
      body = JSON.stringify(body);
    }

    // 解析WeChat消息
    const message = await parseWeChatMessage(body);
    console.log('Received message:', message);

    // 仅处理文本消息
    if (message.msgType !== 'text') {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/xml' },
        body: createWeChatReply(message.fromUser, message.toUser, '暂只支持文本消息')
      };
    }

    // 调用Coze API获取回复
    const aiResponse = await askCoze(message.content, message.fromUser);

    // 生成WeChat XML回复
    const xmlReply = createWeChatReply(message.fromUser, message.toUser, aiResponse);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/xml' },
      body: xmlReply
    };
  } catch (error) {
    console.error('Error handling POST request:', error);

    return {
      statusCode: 500,
      body: 'Internal server error'
    };
  }
}

/**
 * Vercel Serverless Function
 */
export default async function handler(req, res) {
  try {
    let response;

    if (req.method === 'GET') {
      response = await handleGet(req);
    } else if (req.method === 'POST') {
      response = await handlePost(req);
    } else {
      response = {
        statusCode: 405,
        body: 'Method not allowed'
      };
    }

    res.status(response.statusCode);
    if (response.headers) {
      Object.entries(response.headers).forEach(([key, value]) => {
        res.setHeader(key, value);
      });
    }
    res.send(response.body);
  } catch (error) {
    console.error('Unhandled error:', error);
    res.status(500).send('Internal server error');
  }
}
