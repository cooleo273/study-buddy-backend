import { IsNotEmpty, IsString, IsOptional, IsNumber, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateChatSessionDto {
  @ApiProperty({ example: 'Math homework help', description: 'Chat session topic or title' })
  @IsString()
  @IsOptional()
  topic?: string;

  @ApiProperty({ example: 'Can you help me solve 2x + 3 = 7?', description: 'User message' })
  @IsString()
  @IsNotEmpty()
  userMessage: string;

  @ApiPropertyOptional({ example: 'The solution is x = 2. Let me explain step by step...', description: 'AI response' })
  @IsString()
  @IsOptional()
  aiResponse?: string;
}

export class UpdateChatSessionDto {
  @ApiPropertyOptional({ example: 'Updated user message', description: 'Updated user message' })
  @IsString()
  @IsOptional()
  userMessage?: string;

  @ApiPropertyOptional({ example: 'Updated AI response', description: 'Updated AI response' })
  @IsString()
  @IsOptional()
  aiResponse?: string;

  @ApiPropertyOptional({ example: 'Advanced algebra help', description: 'Updated topic' })
  @IsString()
  @IsOptional()
  topic?: string;
}

export class ChatSessionsQueryDto {
  @ApiPropertyOptional({ example: 1, description: 'Page number (1-based)' })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ example: 10, description: 'Number of items per page' })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @IsOptional()
  limit?: number = 10;
}

export class PaginatedChatSessionsDto {
  @ApiProperty({ description: 'Array of chat sessions' })
  data: any[];

  @ApiProperty({ example: 1, description: 'Current page number' })
  page: number;

  @ApiProperty({ example: 10, description: 'Number of items per page' })
  limit: number;

  @ApiProperty({ example: 25, description: 'Total number of chat sessions' })
  total: number;

  @ApiProperty({ example: 3, description: 'Total number of pages' })
  totalPages: number;
}
