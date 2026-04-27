import axios from 'axios';

const COZE_API_BASE = 'https://api.coze.com/v1';
const API_KEY = process.env.COZE_API_KEY;
const BOT_ID = process.env.COZE_BOT_ID;

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

    const response = await axios.post(
      `${COZE_API_BASE}/chat`,
      {
        bot_id: BOT_ID,
        user_id: userId || 'default_user',
        stream: false,
        auto_save_history: true,
        messages: [
          {
            role: 'user',
            content: message,
            content_type: 'text'
          }
        ]
      },
      {
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    if (response.data?.messages && response.data.messages.length > 0) {
      const lastMessage = response.data.messages[response.data.messages.length - 1];
      return lastMessage.content || '无法获取回复内容';
    }

    return '暂无回复';
  } catch (error) {
    console.error('Coze API Error:', error.message);
    return '抱歉，处理您的请求时出错了。';
  }
}
