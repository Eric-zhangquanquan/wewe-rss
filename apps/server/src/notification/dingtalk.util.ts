import crypto from 'crypto';
import axios from 'axios';

export interface DingTalkMessage {
  msgtype: 'markdown' | 'text';
  markdown?: {
    title: string;
    text: string;
  };
  text?: {
    content: string;
  };
}

interface DingTalkResponse {
  errcode: number;
  errmsg: string;
}

export async function sendDingTalkMessage(
  webhookUrl: string,
  secret: string | undefined,
  message: DingTalkMessage,
): Promise<void> {
  let url = webhookUrl;

  // 如果配置了 secret，生成签名
  if (secret) {
    const timestamp = Date.now();
    const sign = generateSign(timestamp, secret);
    url = `${webhookUrl}&timestamp=${timestamp}&sign=${encodeURIComponent(sign)}`;
  }

  const response = await axios.post<DingTalkResponse>(url, message, {
    headers: { 'Content-Type': 'application/json' },
    timeout: 5000,
  });

  // 检查钉钉 API 返回码
  if (response.data.errcode !== 0) {
    throw new Error(`DingTalk API error: ${response.data.errcode} - ${response.data.errmsg}`);
  }
}

function generateSign(timestamp: number, secret: string): string {
  const stringToSign = `${timestamp}\n${secret}`;
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(stringToSign);
  return hmac.digest('base64');
}