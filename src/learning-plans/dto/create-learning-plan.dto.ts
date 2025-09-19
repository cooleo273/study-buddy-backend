import { IsString, IsOptional, IsArray, IsNumber, IsBoolean, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateMilestoneDto {
  @ApiProperty({ description: 'Milestone title' })
  @IsString()
  title: string;

  @ApiPropertyOptional({ description: 'Milestone description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Subject ID for this milestone' })
  @IsString()
  subjectId: string;

  @ApiProperty({ description: 'Order index of the milestone' })
  @IsNumber()
  @Min(0)
  orderIndex: number;
}

export class CreateLearningPlanDto {
  @ApiProperty({ description: 'Learning plan title' })
  @IsString()
  title: string;

  @ApiPropertyOptional({ description: 'Learning plan description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Array of subject IDs', type: [String] })
  @IsArray()
  @IsString({ each: true })
  subjects: string[];

  @ApiProperty({ description: 'Learning plan milestones', type: [CreateMilestoneDto] })
  @IsArray()
  milestones: CreateMilestoneDto[];
}

export class UpdateMilestoneDto {
  @ApiPropertyOptional({ description: 'Milestone title' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ description: 'Milestone description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Subject ID for this milestone' })
  @IsOptional()
  @IsString()
  subjectId?: string;

  @ApiPropertyOptional({ description: 'Mark milestone as completed' })
  @IsOptional()
  @IsBoolean()
  isCompleted?: boolean;

  @ApiPropertyOptional({ description: 'Order index of the milestone' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  orderIndex?: number;
}

export class UpdateLearningPlanDto {
  @ApiPropertyOptional({ description: 'Learning plan title' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ description: 'Learning plan description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Array of subject IDs', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  subjects?: string[];

  @ApiPropertyOptional({ description: 'Mark plan as active/inactive' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateCourseDto {
  @ApiProperty({ description: 'Course title' })
  @IsString()
  title: string;

  @ApiPropertyOptional({ description: 'Course description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Course content/material' })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({ description: 'Course duration in minutes' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  duration?: number;

  @ApiPropertyOptional({ description: 'Course difficulty level' })
  @IsOptional()
  @IsString()
  difficulty?: string;

  @ApiProperty({ description: 'Order index of the course' })
  @IsNumber()
  @Min(0)
  orderIndex: number;
}

export class UpdateCourseDto {
  @ApiPropertyOptional({ description: 'Course title' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ description: 'Course description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Course content/material' })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({ description: 'Course duration in minutes' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  duration?: number;

  @ApiPropertyOptional({ description: 'Course difficulty level' })
  @IsOptional()
  @IsString()
  difficulty?: string;

  @ApiPropertyOptional({ description: 'Mark course as completed' })
  @IsOptional()
  @IsBoolean()
  isCompleted?: boolean;

  @ApiPropertyOptional({ description: 'Order index of the course' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  orderIndex?: number;
}

export class GenerateCoursesDto {
  @ApiPropertyOptional({ description: 'Number of courses to generate' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(20)
  count?: number;

  @ApiPropertyOptional({ description: 'Specific topics to cover' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  topics?: string[];

  @ApiPropertyOptional({ description: 'Difficulty level for generated courses' })
  @IsOptional()
  @IsString()
  difficulty?: string;
}