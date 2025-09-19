import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
    });
  }

  async onModuleInit() {
    try {
      await this.prisma.$connect();
      console.log('✅ Database connected successfully');
    } catch (error) {
      console.error('❌ Database connection failed:', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    await this.prisma.$disconnect();
  }

  // Delegate all PrismaClient methods to the internal instance
  get user() {
    return this.prisma.user;
  }

  get chatSession() {
    return this.prisma.chatSession;
  }

  get learningPlan() {
    return this.prisma.learningPlan;
  }

  get learningPlanMilestone() {
    return this.prisma.learningPlanMilestone;
  }

  get course() {
    return this.prisma.course;
  }

  get $transaction() {
    return this.prisma.$transaction;
  }

  get $connect() {
    return this.prisma.$connect;
  }

  get $disconnect() {
    return this.prisma.$disconnect;
  }
}
