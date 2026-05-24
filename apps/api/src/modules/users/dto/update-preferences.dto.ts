import { IsBoolean, IsOptional } from 'class-validator';

export class UpdatePreferencesDto {
  @IsOptional()
  @IsBoolean()
  allow_mobile_search?: boolean;

  @IsOptional()
  @IsBoolean()
  show_history_to_new_members?: boolean;
}
