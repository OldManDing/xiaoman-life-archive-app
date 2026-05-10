import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import Core from '@alicloud/pop-core';

import { SmsProvider } from '../sms-provider';

@Injectable()
export class AliyunSmsProvider implements SmsProvider {
  private readonly logger = new Logger(AliyunSmsProvider.name);

  private createClient() {
    const accessKeyId = process.env.SMS_ACCESS_KEY;
    const accessKeySecret = process.env.SMS_SECRET_KEY;

    if (!accessKeyId || !accessKeySecret) {
      throw new InternalServerErrorException('短信服务配置缺失');
    }

    return new Core({
      accessKeyId,
      accessKeySecret,
      endpoint: process.env.SMS_ENDPOINT ?? 'https://dysmsapi.aliyuncs.com',
      apiVersion: '2017-05-25',
    });
  }

  async sendLoginCode(mobile: string, code: string) {
    const signName = process.env.SMS_SIGN_NAME;
    const templateCode = process.env.SMS_TEMPLATE_CODE;

    if (!signName || !templateCode) {
      throw new InternalServerErrorException('短信模板配置缺失');
    }

    const client = this.createClient();

    try {
      const response = await client.request('SendSms', {
        PhoneNumbers: mobile,
        SignName: signName,
        TemplateCode: templateCode,
        TemplateParam: JSON.stringify({ code }),
      }, { method: 'POST' });

      this.logger.log(`Aliyun SMS sent to ${mobile}: ${JSON.stringify(response)}`);
    } catch (error) {
      this.logger.error(`Aliyun SMS failed for ${mobile}`, error instanceof Error ? error.stack : undefined);
      throw new InternalServerErrorException('短信发送失败');
    }
  }
}
