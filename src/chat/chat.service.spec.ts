import { Test, TestingModule } from '@nestjs/testing';
import { ChatService } from './chat.service';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('ChatService', () => {
  let service: ChatService;
  let prismaService: PrismaService;
  let aiService: AiService;

  const mockPrismaService = {
    chatSession: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
  };

  const mockAiService = {
    generateContent: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: AiService,
          useValue: mockAiService,
        },
      ],
    }).compile();

    service = module.get<ChatService>(ChatService);
    prismaService = module.get<PrismaService>(PrismaService);
    aiService = module.get<AiService>(AiService);

    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('addMessageToSession', () => {
    it('should add user message and generate AI response', async () => {
      const sessionId = 'test-session-id';
      const userId = 'test-user-id';
      const messageData = {
        content: 'Hello, can you help me?',
        role: 'user' as const,
      };

      const mockSession = {
        id: sessionId,
        userId,
        topic: 'Test Topic',
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockAiResponse = {
        response: 'Hello! I\'d be happy to help you.',
        model: 'test-model',
        tokensUsed: 50,
      };

      mockPrismaService.chatSession.findFirst.mockResolvedValue(mockSession);
      mockAiService.generateContent.mockResolvedValue(mockAiResponse);
      mockPrismaService.chatSession.update.mockResolvedValue({
        ...mockSession,
        messages: [
          {
            role: 'user',
            content: messageData.content,
            createdAt: expect.any(String),
            conversationId: expect.stringContaining('conv_'),
          },
          {
            role: 'assistant',
            content: mockAiResponse.response,
            createdAt: expect.any(String),
            conversationId: expect.stringContaining('conv_'),
          },
        ],
      });

      const result = await service.addMessageToSession(sessionId, userId, messageData);

      expect(mockAiService.generateContent).toHaveBeenCalledWith({
        message: messageData.content,
        systemPrompt: 'You are a helpful AI tutor. Provide clear, educational responses to help students learn.',
      });

      expect(mockPrismaService.chatSession.update).toHaveBeenCalled();
      expect(result.messages).toHaveLength(2);
      expect(result.messages[0].role).toBe('user');
      expect(result.messages[1].role).toBe('assistant');
    });

    it('should add user message and fallback to mock response when AI fails', async () => {
      const sessionId = 'test-session-id';
      const userId = 'test-user-id';
      const messageData = {
        content: 'Hello, can you help me?',
        role: 'user' as const,
      };

      const mockSession = {
        id: sessionId,
        userId,
        topic: 'Test Topic',
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.chatSession.findFirst.mockResolvedValue(mockSession);
      mockAiService.generateContent.mockRejectedValue(new Error('AI service failed'));
      mockPrismaService.chatSession.update.mockResolvedValue({
        ...mockSession,
        messages: [
          {
            role: 'user',
            content: messageData.content,
            createdAt: expect.any(String),
            conversationId: expect.stringContaining('conv_'),
          },
          {
            role: 'assistant',
            content: expect.stringContaining('mock response'),
            createdAt: expect.any(String),
            conversationId: expect.stringContaining('conv_'),
          },
        ],
      });

      const result = await service.addMessageToSession(sessionId, userId, messageData);

      expect(mockAiService.generateContent).toHaveBeenCalled();
      expect(mockPrismaService.chatSession.update).toHaveBeenCalled();
      expect(result.messages).toHaveLength(2);
      expect(result.messages[0].role).toBe('user');
      expect(result.messages[1].role).toBe('assistant');
      expect(result.messages[1].content).toContain('As an AI tutor');
    });

    it('should add assistant message without generating AI response', async () => {
      const sessionId = 'test-session-id';
      const userId = 'test-user-id';
      const messageData = {
        content: 'This is an assistant response',
        role: 'assistant' as const,
      };

      const mockSession = {
        id: sessionId,
        userId,
        topic: 'Test Topic',
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.chatSession.findFirst.mockResolvedValue(mockSession);
      mockPrismaService.chatSession.update.mockResolvedValue({
        ...mockSession,
        messages: [
          {
            role: 'assistant',
            content: messageData.content,
            createdAt: expect.any(String),
            conversationId: expect.stringContaining('conv_'),
          },
        ],
      });

      const result = await service.addMessageToSession(sessionId, userId, messageData);

      expect(mockAiService.generateContent).not.toHaveBeenCalled();
      expect(mockPrismaService.chatSession.update).toHaveBeenCalled();
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].role).toBe('assistant');
    });

    it('should throw NotFoundException for non-existent session', async () => {
      const sessionId = 'non-existent-session';
      const userId = 'test-user-id';
      const messageData = {
        content: 'Hello',
        role: 'user' as const,
      };

      mockPrismaService.chatSession.findFirst.mockResolvedValue(null);

      await expect(
        service.addMessageToSession(sessionId, userId, messageData),
      ).rejects.toThrow(NotFoundException);
    });
  });
});