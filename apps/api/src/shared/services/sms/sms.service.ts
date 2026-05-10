import { Injectable } from '@nestjs/common';

import { getSmsProviderName } from '../../env-config';
import { AliyunSmsProvider } from './providers/aliyun-sms.provider';
import { MockSmsProvider } from './providers/mock-sms.provider';

@Injectable()
export class SmsService {
  constructor(
    private readonly mockSmsProvider: MockSmsProvider,
    private readonly aliyunSmsProvider: AliyunSmsProvider,
  ) {}

  private get provider() {
    const provider = getSmsProviderName();
    if (provider === 'aliyun') {
      return this.aliyunSmsProvider;
    }
    return this.mockSmsProvider;
  }

  async sendLoginCode(mobile: string, code: string) {
    await this.provider.sendLoginCode(mobile, code);
  }
}
