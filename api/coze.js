import axios from 'axios';

const API_KEY = process.env.COZE_API_KEY;
const BOT_ID = process.env.COZE_BOT_ID;
const COZE_API_BASE = process.env.COZE_API_BASE;

const DEFAULT_BASES = ['https://api.coze.com', 'https://api.coze.cn'];

function getCandidateBases() {
  if (COZE_API_BASE && COZE_API_BASE.trim()) {
    return [COZE_API_BASE.trim().replace(/\/$/, '')];
  }
  return DEFAULT_BASES;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractAnswerFromMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    return '';
  }

  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const msg = messages[i];
    if (msg?.role !== 'assistant') {
      continue;
    }
    if (msg?.type && msg.type !== 'answer') {
      continue;
    }

    const rawContent = typeof msg.content === 'string' ? msg.content : '';
    if (!rawContent) {
      continue;
    }

    // Coze 某些消息会把结构化内容放在 JSON 字符串中，优先取 data 字段。
    try {
      const parsed = JSON.parse(rawContent);
      if (typeof parsed?.data === 'string' && parsed.data.trim()) {
        return parsed.data;
      }
    } catch {
    // 非 JSON 文本直接返回
    }

    return rawContent;
  }

  return '';
}

async function requestCoze(baseUrl, message, userId) {
  const startResp = await axios.post(
    `${baseUrl}/v3/chat`,
    {
      bot_id: BOT_ID,
      user_id: userId || 'default_user',
      stream: false,
      auto_save_history: true,
      additional_messages: [
        {
          role: 'user',
          type: 'question',
          content: message,
          content_type: 'text'
        }
      ]
    },
    {
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    }
  );

  if (startResp.data?.code && startResp.data.code !== 0) {
    throw new Error(`Coze chat create failed: ${startResp.data.msg || startResp.data.code}`);
  }

  const data = startResp.data?.data || {};
  const chatId = data.id || data.chat_id || startResp.data?.id;
  const conversationId = data.conversation_id || startResp.data?.conversation_id;

  // 兼容少量直接返回消息的场景
  const directAnswer =
    extractAnswerFromMessages(data.messages) ||
    extractAnswerFromMessages(startResp.data?.messages) ||
    data.answer ||
    startResp.data?.answer ||
    '';
  if (directAnswer) {
    return directAnswer;
  }

  if (!chatId || !conversationId) {
    throw new Error('Coze response missing chat_id or conversation_id');
  }

  // 非流式模式下，轮询会话状态直到完成。
  const maxPollTimes = 20;
  for (let i = 0; i < maxPollTimes; i += 1) {
    const retrieveResp = await axios.get(`${baseUrl}/v3/chat/retrieve`, {
      params: {
        chat_id: chatId,
        conversation_id: conversationId
      },
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    if (retrieveResp.data?.code && retrieveResp.data.code !== 0) {
      throw new Error(`Coze chat retrieve failed: ${retrieveResp.data.msg || retrieveResp.data.code}`);
    }

    const status = retrieveResp.data?.data?.status;
    const lastError = retrieveResp.data?.data?.last_error;

    if (status === 'failed') {
      throw new Error(`Coze chat failed: ${lastError?.msg || 'unknown error'}`);
    }

    if (status === 'completed') {
      const messagesResp = await axios.get(`${baseUrl}/v3/chat/message/list`, {
        params: {
          conversation_id: conversationId,
          chat_id: chatId
        },
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      if (messagesResp.data?.code && messagesResp.data.code !== 0) {
        throw new Error(
          `Coze message list failed: ${messagesResp.data.msg || messagesResp.data.code}`
        );
      }

      const answer = extractAnswerFromMessages(messagesResp.data?.data);
      return answer || '暂无回复';
    }

    await sleep(1000);
  }

  throw new Error('Coze chat timeout while waiting for completion');
}

/**
 * 调用Coze API获取AI回复
 * @param {string} message - 用户消息
 * @param {string} userId - 用户ID（用于对话上下文）
 * @returns {Promise<string>} AI回复内容
 */
export async function askCoze(message, userId) {
  try {
    if (!API_KEY || !BOT_ID) {
      console.error('Missing Coze credentials');
      return '抱歉，服务暂时不可用。';
    }

    const bases = getCandidateBases();
    let lastError;

    for (const baseUrl of bases) {
      try {
        return await requestCoze(baseUrl, message, userId);
      } catch (error) {
        lastError = error;
        // 404 通常是域名/路径版本不匹配，尝试下一个 base。
        if (error?.response?.status === 404) {
          continue;
        }
        throw error;
      }
    }

    throw lastError || new Error('All Coze API endpoints failed');
  } catch (error) {
    console.error('Coze API Error:', error.response?.data || error.message);
    return '抱歉，处理您的请求时出错了。';
  }
}
