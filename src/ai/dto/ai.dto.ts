import { IsNotEmpty, IsString, IsOptional, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GenerateRequestDto {
  @ApiProperty({
    example: 'Explain the concept of quantum physics',
    description: 'The user message to send to the AI'
  })
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiPropertyOptional({
    example: 'You are a helpful physics tutor specializing in quantum mechanics.',
    description: 'System prompt to set the AI behavior'
  })
  @IsString()
  @IsOptional()
  systemPrompt?: string;

  @ApiPropertyOptional({
    example: { temperature: 0.7, maxTokens: 1000 },
    description: 'Additional generation parameters'
  })
  @IsObject()
  @IsOptional()
  parameters?: Record<string, any>;
}

export class StreamRequestDto {
  @ApiProperty({
    example: 'Explain photosynthesis step by step',
    description: 'The user message to send to the AI for streaming'
  })
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiPropertyOptional({
    example: 'You are a biology teacher explaining concepts clearly.',
    description: 'System prompt for the streaming conversation'
  })
  @IsString()
  @IsOptional()
  systemPrompt?: string;
}

export class GenerateResponseDto {
  @ApiProperty({
    example: 'Quantum physics is the study of matter and energy at the smallest scales...',
    description: 'The AI-generated response'
  })
  response: string;

  @ApiProperty({
    example: 'gemini-1.5-flash',
    description: 'The AI model used'
  })
  model: string;

  @ApiProperty({
    example: 150,
    description: 'Number of tokens used'
  })
  tokensUsed: number;
}
