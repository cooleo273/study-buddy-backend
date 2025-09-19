import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { BadRequestException } from '@nestjs/common';
import { LearningPlansService } from './learning-plans.service';
import { CreateLearningPlanDto, UpdateLearningPlanDto, CreateMilestoneDto, UpdateMilestoneDto, CreateCourseDto, UpdateCourseDto, GenerateCoursesDto } from './dto/create-learning-plan.dto';
import { LearningPlanResponseDto, LearningPlanSummaryDto, MilestoneResponseDto, CourseResponseDto } from './dto/learning-plan-response.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('learning-plans')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('learning-plans')
export class LearningPlansController {
  constructor(private readonly learningPlansService: LearningPlansService) {
    console.log('=== LEARNING PLANS CONTROLLER INITIALIZED ===');
  }

  @Get('test')
  @ApiOperation({ summary: 'Test endpoint to verify learning plans routes are working' })
  @ApiResponse({ status: 200, description: 'Test successful' })
  async test() {
    console.log('=== LEARNING PLANS TEST ENDPOINT CALLED ===');
    return {
      message: 'Learning plans routes are working!',
      timestamp: new Date().toISOString(),
      controller: 'LearningPlansController'
    };
  }

  @Post('test-create')
  @ApiOperation({ summary: 'Test endpoint for creating a learning plan with sample data' })
  @ApiResponse({ status: 201, description: 'Test learning plan created successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async testCreate(@Request() req): Promise<LearningPlanResponseDto> {
    const testData: CreateLearningPlanDto = {
      title: 'Test Learning Plan',
      description: 'This is a test learning plan created for debugging',
      subjects: ['math', 'science', 'programming'],
      milestones: [
        {
          title: 'Learn Basic Algebra',
          description: 'Master fundamental algebraic concepts',
          subjectId: 'math',
          orderIndex: 0,
        },
        {
          title: 'Introduction to Physics',
          description: 'Basic principles of physics',
          subjectId: 'science',
          orderIndex: 1,
        },
        {
          title: 'Programming Fundamentals',
          description: 'Learn basic programming concepts',
          subjectId: 'programming',
          orderIndex: 2,
        },
      ],
    };

    console.log('=== TEST CREATE LEARNING PLAN ===');
    console.log('Using test data:', JSON.stringify(testData, null, 2));

    return this.learningPlansService.create(req.user.id, testData);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new learning plan' })
  @ApiResponse({ status: 201, description: 'Learning plan created successfully', type: LearningPlanResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async create(
    @Request() req,
    @Body() createLearningPlanDto: CreateLearningPlanDto,
  ): Promise<LearningPlanResponseDto> {
    console.log('=== CREATE LEARNING PLAN REQUEST ===');
    console.log('User ID:', req.user?.id);
    console.log('Request body:', JSON.stringify(createLearningPlanDto, null, 2));

    // Validate required fields
    if (!createLearningPlanDto.title || createLearningPlanDto.title.trim() === '') {
      console.error('Validation Error: Title is required');
      throw new BadRequestException('Title is required');
    }

    if (!createLearningPlanDto.subjects || !Array.isArray(createLearningPlanDto.subjects) || createLearningPlanDto.subjects.length === 0) {
      console.error('Validation Error: Subjects array is required and cannot be empty');
      throw new BadRequestException('Subjects array is required and cannot be empty');
    }

    if (!createLearningPlanDto.milestones || !Array.isArray(createLearningPlanDto.milestones) || createLearningPlanDto.milestones.length === 0) {
      console.error('Validation Error: Milestones array is required and cannot be empty');
      throw new BadRequestException('Milestones array is required and cannot be empty');
    }

    // Validate milestones
    createLearningPlanDto.milestones.forEach((milestone, index) => {
      if (!milestone.title || milestone.title.trim() === '') {
        console.error(`Validation Error: Milestone ${index} title is required`);
        throw new BadRequestException(`Milestone ${index} title is required`);
      }
      if (!milestone.subjectId || milestone.subjectId.trim() === '') {
        console.error(`Validation Error: Milestone ${index} subjectId is required`);
        throw new BadRequestException(`Milestone ${index} subjectId is required`);
      }
      if (typeof milestone.orderIndex !== 'number' || milestone.orderIndex < 0) {
        console.error(`Validation Error: Milestone ${index} orderIndex must be a non-negative number`);
        throw new BadRequestException(`Milestone ${index} orderIndex must be a non-negative number`);
      }
    });

    console.log('Validation passed, creating learning plan...');

    try {
      const result = await this.learningPlansService.create(req.user.id, createLearningPlanDto);
      console.log('Learning plan created successfully:', result.id);
      return result;
    } catch (error) {
      console.error('Error creating learning plan:', error);
      throw error;
    }
  }

  @Get()
  @ApiOperation({ summary: 'Get all learning plans for the authenticated user' })
  @ApiResponse({ status: 200, description: 'Learning plans retrieved successfully', type: [LearningPlanSummaryDto] })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findAll(@Request() req): Promise<LearningPlanSummaryDto[]> {
    return this.learningPlansService.findAll(req.user.id);
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
    return this.learningPlansService.findOne(req.user.id, id);
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
    return this.learningPlansService.update(req.user.id, id, updateLearningPlanDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a learning plan' })
  @ApiResponse({ status: 200, description: 'Learning plan deleted successfully' })
  @ApiResponse({ status: 404, description: 'Learning plan not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async remove(@Request() req, @Param('id') id: string): Promise<void> {
    return this.learningPlansService.remove(req.user.id, id);
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
    return this.learningPlansService.addMilestone(req.user.id, planId, createMilestoneDto);
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
    return this.learningPlansService.updateMilestone(req.user.id, planId, milestoneId, updateMilestoneDto);
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
    return this.learningPlansService.removeMilestone(req.user.id, planId, milestoneId);
  }

  @Post(':planId/milestones/:milestoneId/generate-courses')
  @ApiOperation({ summary: 'Generate courses for a milestone' })
  @ApiResponse({ status: 201, description: 'Courses generated successfully', type: [CourseResponseDto] })
  @ApiResponse({ status: 404, description: 'Milestone or learning plan not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async generateCourses(
    @Request() req,
    @Param('planId') planId: string,
    @Param('milestoneId') milestoneId: string,
    @Body() generateCoursesDto: GenerateCoursesDto,
  ): Promise<CourseResponseDto[]> {
    console.log('=== GENERATE COURSES ENDPOINT CALLED ===');
    console.log('User ID:', req.user?.id);
    console.log('Plan ID:', planId);
    console.log('Milestone ID:', milestoneId);
    console.log('Generate DTO:', JSON.stringify(generateCoursesDto, null, 2));

    try {
      return await this.learningPlansService.generateCoursesForMilestone(req.user.id, planId, milestoneId, generateCoursesDto);
    } catch (err) {
      // Create a short error id to correlate logs with client-side failure
      const crypto = require('crypto');
      const errorId = crypto.randomBytes(4).toString('hex');
      console.error(`ErrorId=${errorId} - Error generating courses:`, err?.stack ?? err?.message ?? err);

      // Map AI provider BadRequest -> 503 with hint
      const { BadRequestException, ServiceUnavailableException } = require('@nestjs/common');
      if (err instanceof BadRequestException || (err && err.status === 400)) {
        throw new ServiceUnavailableException(`AI service failed to generate courses (errorId=${errorId}). Check GROQ_API_KEY / GEMINI_API_KEY, quota, and request format. See server logs for errorId.`);
      }

      // For other unexpected errors, return 500 with the error id so we can correlate in logs
      const { InternalServerErrorException } = require('@nestjs/common');
      throw new InternalServerErrorException(`Internal error generating courses (errorId=${errorId}). See server logs for details.`);
    }
  }

  @Post(':planId/milestones/:milestoneId/courses')
  @ApiOperation({ summary: 'Add a course to a milestone' })
  @ApiResponse({ status: 201, description: 'Course added successfully', type: CourseResponseDto })
  @ApiResponse({ status: 404, description: 'Milestone or learning plan not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async addCourse(
    @Request() req,
    @Param('planId') planId: string,
    @Param('milestoneId') milestoneId: string,
    @Body() createCourseDto: CreateCourseDto,
  ): Promise<CourseResponseDto> {
    return this.learningPlansService.addCourse(req.user.id, planId, milestoneId, createCourseDto);
  }

  @Patch(':planId/milestones/:milestoneId/courses/:courseId')
  @ApiOperation({ summary: 'Update a course' })
  @ApiResponse({ status: 200, description: 'Course updated successfully', type: CourseResponseDto })
  @ApiResponse({ status: 404, description: 'Course, milestone or learning plan not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async updateCourse(
    @Request() req,
    @Param('planId') planId: string,
    @Param('milestoneId') milestoneId: string,
    @Param('courseId') courseId: string,
    @Body() updateCourseDto: UpdateCourseDto,
  ): Promise<CourseResponseDto> {
    return this.learningPlansService.updateCourse(req.user.id, planId, milestoneId, courseId, updateCourseDto);
  }

  @Delete(':planId/milestones/:milestoneId/courses/:courseId')
  @ApiOperation({ summary: 'Delete a course' })
  @ApiResponse({ status: 200, description: 'Course deleted successfully' })
  @ApiResponse({ status: 404, description: 'Course, milestone or learning plan not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async removeCourse(
    @Request() req,
    @Param('planId') planId: string,
    @Param('milestoneId') milestoneId: string,
    @Param('courseId') courseId: string,
  ): Promise<void> {
    return this.learningPlansService.removeCourse(req.user.id, planId, milestoneId, courseId);
  }
}