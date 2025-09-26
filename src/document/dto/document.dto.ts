import { IsString, IsOptional, IsInt, Min, Max } from 'class-validator';

export class UploadDocumentDto {
  @IsString()
  title: string;

  @IsString()
  type: 'book' | 'past_question';

  @IsOptional()
  @IsInt()
  @Min(9)
  @Max(12)
  grade?: number;

  @IsOptional()
  @IsString()
  subject?: string;
}

export class GenerateQuestionDto {
  @IsOptional()
  @IsInt()
  @Min(9)
  @Max(12)
  grade?: number;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsOptional()
  @IsString()
  topic?: string;
}

export class GeneratedQuestionResponseDto {
  id: string;
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  subject?: string;
  grade?: number;
  createdAt: Date;
}