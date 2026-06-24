import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsString, MaxLength, Min, MinLength } from 'class-validator';

export class CheckAppUpdateDto {
  @IsIn(['android'])
  platform!: 'android';

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  version!: string;

  @IsInt()
  @Min(0)
  build_number!: number;
}
