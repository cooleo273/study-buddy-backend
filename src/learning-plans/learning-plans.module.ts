import { Module } from '@nestjs/common';
import { LearningPlansService } from './learning-plans.service';
import { LearningPlansController } from './learning-plans.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [LearningPlansController],
  providers: [LearningPlansService],
  exports: [LearningPlansService],
})
export class LearningPlansModule {}