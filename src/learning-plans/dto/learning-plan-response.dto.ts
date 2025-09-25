import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class QuizQuestionResponseDto {
  @ApiProperty({ description: 'Question ID' })
  id: string;

  @ApiProperty({ description: 'Question text' })
  question: string;

  @ApiProperty({ description: 'Question type' })
  type: string;

  @ApiPropertyOptional({ description: 'Multiple choice options' })
  options?: string[];

  @ApiProperty({ description: 'Points for this question' })
  points: number;

  @ApiProperty({ description: 'Order index of the question' })
  orderIndex: number;

  @ApiProperty({ description: 'When question was created' })
  createdAt: Date;
}

export class QuizResponseDto {
  @ApiProperty({ description: 'Quiz ID' })
  id: string;

  @ApiProperty({ description: 'Quiz title' })
  title: string;

  @ApiPropertyOptional({ description: 'Quiz description' })
  description?: string;

  @ApiProperty({ description: 'Minimum passing score percentage' })
  passingScore: number;

  @ApiProperty({ description: 'Whether quiz is required to pass the course' })
  isRequired: boolean;

  @ApiProperty({ description: 'Quiz questions', type: [QuizQuestionResponseDto] })
  questions: QuizQuestionResponseDto[];

  @ApiProperty({ description: 'When quiz was created' })
  createdAt: Date;

  @ApiProperty({ description: 'When quiz was last updated' })
  updatedAt: Date;
}

export class CourseResponseDto {
  @ApiProperty({ description: 'Course ID' })
  id: string;

  @ApiProperty({ description: 'Course title' })
  title: string;

  @ApiPropertyOptional({ description: 'Course description' })
  description?: string;

  @ApiPropertyOptional({ description: 'Course content/material' })
  content?: string;

  @ApiPropertyOptional({ description: 'Course duration in minutes' })
  duration?: number;

  @ApiPropertyOptional({ description: 'Course difficulty level' })
  difficulty?: string;

  @ApiProperty({ description: 'Whether course is completed' })
  isCompleted: boolean;

  @ApiPropertyOptional({ description: 'When course was completed' })
  completedAt?: Date;

  @ApiProperty({ description: 'Order index of the course' })
  orderIndex: number;

  @ApiPropertyOptional({ description: 'Course quiz', type: QuizResponseDto })
  quiz?: QuizResponseDto;

  @ApiPropertyOptional({ description: 'YouTube video suggestion for the course' })
  youtubeVideo?: {
    title: string;
    url: string;
    channelName: string;
    duration: string;
    description: string;
  };

  @ApiProperty({ description: 'When course was created' })
  createdAt: Date;

  @ApiProperty({ description: 'When course was last updated' })
  updatedAt: Date;
}

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

  @ApiProperty({ description: 'Courses for this milestone', type: [CourseResponseDto] })
  courses: CourseResponseDto[];

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