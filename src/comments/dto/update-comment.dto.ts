import { IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class UpdateCommentDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  content?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  version?: number;
}
