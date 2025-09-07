import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GenerateRequestDto, GenerateResponseDto } from './dto/ai.dto';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly geminiApiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent';

  constructor(private configService: ConfigService) {}

  async generateContent(dto: GenerateRequestDto): Promise<GenerateResponseDto> {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');

    if (!apiKey) {
      this.logger.error('GEMINI_API_KEY not found in environment variables');
      throw new BadRequestException('AI service is not properly configured');
    }

    try {
      const requestBody = {
        contents: [
          {
            parts: [
              {
                text: dto.systemPrompt
                  ? `${dto.systemPrompt}\n\nUser: ${dto.message}`
                  : dto.message
              }
            ]
          }
        ],
        generationConfig: {
          temperature: dto.parameters?.temperature || 0.7,
          maxOutputTokens: dto.parameters?.maxTokens || 1000,
          topP: 0.8,
          topK: 10,
        }
      };

      this.logger.debug(`Making request to Gemini API for message: ${dto.message.substring(0, 50)}...`);

      const response = await fetch(`${this.geminiApiUrl}?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`Gemini API error: ${response.status} - ${errorText}`);
        throw new BadRequestException('Failed to generate AI response');
      }

      const data = await response.json();

      if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
        this.logger.error('Invalid response structure from Gemini API');
        throw new BadRequestException('Invalid AI response format');
      }

      const generatedText = data.candidates[0].content.parts[0].text;
      const tokensUsed = data.usageMetadata?.totalTokenCount || 0;

      return {
        response: generatedText,
        model: 'gemini-pro',
        tokensUsed,
      };

    } catch (error) {
      this.logger.error(`Error calling Gemini API: ${error.message}`, error.stack);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('AI service temporarily unavailable');
    }
  }

  async *streamContent(dto: GenerateRequestDto): AsyncGenerator<string, void, unknown> {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');

    if (!apiKey) {
      this.logger.error('GEMINI_API_KEY not found in environment variables');
      throw new BadRequestException('AI service is not properly configured');
    }

    try {
      const requestBody = {
        contents: [
          {
            parts: [
              {
                text: dto.systemPrompt
                  ? `${dto.systemPrompt}\n\nUser: ${dto.message}`
                  : dto.message
              }
            ]
          }
        ],
        generationConfig: {
          temperature: dto.parameters?.temperature || 0.7,
          maxOutputTokens: dto.parameters?.maxTokens || 2000,
          topP: 0.8,
          topK: 10,
        }
      };

      this.logger.debug(`Starting streaming request to Gemini API`);

      const response = await fetch(`${this.geminiApiUrl}?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`Gemini API streaming error: ${response.status} - ${errorText}`);
        throw new BadRequestException('Failed to start AI streaming');
      }

      const data = await response.json();

      if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
        this.logger.error('Invalid streaming response structure from Gemini API');
        throw new BadRequestException('Invalid AI streaming response');
      }

      const generatedText = data.candidates[0].content.parts[0].text;

      // For now, we'll simulate streaming by chunking the response
      // In a real implementation, you'd use Server-Sent Events or WebSockets
      const words = generatedText.split(' ');
      for (const word of words) {
        yield word + ' ';
        // Add a small delay to simulate streaming
        await new Promise(resolve => setTimeout(resolve, 50));
      }

    } catch (error) {
      this.logger.error(`Error in AI streaming: ${error.message}`, error.stack);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('AI streaming service temporarily unavailable');
    }
  }
}
