import {
  Controller,
  Post,
  Body,
  UseGuards,
  BadRequestException,
  Res,
  Header,
  Req,
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
    description: 'Generate a complete AI response using Groq API (primary) with Gemini fallback'
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

  @Post('test-token')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({
    summary: 'Test JWT token validation',
    description: 'Test if the JWT token in Authorization header is valid'
  })
  @ApiResponse({ status: 200, description: 'Token is valid' })
  @ApiResponse({ status: 401, description: 'Token is invalid or expired' })
  async testToken(@Req() req) {
    return {
      message: 'Token is valid',
      user: req.user,
      timestamp: new Date().toISOString()
    };
  }
}
