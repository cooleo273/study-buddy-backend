import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private prisma: any;

  constructor() {
    this.initializePrisma();
  }

  private initializePrisma() {
    try {
      // Try to require PrismaClient - this works better in build environments
      const { PrismaClient } = require('@prisma/client');
      this.prisma = new PrismaClient({
        log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
      });
    } catch (error) {
      console.error('Failed to initialize Prisma client:', error);
      // Create a mock prisma instance for build time
      this.prisma = {
        $connect: async () => {},
        $disconnect: async () => {},
        user: {},
        chatSession: {},
        learningPlan: {},
        learningPlanMilestone: {},
        course: {},
        $transaction: async () => {},
      };
    }
  }

  async onModuleInit() {
    try {
      if (this.prisma && this.prisma.$connect) {
        await this.prisma.$connect();
        console.log('✅ Database connected successfully');
      }
    } catch (error) {
      console.error('❌ Database connection failed:', error);
      // Don't throw in build environment
      if (process.env.NODE_ENV === 'production') {
        console.warn('Running in build environment, skipping database connection');
      } else {
        throw error;
      }
    }
  }

  async onModuleDestroy() {
    if (this.prisma && this.prisma.$disconnect) {
      await this.prisma.$disconnect();
    }
  }

  // Delegate all PrismaClient methods to the internal instance
  get user() {
    return this.prisma?.user || {};
  }

  get chatSession() {
    return this.prisma?.chatSession || {};
  }

  get learningPlan() {
    return this.prisma?.learningPlan || {};
  }

  get learningPlanMilestone() {
    return this.prisma?.learningPlanMilestone || {};
  }

  get course() {
    return this.prisma?.course || {};
  }

  get $transaction() {
    return this.prisma?.$transaction || (async () => {});
  }

  get $connect() {
    return this.prisma?.$connect || (async () => {});
  }

  get $disconnect() {
    return this.prisma?.$disconnect || (async () => {});
  }
}
