import { Module } from '@nestjs/common';
import { LearningPlansService } from './learning-plans.service';
import { LearningPlansController } from './learning-plans.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AiModule } from '../ai/ai.module';
import { YouTubeModule } from '../youtube/youtube.module';
import { GamificationModule } from '../gamification/gamification.module';

@Module({
  imports: [PrismaModule, AiModule, YouTubeModule, GamificationModule],
  controllers: [LearningPlansController],
  providers: [LearningPlansService],
  exports: [LearningPlansService],
})
export class LearningPlansModule {}