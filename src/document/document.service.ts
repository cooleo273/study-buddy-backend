import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { UploadDocumentDto, GenerateQuestionDto } from './dto/document.dto';
import * as pdfParse from 'pdf-parse';

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
    console.log('=== SERVICE: UPLOAD START ===');
    console.log('Service received file:', file ? `File: ${file.originalname} (${file.size} bytes)` : 'NO FILE');
    console.log('Service received DTO:', dto);

    if (!file || !file.buffer) {
      console.log('ERROR: No file provided');
      throw new BadRequestException('No file provided');
    }

    // Extract text from PDF
    let textContent: string;
    try {
      console.log('Starting PDF parsing...');
      const data = await pdfParse(file.buffer);
      textContent = data.text;
      console.log(`PDF parsed successfully. Text length: ${textContent.length} characters`);
    } catch (error) {
      console.log('ERROR: Failed to parse PDF:', error);
      throw new BadRequestException('Failed to parse PDF file');
    }

    // Create document record
    console.log('Creating document record in database...');
    const document = await this.prisma.document.create({
      data: {
        title: dto.title,
        content: textContent,
        type: dto.type,
        grade: dto.grade,
        subject: dto.subject,
      },
    });
    console.log('Document created successfully:', { id: document.id, title: document.title });

    // Chunk the text and create embeddings
    console.log('Starting document chunking and embedding...');
    await this.processDocumentChunks(document.id, textContent);

    console.log('=== SERVICE: UPLOAD COMPLETE ===');
    return document;
  }

  private async processDocumentChunks(documentId: string, text: string) {
    console.log('=== CHUNKING START ===');
    const chunks = this.chunkText(text);
    console.log(`Text chunked into ${chunks.length} chunks`);

    console.log('Generating embeddings...');
    const embeddings = await this.generateEmbeddings(chunks);
    console.log(`Generated ${embeddings.length} embeddings`);

    const chunkData = chunks.map((chunk, index) => ({
      documentId,
      content: chunk,
      embedding: embeddings[index],
      chunkIndex: index,
    }));

    console.log('Inserting chunks into database...');
    await this.prisma.documentChunk.createMany({
      data: chunkData,
    });
    console.log('=== CHUNKING COMPLETE ===');
  }

  private chunkText(text: string): string[] {
    // Simple chunking: split by paragraphs, then by sentences if too long
    const paragraphs = text.split('\n\n').filter(p => p.trim().length > 50);

    const chunks: string[] = [];
    for (const paragraph of paragraphs) {
      if (paragraph.length <= 1000) {
        chunks.push(paragraph.trim());
      } else {
        // Split long paragraphs into sentences
        const sentences = paragraph.split(/[.!?]+/).filter(s => s.trim().length > 20);
        let currentChunk = '';
        for (const sentence of sentences) {
          if ((currentChunk + sentence).length > 800) {
            if (currentChunk) chunks.push(currentChunk.trim());
            currentChunk = sentence.trim();
          } else {
            currentChunk += (currentChunk ? ' ' : '') + sentence.trim();
          }
        }
        if (currentChunk) chunks.push(currentChunk.trim());
      }
    }

    return chunks;
  }

  private async generateEmbeddings(texts: string[]): Promise<number[][]> {
    console.log(`=== EMBEDDING GENERATION START: ${texts.length} texts ===`);
    // Use Gemini for embeddings
    const embeddings: number[][] = [];

    for (let i = 0; i < texts.length; i++) {
      const text = texts[i];
      try {
        console.log(`Generating embedding ${i + 1}/${texts.length}...`);
        const embedding = await this.aiService.generateEmbedding(text);
        embeddings.push(embedding);
        console.log(`Embedding ${i + 1} generated successfully`);
      } catch (error) {
        console.error(`ERROR: Failed to generate embedding ${i + 1}:`, error);
        // Use zero vector as fallback
        embeddings.push(new Array(768).fill(0));
        console.log(`Using fallback zero vector for embedding ${i + 1}`);
      }
    }

    console.log('=== EMBEDDING GENERATION COMPLETE ===');
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
      FROM "DocumentChunk"
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
