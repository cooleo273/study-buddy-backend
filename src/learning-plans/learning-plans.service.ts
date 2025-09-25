import { Injectable, NotFoundException, ForbiddenException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLearningPlanDto, UpdateLearningPlanDto, CreateMilestoneDto, UpdateMilestoneDto, CreateCourseDto, UpdateCourseDto, GenerateCoursesDto, CreateQuizAttemptDto, QuizAttemptResponseDto } from './dto/create-learning-plan.dto';
import { LearningPlanResponseDto, LearningPlanSummaryDto, MilestoneResponseDto, CourseResponseDto } from './dto/learning-plan-response.dto';
import { AiService } from '../ai/ai.service';

@Injectable()
export class LearningPlansService {
  private readonly logger = new Logger(LearningPlansService.name);
  constructor(private prisma: PrismaService, private ai: AiService) {}

  async create(userId: string, dto: CreateLearningPlanDto): Promise<LearningPlanResponseDto> {
    console.log('=== LEARNING PLANS SERVICE CREATE ===');
    console.log('User ID:', userId);
    console.log('DTO:', JSON.stringify(dto, null, 2));

    if (!userId) {
      throw new Error('User ID is required');
    }

    const learningPlan = await this.prisma.learningPlan.create({
      data: {
        title: dto.title,
        description: dto.description,
        subjects: dto.subjects,
        user: {
          connect: { id: userId }
        },
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
          include: {
            courses: {
              orderBy: { orderIndex: 'asc' }
            }
          }
        },
      },
    });

    console.log('Learning plan created successfully:', learningPlan.id);
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
          include: {
            courses: {
              orderBy: { orderIndex: 'asc' },
              include: {
                quizzes: {
                  include: {
                    questions: {
                      orderBy: { orderIndex: 'asc' },
                    },
                  },
                },
              },
            }
          }
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
          include: {
            courses: {
              orderBy: { orderIndex: 'asc' }
            }
          }
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

    const updatedMilestone = await this.prisma.learningPlanMilestone.update({
      where: { id: milestoneId },
      data: updateData,
    });

    // Update plan progress after milestone update
    await this.updatePlanProgress(planId);

    return {
      id: updatedMilestone.id,
      title: updatedMilestone.title,
      description: updatedMilestone.description,
      subjectId: updatedMilestone.subjectId,
      isCompleted: updatedMilestone.isCompleted,
      completedAt: updatedMilestone.completedAt,
      orderIndex: updatedMilestone.orderIndex,
      courses: [],
      createdAt: updatedMilestone.createdAt,
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

  async addMilestone(userId: string, planId: string, dto: CreateMilestoneDto): Promise<MilestoneResponseDto> {
    // Check if plan exists and belongs to user
    await this.findOne(userId, planId);

    const newMilestone = await this.prisma.learningPlanMilestone.create({
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
      id: newMilestone.id,
      title: newMilestone.title,
      description: newMilestone.description,
      subjectId: newMilestone.subjectId,
      isCompleted: newMilestone.isCompleted,
      completedAt: newMilestone.completedAt,
      orderIndex: newMilestone.orderIndex,
      courses: [],
      createdAt: newMilestone.createdAt,
    };
  }

  async generateCoursesForMilestone(
    userId: string,
    planId: string,
    milestoneId: string,
    dto: GenerateCoursesDto,
  ): Promise<CourseResponseDto[]> {
    this.logger.log('=== GENERATE COURSES FOR MILESTONE (AI) ===');
    this.logger.debug(JSON.stringify({ userId, planId, milestoneId, dto }, null, 2));

    // Check if plan exists and belongs to user
    const plan = await this.findOne(userId, planId);
    const milestone = plan.milestones.find(m => m.id === milestoneId);

    if (!milestone) {
      throw new NotFoundException('Milestone not found');
    }

    const count = dto.count ?? 5;
    const difficulty = (dto.difficulty ?? 'intermediate').toLowerCase();
    const topics = dto.topics && dto.topics.length > 0 ? dto.topics : [milestone.title];

    // Build AI system prompt and user message requesting strict JSON
  const systemPrompt = `You are an expert curriculum designer. Return only JSON (no backticks, no prose), strictly matching this TypeScript type:
type Course = { 
  title: string; 
  description: string; 
  content: string; 
  duration: number; 
  difficulty: 'beginner' | 'intermediate' | 'advanced'; 
  orderIndex: number;
  youtubeVideo: {
    title: string;
    url: string;
    channelName: string;
    duration: string;
    description: string;
  };
  quiz: {
    title: string;
    description?: string;
    passingScore: number;
    questions: Array<{
      question: string;
      type: 'multiple_choice' | 'short_answer' | 'true_false';
      options?: string[];
      correctAnswer: string;
      explanation?: string;
      points: number;
      orderIndex: number;
    }>;
  };
};
Return an array Course[] only.
CRITICAL RULES:
- Do NOT use LaTeX backslash sequences like \( \), \frac, etc. Use plain text or Markdown without LaTeX.
- If you must include a backslash in any string, escape it as \\\\ (double backslash in JSON).
- Do not include any text outside the JSON array.
- Ensure quiz has 3-4 questions appropriate for the difficulty level.
- For multiple_choice, provide 4 options with one correct answer.
- For short_answer, correctAnswer should be the expected answer (case-insensitive).
- For true_false, options should be ["True", "False"] and correctAnswer "True" or "False".
- For youtubeVideo: Suggest ONE highly-rated, educational YouTube video (search results show high view counts and positive ratings) that perfectly matches the course topic. Include real YouTube URL, channelName, approximate duration, and brief description.`;

  const userMessage = `Create ${count} comprehensive mini-courses for the milestone "${milestone.title}".
Context: ${plan.title} - ${milestone.description ?? 'N/A'}
Difficulty: ${difficulty}
Topics: ${topics.join(', ')}

Requirements:
- duration: ${difficulty === 'beginner' ? '30-60' : difficulty === 'intermediate' ? '60-90' : '90-150'} minutes
- orderIndex: 0 to ${count - 1}
- content with sections: Course Introduction, Learning Objectives (4-6), Key Concepts, Practical Examples (3-4), Summary
- youtubeVideo: Suggest ONE highly-rated educational YouTube video that perfectly matches this course topic. Use real, existing videos with high view counts. Include: title, full YouTube URL, channelName, duration (e.g., "15:30"), and brief description of why it's relevant.
- quiz: 3-4 questions testing understanding
- titles: unique and specific
- NO LaTeX, escape backslashes as \\\\
- Return pure JSON array only`;

    // Call AI (Groq first, fallback to Gemini) via AiService
    let aiResult;
    try {
      aiResult = await this.ai.generateContent({
        message: userMessage,
        systemPrompt,
        parameters: { temperature: 0.6, maxTokens: 2500 }
      });
      this.logger.log('AI Response received:', aiResult.response.substring(0, 500) + '...');
    } catch (e) {
      this.logger.warn(`Initial AI call failed: ${e.message}`);
      // If initial call fails due to rate limit or overload, use fallback
      if (e.message?.includes('rate limit') || e.message?.includes('Rate limit') ||
          e.message?.includes('overloaded') || e.message?.includes('503')) {
        this.logger.warn('AI service unavailable, using fallback courses');
        const coursesFromAi = this.createFallbackCourses(count, milestone, difficulty);
        // Continue with the rest of the function using fallback courses
        return this.processAndCreateCourses(coursesFromAi, milestone, count, difficulty);
      }
      throw e; // Re-throw other errors
    }

    let coursesFromAi = this.parseCoursesJson(aiResult.response);
    this.logger.log(`Parsed ${coursesFromAi.length} courses from AI response`);
    if (coursesFromAi.length > 0) {
      this.logger.log('First course youtubeVideo:', JSON.stringify(coursesFromAi[0].youtubeVideo, null, 2));
    }
    // Retry: if parsing failed, ask AI to reformat to valid JSON array only
    if (!coursesFromAi || coursesFromAi.length === 0) {
      this.logger.warn('Primary AI response not parseable as JSON. Attempting reformat.');
      const reformatSystem = 'You are a formatter. Return VALID JSON ONLY. No markdown, no code fences, no explanations.';
      const reformatUser = `Convert the following text into a valid JSON array of Course objects with exact keys: title (string), description (string), content (string), duration (number, minutes), difficulty (one of: "beginner" | "intermediate" | "advanced" in lowercase), orderIndex (number starting at 0, consecutive), youtubeVideo (object with title, url, channelName, duration, description), quiz (object with title, description?, passingScore, questions array). Ensure proper JSON escaping, no LaTeX, no extra text. Output JSON array only.\n\nTEXT:\n${aiResult.response}`;
      try {
        const reformatted = await this.ai.generateContent({
          message: reformatUser,
          systemPrompt: reformatSystem,
          parameters: { temperature: 0.1, maxTokens: 2500 }
        });
        coursesFromAi = this.parseCoursesJson(reformatted.response);
      } catch (e) {
        this.logger.warn(`Reformat attempt failed: ${e.message}`);
        // If it's a rate limit or service unavailable, don't try further
        if (e.message?.includes('rate limit') || e.message?.includes('Rate limit') ||
            e.message?.includes('overloaded') || e.message?.includes('503')) {
          this.logger.warn('AI service rate limited or overloaded, using fallback courses');
          coursesFromAi = this.createFallbackCourses(count, milestone, difficulty);
        }
      }
    }
    if (!coursesFromAi || coursesFromAi.length === 0) {
      this.logger.warn('AI failed to generate courses, creating fallback courses');
      // Create basic fallback courses when AI fails
      coursesFromAi = this.createFallbackCourses(count, milestone, difficulty);
    }

    return this.processAndCreateCourses(coursesFromAi, milestone, count, difficulty);
  }

  // Helper: process and create courses in database
  private async processAndCreateCourses(coursesFromAi: any[], milestone: any, count: number, difficulty: string): Promise<CourseResponseDto[]> {
    const milestoneId = milestone.id;

    // Normalize and cap to requested count
    const normalized: CreateCourseDto[] = coursesFromAi
      .slice(0, count)
      .map((c: any, idx: number) => ({
        title: String(c.title ?? `Course ${idx + 1}`),
        description: c.description ? String(c.description) : undefined,
        content: c.content ? String(c.content) : undefined,
        duration: this.clampDuration(Number(c.duration), difficulty),
        difficulty: ['beginner','intermediate','advanced'].includes(String(c.difficulty)) ? String(c.difficulty) : difficulty,
        orderIndex: typeof c.orderIndex === 'number' ? c.orderIndex : idx,
        youtubeVideo: c.youtubeVideo ? {
          title: String(c.youtubeVideo.title ?? ''),
          url: String(c.youtubeVideo.url ?? ''),
          channelName: String(c.youtubeVideo.channel ?? c.youtubeVideo.channelName ?? ''),
          duration: String(c.youtubeVideo.duration ?? ''),
          description: String(c.youtubeVideo.description ?? ''),
        } : undefined,
        quiz: c.quiz ? {
          title: String(c.quiz.title ?? `Quiz for ${c.title}`),
          description: c.quiz.description ? String(c.quiz.description) : undefined,
          passingScore: Number(c.quiz.passingScore) || 70,
          questions: Array.isArray(c.quiz.questions) ? c.quiz.questions.map((q: any, qidx: number) => ({
            question: String(q.question ?? ''),
            type: ['multiple_choice', 'short_answer', 'true_false'].includes(q.type) ? q.type : 'multiple_choice',
            options: Array.isArray(q.options) ? q.options.map(String) : undefined,
            correctAnswer: String(q.correctAnswer ?? ''),
            explanation: q.explanation ? String(q.explanation) : undefined,
            points: Number(q.points) || 1,
            orderIndex: typeof q.orderIndex === 'number' ? q.orderIndex : qidx,
          })) : [],
        } : undefined,
      }));

    // Create in DB using transaction callback to preserve client context in serverless environments
    const created = await this.prisma.$transaction(async (tx: any) => {
      const results: any[] = [];
      for (const courseData of normalized) {
        const course = await tx.course.create({
          data: {
            milestoneId,
            title: courseData.title,
            description: courseData.description,
            content: courseData.content,
            duration: courseData.duration,
            difficulty: courseData.difficulty,
            orderIndex: courseData.orderIndex,
            youtubeVideo: courseData.youtubeVideo,
          },
        });

        // Create quiz if provided
        if (courseData.quiz) {
          const quiz = await tx.quiz.create({
            data: {
              courseId: course.id,
              title: courseData.quiz.title,
              description: courseData.quiz.description,
              passingScore: courseData.quiz.passingScore,
            },
          });

          // Create quiz questions
          for (const question of courseData.quiz.questions) {
            await tx.quizQuestion.create({
              data: {
                quizId: quiz.id,
                question: question.question,
                type: question.type,
                options: question.options,
                correctAnswer: question.correctAnswer,
                explanation: question.explanation,
                points: question.points,
                orderIndex: question.orderIndex,
              },
            });
          }
        }

        results.push(course);
      }
      return results;
    });

    this.logger.log(`Generated ${created.length} courses for milestone ${milestoneId}`);

    // Return with quiz data included
    return await Promise.all(created.map(async (course) => {
      const quiz = await this.prisma.quiz.findFirst({
        where: { courseId: course.id },
        include: {
          questions: {
            orderBy: { orderIndex: 'asc' },
          },
        },
      });

      return {
        id: course.id,
        title: course.title,
        description: course.description,
        content: course.content,
        duration: course.duration,
        difficulty: course.difficulty,
        isCompleted: course.isCompleted,
        completedAt: course.completedAt,
        orderIndex: course.orderIndex,
        youtubeVideo: course.youtubeVideo as any,
        quiz: quiz ? {
          id: quiz.id,
          title: quiz.title,
          description: quiz.description,
          passingScore: quiz.passingScore,
          isRequired: quiz.isRequired,
          questions: quiz.questions.map(q => ({
            id: q.id,
            question: q.question,
            type: q.type,
            options: q.options as string[] | undefined,
            points: q.points,
            orderIndex: q.orderIndex,
            createdAt: q.createdAt,
          })),
          createdAt: quiz.createdAt,
          updatedAt: quiz.updatedAt,
        } : undefined,
        createdAt: course.createdAt,
        updatedAt: course.updatedAt,
      };
    }));
  }

  private createFallbackCourses(count: number, milestone: any, difficulty: string): any[] {
    const courses = [];
    const baseTitle = milestone.title || 'Course Topic';

    for (let i = 0; i < count; i++) {
      const courseNumber = i + 1;
      courses.push({
        title: `${baseTitle} - Part ${courseNumber}`,
        description: `Basic introduction to ${baseTitle.toLowerCase()} concepts.`,
        content: `## Introduction\nThis course covers fundamental concepts in ${baseTitle.toLowerCase()}.\n\n## Key Concepts\n- Basic principles\n- Common applications\n\n## Examples\n1. Simple example\n2. Practical application\n\n## Summary\nKey takeaways and next steps.`,
        duration: difficulty === 'beginner' ? 45 : difficulty === 'intermediate' ? 75 : 105,
        difficulty,
        orderIndex: i,
        youtubeVideo: {
          title: `Introduction to ${baseTitle}`,
          url: `https://www.youtube.com/watch?v=example${courseNumber}`,
          channelName: 'Educational Channel',
          duration: '10:30',
          description: `A basic introduction to ${baseTitle.toLowerCase()} concepts for beginners.`,
        },
        quiz: {
          title: `Quiz for ${baseTitle} - Part ${courseNumber}`,
          passingScore: 70,
          questions: [
            {
              question: `What is a basic concept in ${baseTitle.toLowerCase()}?`,
              type: 'short_answer',
              correctAnswer: 'concept',
              explanation: 'This is a fundamental concept in the topic.',
              points: 50,
              orderIndex: 0,
            },
            {
              question: `True or False: ${baseTitle} is important for understanding the subject.`,
              type: 'true_false',
              options: ['True', 'False'],
              correctAnswer: 'True',
              explanation: 'This topic is fundamental to the subject area.',
              points: 50,
              orderIndex: 1,
            },
          ],
        },
      });
    }

    return courses;
  }

  // Helper: clamp duration to reasonable bounds based on difficulty
  private clampDuration(value: number, difficulty: string): number {
    const ranges: Record<string, [number, number]> = {
      beginner: [30, 60],
      intermediate: [60, 90],
      advanced: [90, 150],
    };
    const [min, max] = ranges[difficulty] ?? ranges.intermediate;
    if (!Number.isFinite(value)) return min;
    return Math.min(Math.max(Math.round(value), min), max);
  }

  // Helper: extract JSON array from AI text (handles code fences and trailing text)
  private parseCoursesJson(text: string): any[] {
    try {
      // Quick path
      const direct = JSON.parse(text);
      return Array.isArray(direct) ? direct : [];
    } catch {}

    // Try to find the first [ ... ] JSON array substring
    const start = text.indexOf('[');
    const end = text.lastIndexOf(']');
    if (start !== -1 && end !== -1 && end > start) {
      const jsonLike = text.slice(start, end + 1);
      // First try raw
      try {
        const arr = JSON.parse(jsonLike);
        return Array.isArray(arr) ? arr : [];
      } catch {}
      // Then try sanitized
      const sanitized = this.sanitizeJsonLike(jsonLike);
      try {
        const arr2 = JSON.parse(sanitized);
        return Array.isArray(arr2) ? arr2 : [];
      } catch {}
    }

    // Remove fenced code markdown if present
    const cleaned = text
      .replace(/^```(json)?/gim, '')
      .replace(/```$/gim, '')
      .trim();
    try {
      const parsed = JSON.parse(cleaned);
      return Array.isArray(parsed) ? parsed : [];
    } catch {}

    // Last attempt: sanitize whole text
    const sanitizedWhole = this.sanitizeJsonLike(cleaned);
    try {
      const parsed2 = JSON.parse(sanitizedWhole);
      return Array.isArray(parsed2) ? parsed2 : [];
    } catch {}

    this.logger.warn('Failed to parse AI response as JSON array. Returning empty.');
    return [];
  }

  // Attempts to fix common JSON issues from LLMs: unescaped backslashes (e.g., "\(") and trailing commas
  private sanitizeJsonLike(input: string): string {
    let out = input;
    // Remove trailing commas before } or ]
    out = out.replace(/,(\s*[}\]])/g, '$1');
    // Escape any backslash that is not followed by a valid JSON escape char
    // Valid escapes: \ " / b f n r t u
    out = out.replace(/\\(?![\\"\/bfnrtu])/g, '\\\\');
    return out;
  }

  async addCourse(userId: string, planId: string, milestoneId: string, dto: CreateCourseDto): Promise<CourseResponseDto> {
    // Check if plan exists and belongs to user
    await this.findOne(userId, planId);

    const course = await this.prisma.course.create({
      data: {
        milestoneId,
        title: dto.title,
        description: dto.description,
        content: dto.content,
        duration: dto.duration,
        difficulty: dto.difficulty,
        orderIndex: dto.orderIndex,
        youtubeVideo: dto.youtubeVideo,
      },
    });

    return {
      id: course.id,
      title: course.title,
      description: course.description,
      content: course.content,
      duration: course.duration,
      difficulty: course.difficulty,
      isCompleted: course.isCompleted,
      completedAt: course.completedAt,
      orderIndex: course.orderIndex,
      youtubeVideo: course.youtubeVideo as any,
      createdAt: course.createdAt,
      updatedAt: course.updatedAt,
    };
  }

  async updateCourse(
    userId: string,
    planId: string,
    milestoneId: string,
    courseId: string,
    dto: UpdateCourseDto,
  ): Promise<CourseResponseDto> {
    // Check if plan exists and belongs to user
    await this.findOne(userId, planId);

    const updateData: any = {
      ...(dto.title && { title: dto.title }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.content !== undefined && { content: dto.content }),
      ...(dto.duration !== undefined && { duration: dto.duration }),
      ...(dto.difficulty !== undefined && { difficulty: dto.difficulty }),
      ...(dto.orderIndex !== undefined && { orderIndex: dto.orderIndex }),
    };

    if (dto.isCompleted !== undefined) {
      updateData.isCompleted = dto.isCompleted;
      updateData.completedAt = dto.isCompleted ? new Date() : null;

      // If course is being marked as completed, update milestone progress
      if (dto.isCompleted) {
        // Get the course to find its milestone
        const course = await this.prisma.course.findUnique({
          where: { id: courseId },
          select: { milestoneId: true },
        });
        if (course) {
          await this.updateMilestoneProgress(course.milestoneId);
        }
      }
    }

    const course = await this.prisma.course.update({
      where: { id: courseId },
      data: updateData,
    });

    return {
      id: course.id,
      title: course.title,
      description: course.description,
      content: course.content,
      duration: course.duration,
      difficulty: course.difficulty,
      isCompleted: course.isCompleted,
      completedAt: course.completedAt,
      orderIndex: course.orderIndex,
      youtubeVideo: course.youtubeVideo as any,
      createdAt: course.createdAt,
      updatedAt: course.updatedAt,
    };
  }

  async removeCourse(userId: string, planId: string, milestoneId: string, courseId: string): Promise<void> {
    // Check if plan exists and belongs to user
    await this.findOne(userId, planId);

    await this.prisma.course.delete({
      where: { id: courseId },
    });
  }

  async submitQuizAttempt(userId: string, dto: CreateQuizAttemptDto): Promise<QuizAttemptResponseDto> {
    this.logger.log('=== SUBMIT QUIZ ATTEMPT ===');
    this.logger.debug(JSON.stringify({ userId, quizId: dto.quizId }, null, 2));

    // Get the quiz with questions
    const quiz = await this.prisma.quiz.findUnique({
      where: { id: dto.quizId },
      include: {
        questions: {
          orderBy: { orderIndex: 'asc' },
        },
        course: true,
      },
    });

    if (!quiz) {
      throw new NotFoundException('Quiz not found');
    }

    // Calculate score
    let totalPoints = 0;
    let earnedPoints = 0;
    const answerRecords: any[] = [];

    for (const userAnswer of dto.answers) {
      const question = quiz.questions.find(q => q.id === userAnswer.questionId);
      if (!question) continue;

      const isCorrect = this.checkAnswer(question, userAnswer.answer);
      const points = isCorrect ? question.points : 0;

      totalPoints += question.points;
      earnedPoints += points;

      answerRecords.push({
        questionId: question.id,
        answer: userAnswer.answer,
        isCorrect,
        points,
      });
    }

    const score = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;
    const isPassed = score >= quiz.passingScore;

    // Create quiz attempt
    const attempt = await this.prisma.quizAttempt.create({
      data: {
        userId,
        quizId: dto.quizId,
        score,
        isPassed,
        completedAt: new Date(),
        timeSpent: 0, // TODO: Calculate actual time spent
        answers: {
          create: answerRecords.map(answer => ({
            questionId: answer.questionId,
            answer: answer.answer,
            isCorrect: answer.isCorrect,
            points: answer.points,
          })),
        },
      },
      include: {
        answers: {
          orderBy: { answeredAt: 'asc' },
        },
      },
    });

    // If quiz is passed and required, mark course as completed
    if (isPassed && quiz.isRequired) {
      await this.prisma.course.update({
        where: { id: quiz.courseId },
        data: {
          isCompleted: true,
          completedAt: new Date(),
        },
      });

      // Update milestone progress
      await this.updateMilestoneProgress(quiz.course.milestoneId);
    }

    return {
      id: attempt.id,
      userId: attempt.userId,
      quizId: attempt.quizId,
      score: attempt.score,
      isPassed: attempt.isPassed,
      timeSpent: attempt.timeSpent || undefined,
      startedAt: attempt.startedAt,
      completedAt: attempt.completedAt || undefined,
      answers: attempt.answers.map(a => {
        const question = quiz.questions.find(q => q.id === a.questionId);
        return {
          id: a.id,
          questionId: a.questionId,
          answer: a.answer,
          isCorrect: a.isCorrect,
          points: a.points,
          answeredAt: a.answeredAt,
          correctAnswer: question?.correctAnswer,
          explanation: question?.explanation,
        };
      }),
      createdAt: attempt.createdAt,
    };
  }

  async getQuizAttempts(userId: string, quizId: string): Promise<QuizAttemptResponseDto[]> {
    const attempts = await this.prisma.quizAttempt.findMany({
      where: {
        userId,
        quizId,
      },
      include: {
        answers: {
          orderBy: { answeredAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return attempts.map(attempt => ({
      id: attempt.id,
      userId: attempt.userId,
      quizId: attempt.quizId,
      score: attempt.score,
      isPassed: attempt.isPassed,
      timeSpent: attempt.timeSpent || undefined,
      startedAt: attempt.startedAt,
      completedAt: attempt.completedAt || undefined,
      answers: attempt.answers.map(a => ({
        id: a.id,
        questionId: a.questionId,
        answer: a.answer,
        isCorrect: a.isCorrect,
        points: a.points,
        answeredAt: a.answeredAt,
      })),
      createdAt: attempt.createdAt,
    }));
  }

  private checkAnswer(question: any, userAnswer: string): boolean {
    const correctAnswer = question.correctAnswer.toLowerCase().trim();
    const userAns = userAnswer.toLowerCase().trim();

    switch (question.type) {
      case 'multiple_choice':
      case 'true_false':
        return correctAnswer === userAns;
      case 'short_answer':
        // For short answer, do a case-insensitive comparison
        return correctAnswer === userAns;
      default:
        return false;
    }
  }

  private async updateMilestoneProgress(milestoneId: string): Promise<void> {
    const milestone = await this.prisma.learningPlanMilestone.findUnique({
      where: { id: milestoneId },
      include: {
        courses: true,
      },
    });

    if (!milestone) return;

    const totalCourses = milestone.courses.length;
    const completedCourses = milestone.courses.filter(c => c.isCompleted).length;

    if (totalCourses > 0 && completedCourses === totalCourses) {
      // All courses completed, mark milestone as completed
      await this.prisma.learningPlanMilestone.update({
        where: { id: milestoneId },
        data: {
          isCompleted: true,
          completedAt: new Date(),
        },
      });

      // Update plan progress
      await this.updatePlanProgress(milestone.planId);
    }
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
        courses: milestone.courses?.map(course => ({
          id: course.id,
          title: course.title,
          description: course.description,
          content: course.content,
          duration: course.duration,
          difficulty: course.difficulty,
          isCompleted: course.isCompleted,
          completedAt: course.completedAt,
          orderIndex: course.orderIndex,
          youtubeVideo: course.youtubeVideo as any,
          quiz: course.quizzes && course.quizzes.length > 0 ? {
            id: course.quizzes[0].id,
            title: course.quizzes[0].title,
            description: course.quizzes[0].description,
            passingScore: course.quizzes[0].passingScore,
            isRequired: course.quizzes[0].isRequired,
            questions: course.quizzes[0].questions.map(q => ({
              id: q.id,
              question: q.question,
              type: q.type,
              options: q.options as string[] | undefined,
              points: q.points,
              orderIndex: q.orderIndex,
              createdAt: q.createdAt,
            })),
            createdAt: course.quizzes[0].createdAt,
            updatedAt: course.quizzes[0].updatedAt,
          } : undefined,
          createdAt: course.createdAt,
          updatedAt: course.updatedAt,
        })) || [],
        createdAt: milestone.createdAt,
      })),
      createdAt: plan.createdAt,
      updatedAt: plan.updatedAt,
    };
  }
}