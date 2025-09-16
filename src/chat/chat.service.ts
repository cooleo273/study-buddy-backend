import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateChatSessionDto, UpdateChatSessionDto, ChatSessionsQueryDto, PaginatedChatSessionsDto, ChatMessageDto } from './dto/chat-session.dto';
import { Prisma } from '@prisma/client';
import { AiService } from '../ai/ai.service';

@Injectable()
export class ChatService {
  constructor(
    private prisma: PrismaService,
    private aiService: AiService,
  ) {}

  async createChatSession(userId: string, dto: CreateChatSessionDto) {
    try {
      // Use provided messages or initialize with empty array
      const messages = dto.messages || [];

      // Add conversation IDs to messages if they don't have them
      const messagesWithIds: Array<Required<Pick<ChatMessageDto, 'role' | 'content'>> & { createdAt: string; conversationId: string }> = messages.map((msg, index) => ({
        ...msg,
        conversationId: msg.conversationId || `conv_${Date.now()}_${index}`,
        createdAt: msg.createdAt || new Date().toISOString(),
      }));

      // If the last provided message is a user message and there is no assistant message
      // for the same conversationId, proactively generate and append the AI response here.
      if (messagesWithIds.length > 0) {
        const lastMsg = messagesWithIds[messagesWithIds.length - 1];
        if (lastMsg.role === 'user') {
          const hasAssistantForConv = messagesWithIds.some(
            (m) => m.role === 'assistant' && m.conversationId === lastMsg.conversationId,
          );

          if (!hasAssistantForConv) {
            try {
              const aiResponse = await this.aiService.generateContent({
                message: lastMsg.content,
                systemPrompt:
                  'You are a helpful AI tutor. Provide clear, educational responses to help students learn.',
              });

              const aiMessage = {
                role: 'assistant' as const,
                content:
                  aiResponse.response ||
                  'I apologize, but I received an empty response from the AI service.',
                createdAt: new Date().toISOString(),
                conversationId: lastMsg.conversationId!,
              };
              messagesWithIds.push(aiMessage);
            } catch (aiError) {
              // Fallback to a safe mock response to ensure pairing
              const mockResponse = `Thank you for your question about "${lastMsg.content}". As an AI tutor, I'm here to help you learn! This is a mock response while we debug the AI service connection.`;
              const aiMessage = {
                role: 'assistant' as const,
                content: mockResponse,
                createdAt: new Date().toISOString(),
                conversationId: lastMsg.conversationId!,
              };
              messagesWithIds.push(aiMessage);
            }
          }
        }
      }

      return await this.prisma.chatSession.create({
        data: {
          userId,
          topic: dto.topic,
          messages: messagesWithIds as any,
        },
        select: {
          id: true,
          topic: true,
          messages: true,
          createdAt: true,
          updatedAt: true,
          userId: true,
        },
      });
    } catch (error) {
      throw new BadRequestException('Failed to create chat session');
    }
  }

  async getUserChatSessions(userId: string, query: ChatSessionsQueryDto): Promise<PaginatedChatSessionsDto> {
    const { page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    try {
      const [sessions, total] = await Promise.all([
        this.prisma.chatSession.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
          select: {
            id: true,
            topic: true,
            messages: true,
            createdAt: true,
            updatedAt: true,
          },
        }),
        this.prisma.chatSession.count({
          where: { userId },
        }),
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        data: sessions,
        page,
        limit,
        total,
        totalPages,
      };
    } catch (error) {
      throw new BadRequestException('Failed to retrieve chat sessions');
    }
  }

  async getChatSessionById(sessionId: string, userId: string) {
    try {
      const session = await this.prisma.chatSession.findFirst({
        where: {
          id: sessionId,
          userId, // Ensure user can only access their own sessions
        },
        select: {
          id: true,
          topic: true,
          messages: true,
          createdAt: true,
          updatedAt: true,
          userId: true,
        },
      });

      if (!session) {
        throw new NotFoundException('Chat session not found');
      }

      return session;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Failed to retrieve chat session');
    }
  }

  async updateChatSession(sessionId: string, userId: string, dto: UpdateChatSessionDto) {
    // First check if session exists and belongs to user
    await this.getChatSessionById(sessionId, userId);

    try {
      return await this.prisma.chatSession.update({
        where: { id: sessionId },
        data: {
          ...(dto.topic && { topic: dto.topic }),
          ...(dto.messages && { messages: dto.messages.map((msg, index) => ({
            ...msg,
            conversationId: msg.conversationId || `conv_${sessionId}_${Date.now()}_${index}`,
          })) as any }),
        },
        select: {
          id: true,
          topic: true,
          messages: true,
          createdAt: true,
          updatedAt: true,
          userId: true,
        },
      });
    } catch (error) {
      throw new BadRequestException('Failed to update chat session');
    }
  }

  async deleteChatSession(sessionId: string, userId: string) {
    // First check if session exists and belongs to user
    await this.getChatSessionById(sessionId, userId);

    try {
      return await this.prisma.chatSession.delete({
        where: { id: sessionId },
      });
    } catch (error) {
      throw new BadRequestException('Failed to delete chat session');
    }
  }

  // Additional utility methods
  async getChatSessionStats(userId: string) {
    try {
      const [totalSessions, recentSessions] = await Promise.all([
        this.prisma.chatSession.count({ where: { userId } }),
        this.prisma.chatSession.count({
          where: {
            userId,
            createdAt: {
              gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
            },
          },
        }),
      ]);

      return {
        totalSessions,
        recentSessions,
        averagePerMonth: Math.round((recentSessions / 30) * 30), // Rough estimate
      };
    } catch (error) {
      throw new BadRequestException('Failed to retrieve chat session statistics');
    }
  }

  async addMessageToSession(sessionId: string, userId: string, messageData: { content: string; role: 'user' | 'assistant' }) {
    console.log('=== ADD MESSAGE TO SESSION START ===');
    console.log('Session ID:', sessionId);
    console.log('User ID:', userId);
    console.log('Message data:', { role: messageData.role, contentLength: messageData.content.length });

    // First check if session exists and belongs to user
    const session = await this.getChatSessionById(sessionId, userId);
    console.log('Session found:', { id: session.id, topic: session.topic });

    try {
      // Get current messages
      const currentMessages = (session.messages as unknown as ChatMessageDto[]) || [];
      console.log('Current messages count:', currentMessages.length);
      console.log('Current messages preview:', currentMessages.map(m => ({ role: m.role, contentStart: m.content?.substring(0, 30) + '...' })));

      const updatedMessages = [...currentMessages];

      // Generate conversation ID for this turn
      const conversationId = `conv_${sessionId}_${Date.now()}`;
      console.log('Generated conversation ID:', conversationId);

      // Add the user message
      const userMessage: ChatMessageDto = {
        role: messageData.role,
        content: messageData.content,
        createdAt: new Date().toISOString(),
        conversationId,
      };
      updatedMessages.push(userMessage);
      console.log('User message added, total messages now:', updatedMessages.length);

      // If it's a user message, generate AI response
      if (messageData.role === 'user') {
        console.log('About to call AI service...');
        try {
          console.log('Generating AI response for:', messageData.content.substring(0, 100) + '...');
          const aiResponse = await this.aiService.generateContent({
            message: messageData.content,
            systemPrompt: 'You are a helpful AI tutor. Provide clear, educational responses to help students learn.',
          });

          console.log('AI response generated successfully, length:', aiResponse.response?.length);
          console.log('AI response type:', typeof aiResponse.response);
          console.log('AI response preview:', aiResponse.response?.substring(0, 200));

          const aiMessage: ChatMessageDto = {
            role: 'assistant',
            content: aiResponse.response || 'I apologize, but I received an empty response from the AI service.',
            createdAt: new Date().toISOString(),
            conversationId, // Same conversation ID links it to the user message
          };
          updatedMessages.push(aiMessage);
          console.log('AI message added, total messages now:', updatedMessages.length);
          console.log('AI message content length:', aiMessage.content.length);
        } catch (aiError) {
          console.error('AI service failed with error:', aiError.message);
          console.error('Full error object:', aiError);

          // For debugging, let's try a simple mock response first
          console.log('Using mock AI response for debugging...');
          const mockResponse = `Thank you for your question about "${messageData.content}". As an AI tutor, I'm here to help you learn! This is a mock response while we debug the AI service connection.`;

          const aiMessage: ChatMessageDto = {
            role: 'assistant',
            content: mockResponse,
            createdAt: new Date().toISOString(),
            conversationId,
          };
          updatedMessages.push(aiMessage);
          console.log('Added mock AI message, total messages now:', updatedMessages.length);
        }
      } else {
        console.log('Message role is not user, skipping AI generation');
      }

      console.log('Final messages to be saved:', updatedMessages.length);
      console.log('Messages to be saved:', updatedMessages.map(m => ({
        role: m.role,
        contentLength: m.content?.length || 0,
        conversationId: m.conversationId,
        createdAt: m.createdAt
      })));

      console.log('=== ABOUT TO SAVE TO DATABASE ===');
      const result = await this.prisma.chatSession.update({
        where: { id: sessionId },
        data: {
          messages: updatedMessages as any,
          updatedAt: new Date(),
        },
        select: {
          id: true,
          topic: true,
          messages: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      console.log('=== DATABASE SAVE COMPLETED ===');
      console.log('Saved session ID:', result.id);
      const savedMessages = (result.messages as any) || [];
      console.log('Saved messages count:', savedMessages.length);
      console.log('Saved messages preview:', savedMessages.map((m: any) => ({
        role: m.role,
        contentLength: m.content?.length || 0,
        conversationId: m.conversationId
      })));

      console.log('=== ADD MESSAGE TO SESSION END ===');
      return result;
    } catch (error) {
      console.error('=== ERROR IN ADD MESSAGE TO SESSION ===');
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      throw new BadRequestException(`Failed to add message to session: ${error.message}`);
    }
  }

  async getSessionMessages(sessionId: string, userId: string) {
    // First check if session exists and belongs to user
    const session = await this.getChatSessionById(sessionId, userId);

    // Return messages from the messages array
    const messages = (session.messages as unknown as ChatMessageDto[]) || [];

    // Add id to each message for frontend compatibility
    const formattedMessages = messages.map((msg, index) => ({
      id: `${sessionId}-${msg.role}-${index}`,
      role: msg.role,
      content: msg.content,
      createdAt: msg.createdAt ? new Date(msg.createdAt) : session.createdAt,
      conversationId: msg.conversationId,
    }));

    return {
      sessionId,
      messages: formattedMessages,
    };
  }

  async getSessionMessagesGrouped(sessionId: string, userId: string) {
    // First check if session exists and belongs to user
    const session = await this.getChatSessionById(sessionId, userId);

    // Return messages from the messages array
    const messages = (session.messages as unknown as ChatMessageDto[]) || [];

    // Group messages by conversationId
    const conversationMap = new Map<string, ChatMessageDto[]>();

    messages.forEach((msg) => {
      const convId = msg.conversationId || 'ungrouped';
      if (!conversationMap.has(convId)) {
        conversationMap.set(convId, []);
      }
      conversationMap.get(convId)!.push(msg);
    });

    // Convert to array format
    const conversations = Array.from(conversationMap.entries()).map(([conversationId, msgs]) => ({
      conversationId,
      messages: msgs.map((msg, index) => ({
        id: `${sessionId}-${conversationId}-${msg.role}-${index}`,
        role: msg.role,
        content: msg.content,
        createdAt: msg.createdAt ? new Date(msg.createdAt) : session.createdAt,
      })),
    }));

    return {
      sessionId,
      conversations,
    };
  }

  async verifySessionMessages(sessionId: string, userId: string) {
    console.log('=== VERIFY SESSION MESSAGES ===');
    console.log('Session ID:', sessionId);
    console.log('User ID:', userId);

    try {
      // Get the session directly from database
      const session = await this.prisma.chatSession.findFirst({
        where: {
          id: sessionId,
          userId,
        },
        select: {
          id: true,
          topic: true,
          messages: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!session) {
        throw new NotFoundException('Chat session not found');
      }

      const messages = (session.messages as unknown as ChatMessageDto[]) || [];
      console.log('Raw messages from database:', messages.length);
      console.log('Messages details:', messages.map((m, index) => ({
        index,
        role: m.role,
        contentLength: m.content?.length || 0,
        conversationId: m.conversationId,
        createdAt: m.createdAt
      })));

      // Group by conversation
      const conversationMap = new Map<string, ChatMessageDto[]>();
      messages.forEach((msg) => {
        const convId = msg.conversationId || 'ungrouped';
        if (!conversationMap.has(convId)) {
          conversationMap.set(convId, []);
        }
        conversationMap.get(convId)!.push(msg);
      });

      const conversations = Array.from(conversationMap.entries()).map(([conversationId, msgs]) => ({
        conversationId,
        messageCount: msgs.length,
        messages: msgs.map((msg, index) => ({
          index,
          role: msg.role,
          contentPreview: msg.content?.substring(0, 100) + (msg.content?.length > 100 ? '...' : ''),
          createdAt: msg.createdAt
        }))
      }));

      return {
        sessionId: session.id,
        topic: session.topic,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        totalMessages: messages.length,
        conversations: conversations,
        rawMessages: messages // Include raw messages for debugging
      };
    } catch (error) {
      console.error('Error in verifySessionMessages:', error);
      throw new BadRequestException(`Failed to verify session messages: ${error.message}`);
    }
  }

  async getAllUserConversations(userId: string) {
    try {
      // Get all chat sessions for the user
      const sessions = await this.prisma.chatSession.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          topic: true,
          messages: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      // Collect all conversations from all sessions
      const allConversations = [];

      for (const session of sessions) {
        const messages = (session.messages as unknown as ChatMessageDto[]) || [];

        // Group messages by conversationId within this session
        const conversationMap = new Map<string, ChatMessageDto[]>();

        messages.forEach((msg) => {
          const convId = msg.conversationId || 'ungrouped';
          if (!conversationMap.has(convId)) {
            conversationMap.set(convId, []);
          }
          conversationMap.get(convId)!.push(msg);
        });

        // Convert to array format with session info
        const sessionConversations = Array.from(conversationMap.entries()).map(([conversationId, msgs]) => ({
          sessionId: session.id,
          sessionTopic: session.topic,
          conversationId,
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
          messages: msgs.map((msg, index) => ({
            id: `${session.id}-${conversationId}-${msg.role}-${index}`,
            role: msg.role,
            content: msg.content,
            createdAt: msg.createdAt ? new Date(msg.createdAt) : session.createdAt,
          })),
        }));

        allConversations.push(...sessionConversations);
      }

      // Sort all conversations by creation time (most recent first)
      allConversations.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      return {
        totalConversations: allConversations.length,
        conversations: allConversations,
      };
    } catch (error) {
      throw new BadRequestException('Failed to retrieve user conversations');
    }
  }

  async debugUserSessions(userId: string) {
    try {
      const sessions = await this.prisma.chatSession.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          topic: true,
          messages: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      const debugInfo = sessions.map(session => {
        const messages = (session.messages as unknown as ChatMessageDto[]) || [];
        const conversationMap = new Map<string, ChatMessageDto[]>();

        messages.forEach((msg) => {
          const convId = msg.conversationId || 'ungrouped';
          if (!conversationMap.has(convId)) {
            conversationMap.set(convId, []);
          }
          conversationMap.get(convId)!.push(msg);
        });

        return {
          sessionId: session.id,
          topic: session.topic,
          createdAt: session.createdAt,
          totalMessages: messages.length,
          conversations: Array.from(conversationMap.entries()).map(([convId, msgs]) => ({
            conversationId: convId,
            messageCount: msgs.length,
            userMessages: msgs.filter(m => m.role === 'user').length,
            assistantMessages: msgs.filter(m => m.role === 'assistant').length,
            firstMessage: msgs[0]?.content?.substring(0, 50) + '...' || 'No messages',
          })),
        };
      });

      return {
        totalSessions: sessions.length,
        sessions: debugInfo,
      };
    } catch (error) {
      throw new BadRequestException('Failed to retrieve debug information');
    }
  }
}
