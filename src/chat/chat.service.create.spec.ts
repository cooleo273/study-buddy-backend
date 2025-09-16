import { Test, TestingModule } from '@nestjs/testing';
import { ChatService } from './chat.service';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';

describe('ChatService.createChatSession', () => {
  let service: ChatService;

  const mockPrismaService = {
    chatSession: {
      create: jest.fn(),
    },
  } as any;

  const mockAiService = {
    generateContent: jest.fn(),
  } as any;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AiService, useValue: mockAiService },
      ],
    }).compile();

    service = module.get<ChatService>(ChatService);
  });

  it('appends an assistant reply when last message is user', async () => {
    const userId = 'u1';
    const dto = {
      topic: 'History',
      messages: [
        { role: 'user' as const, content: 'Who is Napoleon?' },
      ],
    };

    mockAiService.generateContent.mockResolvedValue({
      response: 'Napoleon Bonaparte was a French military leader...',
      model: 'test',
      tokensUsed: 10,
    });

    mockPrismaService.chatSession.create.mockImplementation(async ({ data }) => ({
      id: 's1',
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    const session = await service.createChatSession(userId, dto as any);

    expect(mockAiService.generateContent).toHaveBeenCalledWith({
      message: 'Who is Napoleon?',
      systemPrompt: expect.any(String),
    });

  const msgs = session.messages as any[];
  expect(msgs.length).toBe(2);
  expect(msgs[0].role).toBe('user');
  expect(msgs[1].role).toBe('assistant');
  expect(msgs[1].content).toContain('Napoleon');
  });

  it('does not append assistant if last message is assistant', async () => {
    const userId = 'u1';
    const dto = {
      topic: 'History',
      messages: [
        { role: 'user' as const, content: 'Who is Napoleon?' },
        { role: 'assistant' as const, content: 'Napoleon was ...' },
      ],
    };

    const created = {
      id: 's2',
      userId,
      topic: dto.topic,
      messages: dto.messages,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any;

    mockPrismaService.chatSession.create.mockResolvedValue(created);

    const session = await service.createChatSession(userId, dto as any);
    expect(mockAiService.generateContent).not.toHaveBeenCalled();
  expect((session.messages as any[]).length).toBe(2);
  });
});