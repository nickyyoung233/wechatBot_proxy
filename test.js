/**
 * 本地测试脚本 - 用于验证 Coze API 连接
 * 使用方法: node test.js
 */

import dotenv from 'dotenv';
import { askCoze } from './api/coze.js';

dotenv.config();

async function test() {
  console.log('🧪 WeChat Coze Proxy 测试\n');

  // 检查环境变量
  console.log('📋 环境变量检查:');
  const required = ['COZE_API_KEY', 'COZE_BOT_ID', 'WECHAT_TOKEN'];
  let allConfigured = true;

  required.forEach(env => {
    const value = process.env[env];
    const status = value ? '✅' : '❌';
    console.log(`  ${status} ${env}: ${value ? '已配置' : '未配置'}`);
    if (!value) allConfigured = false;
  });

  if (!allConfigured) {
    console.log('\n⚠️  请先配置 .env 文件中的环境变量');
    process.exit(1);
  }

  console.log('\n📤 测试 Coze API 调用...');
  try {
    const response = await askCoze('你好，测试一下', 'test_user_123');
    console.log('✅ Coze API 响应成功:');
    console.log(`   ${response}`);
  } catch (error) {
    console.log('❌ Coze API 调用失败:');
    console.log(`   ${error.message}`);
  }
}

test();
