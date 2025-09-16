import { IsNotEmpty, IsString, IsOptional, IsNumber, Min, IsArray, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class ChatMessageDto {
  @ApiProperty({ example: 'user', description: 'Role of the message sender', enum: ['user', 'assistant'] })
  @IsString()
  @IsIn(['user', 'assistant'])
  role: 'user' | 'assistant';

  @ApiProperty({ example: 'Can you help me solve 2x + 3 = 7?', description: 'Message content' })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiPropertyOptional({ example: '2025-09-16T10:30:00.000Z', description: 'Message creation timestamp' })
  @IsString()
  @IsOptional()
  createdAt?: string;

  @ApiPropertyOptional({ example: 'conv_123_001', description: 'Conversation turn ID to group related messages' })
  @IsString()
  @IsOptional()
  conversationId?: string;
}

export class CreateChatSessionDto {
  @ApiPropertyOptional({ example: 'Math homework help', description: 'Chat session topic or title' })
  @IsString()
  @IsOptional()
  topic?: string;

  @ApiPropertyOptional({
    example: [
      {
        role: 'user',
        content: 'Can you help me solve 2x + 3 = 7?',
        createdAt: '2025-09-16T10:30:00.000Z'
      },
      {
        role: 'assistant',
        content: 'The solution is x = 2. Let me explain step by step...',
        createdAt: '2025-09-16T10:30:05.000Z'
      }
    ],
    description: 'Array of chat messages',
    type: [ChatMessageDto]
  })
  @IsArray()
  @IsOptional()
  messages?: ChatMessageDto[];
}

export class UpdateChatSessionDto {
  @ApiPropertyOptional({
    example: [
      {
        role: 'user',
        content: 'Updated user message',
        createdAt: '2025-09-16T10:30:00.000Z'
      }
    ],
    description: 'Updated array of chat messages',
    type: [ChatMessageDto]
  })
  @IsArray()
  @IsOptional()
  messages?: ChatMessageDto[];

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
