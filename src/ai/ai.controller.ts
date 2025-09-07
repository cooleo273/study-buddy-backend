import {
  Controller,
  Post,
  Body,
  UseGuards,
  BadRequestException,
  Res,
  Header,
} from '@nestjs/common';
import { Response } from 'express';
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
  async stream(@Body() dto: StreamRequestDto, @Res() res: Response): Promise<void> {
    try {
      res.write('data: [START]\n\n');

      for await (const chunk of this.aiService.streamContent(dto)) {
        res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
      }

      res.write('data: [END]\n\n');
      res.end();
    } catch (error) {
      res.write(`data: ${JSON.stringify({ error: error.message || 'Streaming failed' })}\n\n`);
      res.end();
    }
  }
}
