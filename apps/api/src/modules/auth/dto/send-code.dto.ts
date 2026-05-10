import { IsString, Matches } from 'class-validator';

export class SendCodeDto {
  @IsString()
  @Matches(/^1\d{10}$/)
  mobile!: string;
}
