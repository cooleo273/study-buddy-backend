import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GenerateRequestDto, GenerateResponseDto } from './dto/ai.dto';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly geminiModel = 'gemini-1.5-flash';
  private readonly geminiApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${this.geminiModel}:generateContent`;

  constructor(private configService: ConfigService) {}

  async generateContent(dto: GenerateRequestDto): Promise<GenerateResponseDto> {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      this.logger.error('GEMINI_API_KEY not found in environment variables');
      throw new BadRequestException('AI service is not properly configured');
    }

    // // Check if API key is the placeholder
    // if (apiKey === 'your-gemini-api-key-here') {
    //   this.logger.error('GEMINI_API_KEY is still set to placeholder value');
    //   throw new BadRequestException('AI service API key not configured. Please set a valid GEMINI_API_KEY in your environment variables.');
    // }

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

        if (response.status === 400) {
          throw new BadRequestException(`Invalid request to AI service: ${errorText}`);
        } else if (response.status === 401) {
          throw new BadRequestException('Invalid AI API key');
        } else if (response.status === 403) {
          throw new BadRequestException('AI API key does not have permission');
        } else if (response.status === 429) {
          throw new BadRequestException('AI service rate limit exceeded');
        } else {
          throw new BadRequestException(`AI service error: ${response.status}`);
        }
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
        model: this.geminiModel,
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

    // Check if API key is the placeholder
    if (apiKey === 'your-gemini-api-key-here') {
      this.logger.error('GEMINI_API_KEY is still set to placeholder value');
      throw new BadRequestException('AI service API key not configured');
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
        throw new BadRequestException(`Failed to start AI streaming: ${response.status}`);
      }

      const data = await response.json();

      if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
        this.logger.error('Invalid streaming response structure from Gemini API');
        throw new BadRequestException('Invalid AI streaming response');
      }

      const generatedText = data.candidates[0].content.parts[0].text;

      // Simulate streaming by chunking the response into sentences/words
      const chunks = this.chunkText(generatedText);
      for (const chunk of chunks) {
        yield chunk;
        // Add a small delay to simulate streaming
        await new Promise(resolve => setTimeout(resolve, 100));
      }

    } catch (error) {
      this.logger.error(`Error in AI streaming: ${error.message}`, error.stack);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('AI streaming service temporarily unavailable');
    }
  }

  private chunkText(text: string): string[] {
    // Split by sentences first
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);

    const chunks: string[] = [];
    for (const sentence of sentences) {
      const words = sentence.trim().split(' ');
      let currentChunk = '';

      for (const word of words) {
        if ((currentChunk + ' ' + word).length > 50) { // Chunk size limit
          if (currentChunk) {
            chunks.push(currentChunk + ' ');
            currentChunk = word;
          } else {
            chunks.push(word + ' ');
          }
        } else {
          currentChunk += (currentChunk ? ' ' : '') + word;
        }
      }

      if (currentChunk) {
        chunks.push(currentChunk + ' ');
      }
    }

    return chunks;
  }
}
