import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateChatSessionDto, UpdateChatSessionDto, ChatSessionsQueryDto, PaginatedChatSessionsDto } from './dto/chat-session.dto';

@Injectable()
export class ChatService {
  constructor(private prisma: PrismaService) {}

  async createChatSession(userId: string, dto: CreateChatSessionDto) {
    try {
      return await this.prisma.chatSession.create({
        data: {
          userId,
          topic: dto.topic,
          userMessage: dto.userMessage,
          aiResponse: dto.aiResponse,
        },
        select: {
          id: true,
          topic: true,
          userMessage: true,
          aiResponse: true,
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
            userMessage: true,
            aiResponse: true,
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
          userMessage: true,
          aiResponse: true,
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
          topic: dto.topic,
          userMessage: dto.userMessage,
          aiResponse: dto.aiResponse,
        },
        select: {
          id: true,
          topic: true,
          userMessage: true,
          aiResponse: true,
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
}
