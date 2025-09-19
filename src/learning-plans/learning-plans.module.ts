import { Module } from '@nestjs/common';
import { LearningPlansService } from './learning-plans.service';
import { LearningPlansController } from './learning-plans.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [PrismaModule, AiModule],
  controllers: [LearningPlansController],
  providers: [LearningPlansService],
  exports: [LearningPlansService],
})
export class LearningPlansModule {}