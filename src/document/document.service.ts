import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { UploadDocumentDto, GenerateQuestionDto } from './dto/document.dto';
import pdfParse from 'pdf-parse';

@Injectable()
export class DocumentService {
  constructor(
    private prisma: PrismaService,
    private aiService: AiService,
  ) {}

  async uploadDocument(
    file: Express.Multer.File,
    dto: UploadDocumentDto,
  ) {
    if (!file || !file.buffer) {
      throw new BadRequestException('No file provided');
    }

    // Extract text from PDF
    let textContent: string;
    try {
      const data = await pdfParse(file.buffer);
      textContent = data.text;
    } catch (error) {
      throw new BadRequestException('Failed to parse PDF file');
    }

    // Create document record
    const document = await this.prisma.document.create({
      data: {
        title: dto.title,
        content: textContent,
        type: dto.type,
        grade: dto.grade,
        subject: dto.subject,
      },
    });

    // Chunk the text and create embeddings
    await this.processDocumentChunks(document.id, textContent);

    return document;
  }

  private async processDocumentChunks(documentId: string, text: string) {
    const chunks = this.chunkText(text);
    console.log(`Processing ${chunks.length} chunks for document ${documentId}`);
    const embeddings = await this.generateEmbeddings(chunks);

    // Use raw SQL to insert chunks with vector embeddings
    for (let i = 0; i < chunks.length; i++) {
      const embeddingString = `[${embeddings[i].join(',')}]`;
      await this.prisma.$executeRaw`
        INSERT INTO "document_chunks" ("id", "documentId", "content", "embedding", "chunkIndex")
        VALUES (gen_random_uuid(), ${documentId}, ${chunks[i]}, ${embeddingString}::vector(768), ${i})
      `;
      if ((i + 1) % 10 === 0) {
        console.log(`Created ${i + 1}/${chunks.length} chunks`);
      }
    }
    console.log(`Finished processing chunks for document ${documentId}`);
  }

  private chunkText(text: string): string[] {
    // Simple chunking: split by paragraphs, then combine into larger chunks
    const paragraphs = text.split('\n\n').filter(p => p.trim().length > 50);

    const chunks: string[] = [];
    let currentChunk = '';

    for (const paragraph of paragraphs) {
      // If adding this paragraph would exceed 2500 characters, save current chunk
      if (currentChunk && (currentChunk + '\n\n' + paragraph).length > 2500) {
        chunks.push(currentChunk.trim());
        currentChunk = paragraph;
      } else {
        // Add paragraph to current chunk
        currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
      }
    }

    // Add the last chunk
    if (currentChunk) {
      chunks.push(currentChunk.trim());
    }

    // Limit to maximum 100 chunks to avoid timeout
    if (chunks.length > 100) {
      console.log(`Limiting chunks from ${chunks.length} to 100`);
      const limitedChunks: string[] = [];
      const chunkSize = Math.ceil(chunks.length / 100);

      for (let i = 0; i < chunks.length; i += chunkSize) {
        const combinedChunk = chunks.slice(i, i + chunkSize).join('\n\n');
        limitedChunks.push(combinedChunk);
      }

      return limitedChunks.slice(0, 100);
    }

    return chunks;
  }

  private async generateEmbeddings(texts: string[]): Promise<number[][]> {
    // Use Gemini for embeddings
    const embeddings: number[][] = [];

    for (const text of texts) {
      try {
        const embedding = await this.aiService.generateEmbedding(text);
        embeddings.push(embedding);
      } catch (error) {
        console.error('Failed to generate embedding:', error);
        // Use zero vector as fallback
        embeddings.push(new Array(768).fill(0));
      }
    }

    return embeddings;
  }

  async generateQuestion(userId: string, dto: GenerateQuestionDto) {
    // Find relevant document chunks
    const queryEmbedding = await this.aiService.generateEmbedding(
      `Generate a matric-style question for grade ${dto.grade} ${dto.subject} about ${dto.topic || 'general knowledge'}`
    );

    const relevantChunks = await this.prisma.$queryRaw<
      { id: string; content: string; similarity: number }[]
    >`
      SELECT id, content, 1 - (embedding <=> ${queryEmbedding}::vector) as similarity
      FROM "document_chunks"
      WHERE 1 - (embedding <=> ${queryEmbedding}::vector) > 0.7
      ORDER BY embedding <=> ${queryEmbedding}::vector
      LIMIT 5
    `;

    if (relevantChunks.length === 0) {
      throw new BadRequestException('No relevant content found for the requested topic');
    }

    // Combine relevant content
    const context = relevantChunks.map(chunk => chunk.content).join('\n\n');

    // Generate question using AI
    const prompt = `Based on the following Ethiopian curriculum content for grade ${dto.grade} ${dto.subject}:

${context}

Generate a multiple choice question suitable for matric examination. The question should be challenging and test deep understanding. Provide:
- Question: [the question text]
- Options: A) [option1], B) [option2], C) [option3], D) [option4]
- Correct Answer: [the letter of the correct answer]
- Explanation: [brief explanation of why the answer is correct]

Format your response exactly like this example:
Question: What is the capital of France?
Options: A) London, B) Paris, C) Berlin, D) Rome
Correct Answer: B
Explanation: Paris is the capital and most populous city of France.`;

    const response = await this.aiService.generateContent({
      message: prompt,
      systemPrompt: 'You are an expert educator creating high-quality multiple choice examination questions. Always follow the exact format specified.',
    });

    // Parse the response
    const lines = response.response.split('\n').map(line => line.trim()).filter(line => line);
    
    let question = '';
    let options: string[] = [];
    let correctAnswer = '';
    let explanation = '';

    for (const line of lines) {
      if (line.startsWith('Question:')) {
        question = line.replace('Question:', '').trim();
      } else if (line.startsWith('Options:')) {
        const optionsText = line.replace('Options:', '').trim();
        options = optionsText.split(',').map(opt => opt.trim());
      } else if (line.startsWith('Correct Answer:')) {
        correctAnswer = line.replace('Correct Answer:', '').trim();
      } else if (line.startsWith('Explanation:')) {
        explanation = line.replace('Explanation:', '').trim();
      }
    }

    // Validate the response
    if (!question || options.length !== 4 || !correctAnswer || !explanation) {
      throw new BadRequestException('Failed to generate a valid multiple choice question');
    }

    // Save the generated question
    const generatedQuestion = await this.prisma.generatedQuestion.create({
      data: {
        userId,
        question,
        answer: `${correctAnswer}) ${options.find(opt => opt.startsWith(correctAnswer + ')'))?.substring(3) || 'Answer not found'}`, // Legacy field
        options,
        correctAnswer,
        explanation,
        subject: dto.subject,
        grade: dto.grade,
      },
    });

    return {
      ...generatedQuestion,
      options,
      correctAnswer,
      explanation,
    };
  }

  async getUserQuestions(userId: string) {
    const questions = await this.prisma.generatedQuestion.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return questions.map(q => ({
      id: q.id,
      question: q.question,
      options: q.options as string[] || [],
      correctAnswer: q.correctAnswer || '',
      explanation: q.explanation || '',
      subject: q.subject,
      grade: q.grade,
      createdAt: q.createdAt,
    }));
  }

  async getDocuments() {
    return this.prisma.document.findMany({
      orderBy: { uploadedAt: 'desc' },
      include: {
        _count: {
          select: { chunks: true }
        }
      }
    });
  }
}
