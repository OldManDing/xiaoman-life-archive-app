import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDeviceTokenDto {
  @IsIn(['android', 'ios'])
  platform!: 'android' | 'ios';

  @IsIn(['hms', 'fcm', 'apns', 'local'])
  provider!: 'hms' | 'fcm' | 'apns' | 'local';

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(16)
  @MaxLength(1024)
  push_token!: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(128)
  device_label?: string;
}
