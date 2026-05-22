import { IsInt, IsString, Min, MinLength } from 'class-validator';

export class CreateCommentDto {
  @IsInt()
  @Min(1)
  authorId: number;

  @IsString()
  @MinLength(1)
  content: string;
}
