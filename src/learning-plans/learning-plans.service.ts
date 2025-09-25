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
              orderBy: { orderIndex: 'asc' }
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
- Ensure quiz has 4-6 questions appropriate for the difficulty level.
- For multiple_choice, provide 4 options with one correct answer.
- For short_answer, correctAnswer should be the expected answer (case-insensitive).
- For true_false, options should be ["True", "False"] and correctAnswer "True" or "False".`;

  const userMessage = `Create ${count} comprehensive, well-structured mini-courses for the milestone "${milestone.title}".
Context:
- Overall plan title: ${plan.title}
- Milestone description: ${milestone.description ?? 'N/A'}
- Desired difficulty: ${difficulty}
- Topics to cover (may combine if helpful): ${topics.join(', ')}

Constraints:
- duration in minutes appropriate for the difficulty (beginner: 30-60, intermediate: 60-90, advanced: 90-150)
- orderIndex must start at 0 and increment by 1
- content should be rich markdown with these specific sections in this order:
  1. **Course Introduction**: Comprehensive overview of what this course covers, why it's important in the broader context of ${plan.title}, real-world applications, and how it builds upon previous knowledge
  2. **Learning Objectives**: 5-8 specific, measurable, achievable, relevant, and time-bound (SMART) objectives that clearly state what students will be able to do after completing the course
  3. **Key Concepts**: Deep, detailed explanations of each major concept with:
     - Definition and etymology where relevant
     - Historical context and development
     - Mathematical/formal definitions with clear notation
     - Visual analogies or mental models
     - Common misconceptions and how to avoid them
     - Step-by-step examples with detailed solutions
  4. **Detailed Explanations**: In-depth breakdowns covering:
     - Multiple problem-solving approaches and strategies
     - Proofs or derivations where applicable
     - Edge cases and special conditions
     - Connections to other mathematical concepts
     - Alternative representations (graphs, tables, formulas)
     - Common errors and debugging techniques
  5. **Practical Examples**: 4-6 real-world applications including:
     - Step-by-step worked solutions with intermediate steps shown
     - Multiple solution methods for the same problem
     - Variations and extensions of problems
     - Real data sets or scenarios from science, business, engineering
  6. **Interactive Quizzes**: Embedded assessment questions throughout the content (not separate section)
  7. **Summary & Key Takeaways**: Comprehensive review including:
     - Main theorems, formulas, and principles
     - Key relationships and patterns
     - Memory aids and mnemonic devices
     - Connections to future topics
     - Practice problems for self-assessment
- quiz should have 4-6 questions that test deep understanding, not just memorization
- ensure titles are unique, specific, and descriptive
- Do NOT use LaTeX expressions (no \\(...\\), \\frac, etc.)
- Escape any backslashes in strings as \\\\ (JSON-safe)
- Do not include code fences or any text outside pure JSON
- Make content extremely detailed and educational - aim for comprehensive textbook-level explanations with multiple examples and approaches`;

    // Call AI (Groq first, fallback to Gemini) via AiService
    const aiResult = await this.ai.generateContent({
      message: userMessage,
      systemPrompt,
      parameters: { temperature: 0.6, maxTokens: 4000 }
    });

    let coursesFromAi = this.parseCoursesJson(aiResult.response);
    // Retry: if parsing failed, ask AI to reformat to valid JSON array only
    if (!coursesFromAi || coursesFromAi.length === 0) {
      this.logger.warn('Primary AI response not parseable as JSON. Attempting reformat.');
  const reformatSystem = 'You are a formatter. Return VALID JSON ONLY. No markdown, no code fences, no explanations.';
  const reformatUser = `Convert the following text into a valid JSON array of Course objects with exact keys: title (string), description (string), content (string), duration (number, minutes), difficulty (one of: "beginner" | "intermediate" | "advanced" in lowercase), orderIndex (number starting at 0, consecutive), quiz (object with title, description?, passingScore, questions array). Ensure proper JSON escaping, no LaTeX, no extra text. Output JSON array only.\n\nTEXT:\n${aiResult.response}`;
      try {
        const reformatted = await this.ai.generateContent({
          message: reformatUser,
          systemPrompt: reformatSystem,
          parameters: { temperature: 0.1, maxTokens: 4000 }
        });
        coursesFromAi = this.parseCoursesJson(reformatted.response);
      } catch (e) {
        this.logger.warn(`Reformat attempt failed: ${e.message}`);
      }
    }
    if (!coursesFromAi || coursesFromAi.length === 0) {
      throw new BadRequestException('AI did not return any courses in the expected JSON format');
    }

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

    this.logger.log(`Generated ${created.length} AI courses for milestone ${milestoneId}`);

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
      answers: attempt.answers.map(a => ({
        id: a.id,
        questionId: a.questionId,
        answer: a.answer,
        isCorrect: a.isCorrect,
        points: a.points,
        answeredAt: a.answeredAt,
      })),
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
  // Removed malformed legacy logarithms generator. AI-based generation is used instead.

  // Removed additional legacy logarithms content generators.

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