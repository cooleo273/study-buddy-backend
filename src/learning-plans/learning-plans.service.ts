import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLearningPlanDto, UpdateLearningPlanDto, CreateMilestoneDto, UpdateMilestoneDto } from './dto/create-learning-plan.dto';
import { LearningPlanResponseDto, LearningPlanSummaryDto, MilestoneResponseDto } from './dto/learning-plan-response.dto';

@Injectable()
export class LearningPlansService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateLearningPlanDto): Promise<LearningPlanResponseDto> {
    const learningPlan = await this.prisma.learningPlan.create({
      data: {
        userId,
        title: dto.title,
        description: dto.description,
        subjects: dto.subjects,
        milestones: {
          create: dto.milestones.map(milestone => ({
            title: milestone.title,
            description: milestone.description,
            subjectId: milestone.subjectId,
            orderIndex: milestone.orderIndex,
          })),
        },
      },
      include: {
        milestones: {
          orderBy: { orderIndex: 'asc' },
        },
      },
    });

    return this.mapToResponseDto(learningPlan);
  }

  async findAll(userId: string): Promise<LearningPlanSummaryDto[]> {
    const plans = await this.prisma.learningPlan.findMany({
      where: { userId },
      include: {
        milestones: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return plans.map(plan => ({
      id: plan.id,
      title: plan.title,
      description: plan.description,
      progress: this.calculateProgress(plan.milestones),
      isActive: plan.isActive,
      totalMilestones: plan.milestones.length,
      completedMilestones: plan.milestones.filter(m => m.isCompleted).length,
      createdAt: plan.createdAt,
    }));
  }

  async findOne(userId: string, planId: string): Promise<LearningPlanResponseDto> {
    const plan = await this.prisma.learningPlan.findFirst({
      where: { id: planId, userId },
      include: {
        milestones: {
          orderBy: { orderIndex: 'asc' },
        },
      },
    });

    if (!plan) {
      throw new NotFoundException('Learning plan not found');
    }

    return this.mapToResponseDto(plan);
  }

  async update(userId: string, planId: string, dto: UpdateLearningPlanDto): Promise<LearningPlanResponseDto> {
    // Check if plan exists and belongs to user
    await this.findOne(userId, planId);

    const updatedPlan = await this.prisma.learningPlan.update({
      where: { id: planId },
      data: {
        ...(dto.title && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.subjects && { subjects: dto.subjects }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        updatedAt: new Date(),
      },
      include: {
        milestones: {
          orderBy: { orderIndex: 'asc' },
        },
      },
    });

    return this.mapToResponseDto(updatedPlan);
  }

  async remove(userId: string, planId: string): Promise<void> {
    // Check if plan exists and belongs to user
    await this.findOne(userId, planId);

    await this.prisma.learningPlan.delete({
      where: { id: planId },
    });
  }

  async updateMilestone(
    userId: string,
    planId: string,
    milestoneId: string,
    dto: UpdateMilestoneDto,
  ): Promise<MilestoneResponseDto> {
    // Check if plan exists and belongs to user
    await this.findOne(userId, planId);

    const updateData: any = {
      ...(dto.title && { title: dto.title }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.subjectId && { subjectId: dto.subjectId }),
      ...(dto.orderIndex !== undefined && { orderIndex: dto.orderIndex }),
    };

    if (dto.isCompleted !== undefined) {
      updateData.isCompleted = dto.isCompleted;
      updateData.completedAt = dto.isCompleted ? new Date() : null;
    }

    const milestone = await this.prisma.learningPlanMilestone.update({
      where: { id: milestoneId },
      data: updateData,
    });

    // Update plan progress after milestone update
    await this.updatePlanProgress(planId);

    return {
      id: milestone.id,
      title: milestone.title,
      description: milestone.description,
      subjectId: milestone.subjectId,
      isCompleted: milestone.isCompleted,
      completedAt: milestone.completedAt,
      orderIndex: milestone.orderIndex,
      createdAt: milestone.createdAt,
    };
  }

  async addMilestone(userId: string, planId: string, dto: CreateMilestoneDto): Promise<MilestoneResponseDto> {
    // Check if plan exists and belongs to user
    await this.findOne(userId, planId);

    const milestone = await this.prisma.learningPlanMilestone.create({
      data: {
        planId,
        title: dto.title,
        description: dto.description,
        subjectId: dto.subjectId,
        orderIndex: dto.orderIndex,
      },
    });

    // Update plan progress
    await this.updatePlanProgress(planId);

    return {
      id: milestone.id,
      title: milestone.title,
      description: milestone.description,
      subjectId: milestone.subjectId,
      isCompleted: milestone.isCompleted,
      completedAt: milestone.completedAt,
      orderIndex: milestone.orderIndex,
      createdAt: milestone.createdAt,
    };
  }

  async removeMilestone(userId: string, planId: string, milestoneId: string): Promise<void> {
    // Check if plan exists and belongs to user
    await this.findOne(userId, planId);

    await this.prisma.learningPlanMilestone.delete({
      where: { id: milestoneId },
    });

    // Update plan progress
    await this.updatePlanProgress(planId);
  }

  private async updatePlanProgress(planId: string): Promise<void> {
    const milestones = await this.prisma.learningPlanMilestone.findMany({
      where: { planId },
    });

    const progress = this.calculateProgress(milestones);

    await this.prisma.learningPlan.update({
      where: { id: planId },
      data: { progress },
    });
  }

  private calculateProgress(milestones: any[]): number {
    if (milestones.length === 0) return 0;

    const completedCount = milestones.filter(m => m.isCompleted).length;
    return Math.round((completedCount / milestones.length) * 100);
  }

  private mapToResponseDto(plan: any): LearningPlanResponseDto {
    return {
      id: plan.id,
      userId: plan.userId,
      title: plan.title,
      description: plan.description,
      subjects: plan.subjects,
      progress: plan.progress,
      isActive: plan.isActive,
      milestones: plan.milestones.map(milestone => ({
        id: milestone.id,
        title: milestone.title,
        description: milestone.description,
        subjectId: milestone.subjectId,
        isCompleted: milestone.isCompleted,
        completedAt: milestone.completedAt,
        orderIndex: milestone.orderIndex,
        createdAt: milestone.createdAt,
      })),
      createdAt: plan.createdAt,
      updatedAt: plan.updatedAt,
    };
  }
}