import {
  Controller,
  Post,
  Body,
  UseGuards,
  BadRequestException,
  Res,
  Header,
} from '@nestjs/common';
import { Response as ExpressResponse } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { AiService } from './ai.service';
import { GenerateRequestDto, StreamRequestDto, GenerateResponseDto } from './dto/ai.dto';

@ApiTags('ai')
@Controller('ai')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth('JWT-auth')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('generate')
  @ApiOperation({
    summary: 'Generate AI response',
    description: 'Generate a complete AI response using Gemini API'
  })
  @ApiResponse({
    status: 200,
    description: 'AI response generated successfully',
    type: GenerateResponseDto
  })
  @ApiResponse({ status: 400, description: 'Invalid request or AI service error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async generate(@Body() dto: GenerateRequestDto): Promise<GenerateResponseDto> {
    try {
      return await this.aiService.generateContent(dto);
    } catch (error) {
      throw new BadRequestException(error.message || 'Failed to generate AI response');
    }
  }

  @Post('stream')
  @ApiOperation({
    summary: 'Stream AI response',
    description: 'Stream AI response in real-time using Server-Sent Events'
  })
  @ApiResponse({ status: 200, description: 'AI streaming started' })
  @ApiResponse({ status: 400, description: 'Invalid request or AI service error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Header('Content-Type', 'text/event-stream')
  @Header('Cache-Control', 'no-cache')
  @Header('Connection', 'keep-alive')
  async stream(@Body() dto: StreamRequestDto, @Res() res: ExpressResponse): Promise<void> {
    try {
      (res as any).write('data: [START]\n\n');

      for await (const chunk of this.aiService.streamContent(dto)) {
        (res as any).write(`data: ${JSON.stringify({ chunk })}\n\n`);
      }

      (res as any).write('data: [END]\n\n');
      (res as any).end();
    } catch (error) {
      (res as any).write(`data: ${JSON.stringify({ error: error.message || 'Streaming failed' })}\n\n`);
      (res as any).end();
    }
  }

  @Post('test-generate')
  @UseGuards() // Remove auth for testing
  @ApiOperation({
    summary: 'Test AI generation (no auth)',
    description: 'Test AI content generation without authentication for debugging'
  })
  @ApiResponse({ status: 200, description: 'Test response generated' })
  async testGenerate(@Body() dto: GenerateRequestDto) {
    try {
      return await this.aiService.generateContent(dto);
    } catch (error) {
      return {
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  @Post('test-key')
  @ApiOperation({
    summary: 'Test AI API Key',
    description: 'Test if the Gemini API key is properly configured'
  })
  @ApiResponse({ status: 200, description: 'API key is valid' })
  @ApiResponse({ status: 400, description: 'API key is invalid or not configured' })
  async testApiKey() {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      throw new BadRequestException('GEMINI_API_KEY environment variable is not set');
    }

    if (apiKey === 'your-gemini-api-key-here') {
      throw new BadRequestException('GEMINI_API_KEY is still set to placeholder value. Please set a valid API key from Google AI Studio.');
    }

    try {
      // Make a simple test request to verify the key works
      const testRequest = {
        contents: [{
          parts: [{
            text: 'Hello'
          }]
        }],
        generationConfig: {
          maxOutputTokens: 10,
        }
      };

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testRequest),
      });

      if (!response.ok) {
        if (response.status === 400) {
          throw new BadRequestException('Invalid API key or request format');
        } else if (response.status === 401) {
          throw new BadRequestException('API key is unauthorized - please check your Google AI Studio key');
        } else if (response.status === 403) {
          throw new BadRequestException('API key does not have permission to access Gemini API');
        } else {
          throw new BadRequestException(`API key test failed with status: ${response.status}`);
        }
      }

      return {
        status: 'success',
        message: 'Gemini API key is valid and working',
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to test API key');
    }
  }
}
