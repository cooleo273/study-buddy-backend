import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GenerateRequestDto, GenerateResponseDto } from './dto/ai.dto';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly geminiModel = 'gemini-1.5-flash';
  private readonly geminiApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${this.geminiModel}:generateContent`;
  private readonly groqApiUrl = 'https://api.groq.com/openai/v1/chat/completions';
  private readonly groqModel = 'openai/gpt-oss-20b';

  constructor(private configService: ConfigService) {}

  async generateContent(dto: GenerateRequestDto): Promise<GenerateResponseDto> {
    console.log('AI Service called with:', { message: dto.message.substring(0, 50), hasSystemPrompt: !!dto.systemPrompt });

    // Try Groq first since Gemini is rate limited
    try {
      console.log('Trying Groq API first...');
      return await this.generateWithGroq(dto);
    } catch (error) {
      console.log(`Groq failed: ${error.message}, trying Gemini...`);
      this.logger.warn(`Groq failed, trying Gemini: ${error.message}`);
      // Fallback to Gemini
      try {
        console.log('Trying Gemini API...');
        return await this.generateWithGemini(dto);
      } catch (geminiError) {
        console.log(`Both APIs failed. Groq: ${error.message}, Gemini: ${geminiError.message}`);
        this.logger.error(`Both Groq and Gemini failed. Groq: ${error.message}, Gemini: ${geminiError.message}`);
        throw new BadRequestException('All AI services are currently unavailable');
      }
    }
  }

  private async generateWithGemini(dto: GenerateRequestDto): Promise<GenerateResponseDto> {
    const apiKey = process.env.GEMINI_API_KEY;
    console.log('Gemini API key exists:', !!apiKey);

    if (!apiKey) {
      throw new BadRequestException('Gemini API key not configured');
    }

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

    console.log('Making Gemini API request...');
    this.logger.debug(`Making request to Gemini API for message: ${dto.message.substring(0, 50)}...`);

    // Add timeout to prevent hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    const response = await fetch(`${this.geminiApiUrl}?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    console.log('Gemini API response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.log('Gemini API error response:', errorText);
      this.logger.error(`Gemini API error: ${response.status} - ${errorText}`);

      if (response.status === 400) {
        throw new BadRequestException(`Invalid request to Gemini: ${errorText}`);
      } else if (response.status === 401) {
        throw new BadRequestException('Invalid Gemini API key');
      } else if (response.status === 403) {
        throw new BadRequestException('Gemini API key does not have permission');
      } else if (response.status === 429) {
        throw new BadRequestException('Gemini rate limit exceeded');
      } else {
        throw new BadRequestException(`Gemini service error: ${response.status}`);
      }
    }

    const data = await response.json();
    console.log('Gemini API response data:', { hasCandidates: !!data.candidates, candidateCount: data.candidates?.length });

    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
      console.log('Invalid Gemini response structure:', data);
      this.logger.error('Invalid response structure from Gemini API');
      throw new BadRequestException('Invalid Gemini response format');
    }

    const generatedText = data.candidates[0].content.parts[0].text;
    console.log('Generated text from Gemini (raw):', generatedText);
    console.log('Generated text type:', typeof generatedText);
    console.log('Is array?', Array.isArray(generatedText));
    console.log('Generated text length:', generatedText?.length);
    
    // Handle case where AI returns an array instead of string
    let processedText = generatedText;
    if (Array.isArray(generatedText)) {
      console.log('Processing as array with length:', generatedText.length);
      // Convert array to a readable string
      processedText = generatedText.map(item => 
        typeof item === 'string' ? item : JSON.stringify(item)
      ).join('\n\n');
      console.log('Converted array response to string, length:', processedText.length);
      console.log('Converted response preview:', processedText.substring(0, 200));
    } else if (typeof generatedText === 'string' && generatedText.startsWith('[') && generatedText.endsWith(']')) {
      // Handle case where API returns stringified array
      try {
        const parsedArray = JSON.parse(generatedText);
        if (Array.isArray(parsedArray)) {
          console.log('Processing as stringified array with length:', parsedArray.length);
          processedText = parsedArray.map(item => 
            typeof item === 'string' ? item : JSON.stringify(item)
          ).join('\n\n');
          console.log('Converted stringified array response to string, length:', processedText.length);
          console.log('Converted response preview:', processedText.substring(0, 200));
        }
      } catch (e) {
        console.log('Failed to parse as JSON array, treating as regular string');
      }
    } else if (typeof generatedText !== 'string') {
      // Handle other non-string types
      processedText = String(generatedText);
      console.log('Converted non-string response to string, length:', processedText.length);
    } else {
      console.log('Processing as regular string, length:', processedText.length);
    }
    
    console.log('Final processed response preview:', processedText?.substring(0, 200));
    
    const tokensUsed = data.usageMetadata?.totalTokenCount || 0;

    return {
      response: processedText,
      model: this.geminiModel,
      tokensUsed,
    };
  }

  private async generateWithGroq(dto: GenerateRequestDto): Promise<GenerateResponseDto> {
    const apiKey = process.env.GROQ_API_KEY;
    console.log('Groq API key exists:', !!apiKey);

    if (!apiKey) {
      throw new BadRequestException('Groq API key not configured');
    }

    const messages = [];
    if (dto.systemPrompt) {
      messages.push({ role: 'system', content: dto.systemPrompt });
    }
    messages.push({ role: 'user', content: dto.message });

    const requestBody = {
      model: this.groqModel,
      messages,
      temperature: dto.parameters?.temperature || 0.7,
      max_tokens: dto.parameters?.maxTokens || 1000,
      top_p: 0.8,
    };

    console.log('Making Groq API request...');
    this.logger.debug(`Making request to Groq API for message: ${dto.message.substring(0, 50)}...`);

    // Add timeout to prevent hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    const response = await fetch(this.groqApiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    console.log('Groq API response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.log('Groq API error response:', errorText);
      this.logger.error(`Groq API error: ${response.status} - ${errorText}`);

      if (response.status === 400) {
        throw new BadRequestException(`Invalid request to Groq: ${errorText}`);
      } else if (response.status === 401) {
        throw new BadRequestException('Invalid Groq API key');
      } else if (response.status === 403) {
        throw new BadRequestException('Groq API key does not have permission');
      } else if (response.status === 429) {
        throw new BadRequestException('Groq rate limit exceeded');
      } else {
        throw new BadRequestException(`Groq service error: ${response.status}`);
      }
    }

    const data = await response.json();
    console.log('Groq API response data:', { hasChoices: !!data.choices, choiceCount: data.choices?.length });

    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      console.log('Invalid Groq response structure:', data);
      this.logger.error('Invalid response structure from Groq API');
      throw new BadRequestException('Invalid Groq response format');
    }

    const generatedText = data.choices[0].message.content;
    console.log('Generated text from Groq (raw):', generatedText);
    console.log('Generated text type:', typeof generatedText);
    console.log('Is array?', Array.isArray(generatedText));
    console.log('Generated text from Groq (truncated):', generatedText?.substring(0, 100));
    
    // Handle case where AI returns an array instead of string
    let processedText = generatedText;
    if (Array.isArray(generatedText)) {
      console.log('Processing as array with length:', generatedText.length);
      // Convert array to a readable string
      processedText = generatedText.map(item => 
        typeof item === 'string' ? item : JSON.stringify(item)
      ).join('\n\n');
      console.log('Converted array response to string, length:', processedText.length);
      console.log('Converted response preview:', processedText.substring(0, 200));
    } else if (typeof generatedText === 'string' && generatedText.startsWith('[') && generatedText.endsWith(']')) {
      // Handle case where API returns stringified array
      try {
        const parsedArray = JSON.parse(generatedText);
        if (Array.isArray(parsedArray)) {
          console.log('Processing as stringified array with length:', parsedArray.length);
          processedText = parsedArray.map(item => 
            typeof item === 'string' ? item : JSON.stringify(item)
          ).join('\n\n');
          console.log('Converted stringified array response to string, length:', processedText.length);
          console.log('Converted response preview:', processedText.substring(0, 200));
        }
      } catch (e) {
        console.log('Failed to parse as JSON array, treating as regular string');
      }
    } else if (typeof generatedText !== 'string') {
      // Handle other non-string types
      processedText = String(generatedText);
      console.log('Converted non-string response to string, length:', processedText.length);
    } else {
      console.log('Processing as regular string, length:', processedText.length);
    }
    
    console.log('Final processed response preview:', processedText?.substring(0, 200));
    
    const tokensUsed = data.usage?.total_tokens || 0;

    return {
      response: processedText,
      model: this.groqModel,
      tokensUsed,
    };
  }

  async *streamContent(dto: GenerateRequestDto): AsyncGenerator<string, void, unknown> {
    // Try Gemini first for streaming
    try {
      yield* this.streamWithGemini(dto);
    } catch (error) {
      this.logger.warn(`Gemini streaming failed, trying Groq: ${error.message}`);
      // Fallback to Groq
      try {
        yield* this.streamWithGroq(dto);
      } catch (groqError) {
        this.logger.error(`Both Gemini and Groq streaming failed. Gemini: ${error.message}, Groq: ${groqError.message}`);
        throw new BadRequestException('All AI streaming services are currently unavailable');
      }
    }
  }

  private async *streamWithGemini(dto: GenerateRequestDto): AsyncGenerator<string, void, unknown> {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      throw new BadRequestException('Gemini API key not configured');
    }

    const requestBody = {
      contents: [
        {
          parts: [
            {
              text: dto.systemPrompt
                ? `${dto.systemPrompt}\n\nUser: ${dto.systemPrompt}\n\nUser: ${dto.message}`
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
      throw new BadRequestException(`Failed to start Gemini streaming: ${response.status}`);
    }

    const data = await response.json();

    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
      this.logger.error('Invalid streaming response structure from Gemini API');
      throw new BadRequestException('Invalid Gemini streaming response');
    }

    const generatedText = data.candidates[0].content.parts[0].text;

    // Simulate streaming by chunking the response into sentences/words
    const chunks = this.chunkText(generatedText);
    for (const chunk of chunks) {
      yield chunk;
      // Add a small delay to simulate streaming
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  private async *streamWithGroq(dto: GenerateRequestDto): AsyncGenerator<string, void, unknown> {
    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      throw new BadRequestException('Groq API key not configured');
    }

    const messages = [];
    if (dto.systemPrompt) {
      messages.push({ role: 'system', content: dto.systemPrompt });
    }
    messages.push({ role: 'user', content: dto.message });

    const requestBody = {
      model: this.groqModel,
      messages,
      temperature: dto.parameters?.temperature || 0.7,
      max_tokens: dto.parameters?.maxTokens || 2000,
      stream: true,
    };

    this.logger.debug(`Starting streaming request to Groq API`);

    const response = await fetch(this.groqApiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error(`Groq API streaming error: ${response.status} - ${errorText}`);
      throw new BadRequestException(`Failed to start Groq streaming: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new BadRequestException('Failed to get response reader for streaming');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                yield content;
              }
            } catch (e) {
              // Skip invalid JSON
              continue;
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
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
