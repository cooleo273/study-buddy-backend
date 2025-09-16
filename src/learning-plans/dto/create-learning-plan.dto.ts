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