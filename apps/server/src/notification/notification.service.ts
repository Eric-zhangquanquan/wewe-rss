import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConfigurationType } from '@server/configuration';
import { sendDingTalkMessage, DingTalkMessage } from './dingtalk.util';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(timezone);

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(this.constructor.name);

  // 去重记录：同一账号同类型错误同一天只通知一次
  // 格式: "accountId:errorCode" -> date
  private notifiedRecords: Map<string, string> = new Map();

  constructor(private readonly configService: ConfigService) {}

  async sendAccountExpiredNotification(accountId: string, accountName: string) {
    return this.sendNotification(accountId, accountName, '401', '账号登录失效');
  }

  async sendAccountRateLimitedNotification(accountId: string, accountName: string) {
    return this.sendNotification(accountId, accountName, '429', '请求频繁被限流');
  }

  private async sendNotification(
    accountId: string,
    accountName: string,
    errorCode: '401' | '429',
    reason: string,
  ) {
    const config = this.configService.get<ConfigurationType['dingtalk']>('dingtalk');

    // 如果未配置钉钉，跳过通知
    if (!config?.webhookUrl) {
      this.logger.debug('钉钉配置未配置，跳过通知');
      return;
    }

    // 去重检查
    const key = `${accountId}:${errorCode}`;
    const today = dayjs().tz('Asia/Shanghai').format('YYYY-MM-DD');

    if (this.notifiedRecords.get(key) === today) {
      this.logger.debug(`账号 ${accountId} 今日已通知过 ${errorCode} 错误，跳过`);
      return;
    }

    const time = dayjs().tz('Asia/Shanghai').format('YYYY-MM-DD HH:mm:ss');
    const title = errorCode === '401' ? '⚠️ 账号登录失效' : '⚠️ 账号被限流';
    const content = `### ${title}\n\n- **账号**: ${accountName}\n- **时间**: ${time}\n- **原因**: ${reason}\n- **处理**: 请重新扫码登录账号`;

    const message: DingTalkMessage = {
      msgtype: 'markdown',
      markdown: {
        title,
        text: content,
      },
    };

    try {
      await sendDingTalkMessage(config.webhookUrl, config.secret, message);
      this.notifiedRecords.set(key, today);
      this.logger.log(`钉钉通知发送成功: ${title} - ${accountName}`);
    } catch (err) {
      this.logger.error('钉钉通知发送失败:', err);
    }
  }
}