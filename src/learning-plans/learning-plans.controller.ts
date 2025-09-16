import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { LearningPlansService } from './learning-plans.service';
import { CreateLearningPlanDto, UpdateLearningPlanDto, CreateMilestoneDto, UpdateMilestoneDto } from './dto/create-learning-plan.dto';
import { LearningPlanResponseDto, LearningPlanSummaryDto, MilestoneResponseDto } from './dto/learning-plan-response.dto';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';

@ApiTags('learning-plans')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('learning-plans')
export class LearningPlansController {
  constructor(private readonly learningPlansService: LearningPlansService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new learning plan' })
  @ApiResponse({ status: 201, description: 'Learning plan created successfully', type: LearningPlanResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async create(
    @Request() req,
    @Body() createLearningPlanDto: CreateLearningPlanDto,
  ): Promise<LearningPlanResponseDto> {
    return this.learningPlansService.create(req.user.userId, createLearningPlanDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all learning plans for the authenticated user' })
  @ApiResponse({ status: 200, description: 'Learning plans retrieved successfully', type: [LearningPlanSummaryDto] })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findAll(@Request() req): Promise<LearningPlanSummaryDto[]> {
    return this.learningPlansService.findAll(req.user.userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific learning plan by ID' })
  @ApiResponse({ status: 200, description: 'Learning plan retrieved successfully', type: LearningPlanResponseDto })
  @ApiResponse({ status: 404, description: 'Learning plan not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findOne(
    @Request() req,
    @Param('id') id: string,
  ): Promise<LearningPlanResponseDto> {
    return this.learningPlansService.findOne(req.user.userId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a learning plan' })
  @ApiResponse({ status: 200, description: 'Learning plan updated successfully', type: LearningPlanResponseDto })
  @ApiResponse({ status: 404, description: 'Learning plan not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async update(
    @Request() req,
    @Param('id') id: string,
    @Body() updateLearningPlanDto: UpdateLearningPlanDto,
  ): Promise<LearningPlanResponseDto> {
    return this.learningPlansService.update(req.user.userId, id, updateLearningPlanDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a learning plan' })
  @ApiResponse({ status: 200, description: 'Learning plan deleted successfully' })
  @ApiResponse({ status: 404, description: 'Learning plan not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async remove(@Request() req, @Param('id') id: string): Promise<void> {
    return this.learningPlansService.remove(req.user.userId, id);
  }

  @Post(':planId/milestones')
  @ApiOperation({ summary: 'Add a milestone to a learning plan' })
  @ApiResponse({ status: 201, description: 'Milestone added successfully', type: MilestoneResponseDto })
  @ApiResponse({ status: 404, description: 'Learning plan not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async addMilestone(
    @Request() req,
    @Param('planId') planId: string,
    @Body() createMilestoneDto: CreateMilestoneDto,
  ): Promise<MilestoneResponseDto> {
    return this.learningPlansService.addMilestone(req.user.userId, planId, createMilestoneDto);
  }

  @Patch(':planId/milestones/:milestoneId')
  @ApiOperation({ summary: 'Update a milestone' })
  @ApiResponse({ status: 200, description: 'Milestone updated successfully', type: MilestoneResponseDto })
  @ApiResponse({ status: 404, description: 'Milestone or learning plan not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async updateMilestone(
    @Request() req,
    @Param('planId') planId: string,
    @Param('milestoneId') milestoneId: string,
    @Body() updateMilestoneDto: UpdateMilestoneDto,
  ): Promise<MilestoneResponseDto> {
    return this.learningPlansService.updateMilestone(req.user.userId, planId, milestoneId, updateMilestoneDto);
  }

  @Delete(':planId/milestones/:milestoneId')
  @ApiOperation({ summary: 'Delete a milestone' })
  @ApiResponse({ status: 200, description: 'Milestone deleted successfully' })
  @ApiResponse({ status: 404, description: 'Milestone or learning plan not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async removeMilestone(
    @Request() req,
    @Param('planId') planId: string,
    @Param('milestoneId') milestoneId: string,
  ): Promise<void> {
    return this.learningPlansService.removeMilestone(req.user.userId, planId, milestoneId);
  }
}