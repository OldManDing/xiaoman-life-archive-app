import { Global, Module } from '@nestjs/common';

import { AccessControlService } from './services/access-control.service';
import { AuditLogService } from './services/audit-log.service';
import { SmsCodeService } from './services/sms-code.service';
import { AliyunSmsProvider } from './services/sms/providers/aliyun-sms.provider';
import { MockSmsProvider } from './services/sms/providers/mock-sms.provider';
import { SmsService } from './services/sms/sms.service';
import { StorageService } from './services/storage.service';

@Global()
@Module({
  providers: [AccessControlService, AuditLogService, StorageService, SmsCodeService, SmsService, MockSmsProvider, AliyunSmsProvider],
  exports: [AccessControlService, AuditLogService, StorageService, SmsCodeService, SmsService],
})
export class SharedModule {}
