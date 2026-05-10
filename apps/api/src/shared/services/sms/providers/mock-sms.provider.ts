import { Injectable, Logger } from '@nestjs/common';

import { SmsProvider } from '../sms-provider';

@Injectable()
export class MockSmsProvider implements SmsProvider {
  private readonly logger = new Logger(MockSmsProvider.name);

  async sendLoginCode(mobile: string, code: string) {
    this.logger.log(`Mock SMS code for ${mobile}: ${code}`);
  }
}
