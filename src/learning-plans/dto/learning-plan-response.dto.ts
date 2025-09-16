import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MilestoneResponseDto {
  @ApiProperty({ description: 'Milestone ID' })
  id: string;

  @ApiProperty({ description: 'Milestone title' })
  title: string;

  @ApiPropertyOptional({ description: 'Milestone description' })
  description?: string;

  @ApiProperty({ description: 'Subject ID for this milestone' })
  subjectId: string;

  @ApiProperty({ description: 'Whether milestone is completed' })
  isCompleted: boolean;

  @ApiPropertyOptional({ description: 'When milestone was completed' })
  completedAt?: Date;

  @ApiProperty({ description: 'Order index of the milestone' })
  orderIndex: number;

  @ApiProperty({ description: 'When milestone was created' })
  createdAt: Date;
}

export class LearningPlanResponseDto {
  @ApiProperty({ description: 'Learning plan ID' })
  id: string;

  @ApiProperty({ description: 'User ID who owns this plan' })
  userId: string;

  @ApiProperty({ description: 'Learning plan title' })
  title: string;

  @ApiPropertyOptional({ description: 'Learning plan description' })
  description?: string;

  @ApiProperty({ description: 'Array of subject IDs', type: [String] })
  subjects: string[];

  @ApiProperty({ description: 'Progress percentage (0-100)' })
  progress: number;

  @ApiProperty({ description: 'Whether plan is active' })
  isActive: boolean;

  @ApiProperty({ description: 'Learning plan milestones', type: [MilestoneResponseDto] })
  milestones: MilestoneResponseDto[];

  @ApiProperty({ description: 'When plan was created' })
  createdAt: Date;

  @ApiProperty({ description: 'When plan was last updated' })
  updatedAt: Date;
}

export class LearningPlanSummaryDto {
  @ApiProperty({ description: 'Learning plan ID' })
  id: string;

  @ApiProperty({ description: 'Learning plan title' })
  title: string;

  @ApiPropertyOptional({ description: 'Learning plan description' })
  description?: string;

  @ApiProperty({ description: 'Progress percentage (0-100)' })
  progress: number;

  @ApiProperty({ description: 'Whether plan is active' })
  isActive: boolean;

  @ApiProperty({ description: 'Number of milestones' })
  totalMilestones: number;

  @ApiProperty({ description: 'Number of completed milestones' })
  completedMilestones: number;

  @ApiProperty({ description: 'When plan was created' })
  createdAt: Date;
}