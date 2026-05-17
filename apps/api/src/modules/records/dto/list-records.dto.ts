import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListRecordsDto {
  @IsString()
  child_no!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  page_size?: number;

  @IsOptional()
  @IsString()
  record_type?: string;

  @IsOptional()
  @IsString()
  tag?: string;

  @IsOptional()
  @IsString()
  start_time?: string;

  @IsOptional()
  @IsString()
  end_time?: string;

  @IsOptional()
  @IsIn(['published', 'draft'])
  status?: 'published' | 'draft';
}
