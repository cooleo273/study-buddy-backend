import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BadgeResponseDto, UserBadgeResponseDto, UserStatsResponseDto, LeaderboardEntryDto } from './dto/gamification.dto';

@Injectable()
export class GamificationService implements OnModuleInit {
  private readonly logger = new Logger(GamificationService.name);

  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    await this.seedBadges();
  }

  // Award points to user
  async awardPoints(userId: string, points: number, reason?: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        points: { increment: points },
        lastActivityDate: new Date(),
      },
    });
    this.logger.log(`Awarded ${points} points to user ${userId}: ${reason || 'No reason'}`);
  }

  // Update streak
  async updateStreak(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const lastActivity = user.lastActivityDate ? new Date(user.lastActivityDate) : null;
    if (lastActivity) {
      lastActivity.setHours(0, 0, 0, 0);
    }

    let newStreak = user.streakCount;

    if (!lastActivity || lastActivity.getTime() < today.getTime() - 24 * 60 * 60 * 1000) {
      // Reset streak if more than a day has passed
      newStreak = 1;
    } else if (lastActivity.getTime() === today.getTime() - 24 * 60 * 60 * 1000) {
      // Consecutive day
      newStreak += 1;
    } else if (lastActivity.getTime() === today.getTime()) {
      // Same day, no change
    } else {
      // Future date? Reset
      newStreak = 1;
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        streakCount: newStreak,
        lastActivityDate: new Date(),
      },
    });
  }

  // Check and award badges based on criteria
  async checkAndAwardBadges(userId: string): Promise<void> {
    const badges = await this.prisma.badge.findMany();
    const userBadges = await this.prisma.userBadge.findMany({
      where: { userId },
      include: { badge: true },
    });
    const earnedBadgeIds = userBadges.map(ub => ub.badgeId);

    for (const badge of badges) {
      if (earnedBadgeIds.includes(badge.id)) continue;

      const meetsCriteria = await this.evaluateBadgeCriteria(userId, badge.criteria as any);
      if (meetsCriteria) {
        await this.awardBadge(userId, badge.id);
      }
    }
  }

  private async evaluateBadgeCriteria(userId: string, criteria: any): Promise<boolean> {
    if (!criteria || !criteria.type) return false;

    switch (criteria.type) {
      case 'course_completed':
        const courseCount = await this.prisma.course.count({
          where: { milestone: { plan: { userId } }, isCompleted: true },
        });
        return courseCount >= (criteria.count || 1);

      case 'quiz_passed':
        const quizCount = await this.prisma.quizAttempt.count({
          where: { userId, isPassed: true },
        });
        return quizCount >= (criteria.count || 1);

      case 'streak':
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        return (user?.streakCount || 0) >= (criteria.count || 1);

      case 'quiz_attempted':
        const attemptCount = await this.prisma.quizAttempt.count({
          where: { userId },
        });
        return attemptCount >= (criteria.count || 1);

      case 'learning_plans_created':
        const planCount = await this.prisma.learningPlan.count({
          where: { userId },
        });
        return planCount >= (criteria.count || 1);

      case 'chat_sessions_created':
        const chatCount = await this.prisma.chatSession.count({
          where: { userId },
        });
        return chatCount >= (criteria.count || 1);

      case 'questions_generated':
        const questionCount = await this.prisma.generatedQuestion.count({
          where: { userId },
        });
        return questionCount >= (criteria.count || 1);

      case 'points_earned':
        const userForPoints = await this.prisma.user.findUnique({ where: { id: userId } });
        return (userForPoints?.points || 0) >= (criteria.count || 1);

      default:
        return false;
    }
  }

  private async awardBadge(userId: string, badgeId: string): Promise<void> {
    const badge = await this.prisma.badge.findUnique({ where: { id: badgeId } });
    if (!badge) return;

    await this.prisma.userBadge.create({
      data: { userId, badgeId },
    });

    await this.awardPoints(userId, badge.points, `Earned badge: ${badge.name}`);

    this.logger.log(`Awarded badge ${badge.name} to user ${userId}`);
  }

  // Get user stats
  async getUserStats(userId: string): Promise<UserStatsResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        badges: {
          include: { badge: true },
          orderBy: { earnedAt: 'desc' },
        },
      },
    });

    if (!user) throw new Error('User not found');

    const coursesCompleted = await this.prisma.course.count({
      where: { milestone: { plan: { userId } }, isCompleted: true },
    });

    const quizzesPassed = await this.prisma.quizAttempt.count({
      where: { userId, isPassed: true },
    });

    return {
      points: user.points,
      streakCount: user.streakCount,
      lastActivityDate: user.lastActivityDate || undefined,
      badges: user.badges.map(ub => ({
        id: ub.id,
        badge: {
          id: ub.badge.id,
          name: ub.badge.name,
          description: ub.badge.description || undefined,
          icon: ub.badge.icon || undefined,
          points: ub.badge.points,
          criteria: ub.badge.criteria || undefined,
          createdAt: ub.badge.createdAt,
        },
        earnedAt: ub.earnedAt,
      })),
      coursesCompleted,
      quizzesPassed,
    };
  }

  // Get leaderboard
  async getLeaderboard(limit: number = 10): Promise<LeaderboardEntryDto[]> {
    const users = await this.prisma.user.findMany({
      select: {
        id: true,
        username: true,
        points: true,
      },
      orderBy: { points: 'desc' },
      take: limit,
    });

    return users.map((user, index) => ({
      userId: user.id,
      username: user.username || undefined,
      points: user.points,
      rank: index + 1,
    }));
  }

  // Get all available badges
  async getAllBadges(): Promise<BadgeResponseDto[]> {
    const badges = await this.prisma.badge.findMany({
      orderBy: { createdAt: 'asc' },
    });

    return badges.map(badge => ({
      id: badge.id,
      name: badge.name,
      description: badge.description || undefined,
      icon: badge.icon || undefined,
      points: badge.points,
      criteria: badge.criteria as any || undefined,
      createdAt: badge.createdAt,
    }));
  }

  // Seed initial badges
  async seedBadges(): Promise<void> {
    const badges = [
      {
        name: 'First Steps',
        description: 'Complete your first course',
        icon: '🎓',
        points: 10,
        criteria: { type: 'course_completed', count: 1 },
      },
      {
        name: 'Quiz Master',
        description: 'Pass your first quiz',
        icon: '🧠',
        points: 15,
        criteria: { type: 'quiz_passed', count: 1 },
      },
      {
        name: 'Dedicated Learner',
        description: 'Maintain a 5-day learning streak',
        icon: '🔥',
        points: 25,
        criteria: { type: 'streak', count: 5 },
      },
      {
        name: 'Knowledge Seeker',
        description: 'Complete 10 courses',
        icon: '📚',
        points: 50,
        criteria: { type: 'course_completed', count: 10 },
      },
      {
        name: 'Scholar',
        description: 'Complete 5 courses',
        icon: '🎓',
        points: 30,
        criteria: { type: 'course_completed', count: 5 },
      },
      {
        name: 'Quiz Champion',
        description: 'Pass 5 quizzes',
        icon: '🏆',
        points: 40,
        criteria: { type: 'quiz_passed', count: 5 },
      },
      {
        name: 'Consistency King',
        description: 'Maintain a 10-day learning streak',
        icon: '👑',
        points: 60,
        criteria: { type: 'streak', count: 10 },
      },
      {
        name: 'Plan Maker',
        description: 'Create 3 learning plans',
        icon: '📝',
        points: 35,
        criteria: { type: 'learning_plans_created', count: 3 },
      },
      {
        name: 'Chat Enthusiast',
        description: 'Create 10 chat sessions',
        icon: '💬',
        points: 45,
        criteria: { type: 'chat_sessions_created', count: 10 },
      },
      {
        name: 'Question Generator',
        description: 'Generate 20 questions',
        icon: '❓',
        points: 55,
        criteria: { type: 'questions_generated', count: 20 },
      },
      {
        name: 'Point Collector',
        description: 'Earn 100 points',
        icon: '💎',
        points: 20,
        criteria: { type: 'points_earned', count: 100 },
      },
      {
        name: 'Master Learner',
        description: 'Complete 25 courses',
        icon: '🎓',
        points: 100,
        criteria: { type: 'course_completed', count: 25 },
      },
      {
        name: 'Quiz Expert',
        description: 'Pass 10 quizzes',
        icon: '🧠',
        points: 75,
        criteria: { type: 'quiz_passed', count: 10 },
      },
      {
        name: 'Streak Master',
        description: 'Maintain a 30-day learning streak',
        icon: '🔥',
        points: 150,
        criteria: { type: 'streak', count: 30 },
      },
      {
        name: 'Top Contributor',
        description: 'Earn 500 points',
        icon: '⭐',
        points: 50,
        criteria: { type: 'points_earned', count: 500 },
      },
      // Smaller badges
      {
        name: 'Chat Starter',
        description: 'Create your first chat session',
        icon: '💬',
        points: 5,
        criteria: { type: 'chat_sessions_created', count: 1 },
      },
      {
        name: 'Plan Beginner',
        description: 'Create your first learning plan',
        icon: '📝',
        points: 8,
        criteria: { type: 'learning_plans_created', count: 1 },
      },
      {
        name: 'Question Beginner',
        description: 'Generate your first 5 questions',
        icon: '❓',
        points: 10,
        criteria: { type: 'questions_generated', count: 5 },
      },
      {
        name: 'Streak Starter',
        description: 'Maintain a 1-day learning streak',
        icon: '🔥',
        points: 5,
        criteria: { type: 'streak', count: 1 },
      },
      {
        name: 'Quiz Taker',
        description: 'Attempt your first quiz',
        icon: '🧠',
        points: 5,
        criteria: { type: 'quiz_attempted', count: 1 },
      },
      {
        name: 'Consistent Learner',
        description: 'Maintain a 3-day learning streak',
        icon: '🔥',
        points: 15,
        criteria: { type: 'streak', count: 3 },
      },
      {
        name: 'Chat Lover',
        description: 'Create 5 chat sessions',
        icon: '💬',
        points: 20,
        criteria: { type: 'chat_sessions_created', count: 5 },
      },
      {
        name: 'Question Enthusiast',
        description: 'Generate 10 questions',
        icon: '❓',
        points: 25,
        criteria: { type: 'questions_generated', count: 10 },
      },
      {
        name: 'Plan Creator',
        description: 'Create 5 learning plans',
        icon: '📝',
        points: 45,
        criteria: { type: 'learning_plans_created', count: 5 },
      },
      // Bigger, harder badges
      {
        name: 'Ultimate Scholar',
        description: 'Complete 50 courses',
        icon: '🎓',
        points: 200,
        criteria: { type: 'course_completed', count: 50 },
      },
      {
        name: 'Quiz Grandmaster',
        description: 'Pass 25 quizzes',
        icon: '🏆',
        points: 150,
        criteria: { type: 'quiz_passed', count: 25 },
      },
      {
        name: 'Legendary Streak',
        description: 'Maintain a 60-day learning streak',
        icon: '🔥',
        points: 300,
        criteria: { type: 'streak', count: 60 },
      },
      {
        name: 'Chat Guru',
        description: 'Create 50 chat sessions',
        icon: '💬',
        points: 100,
        criteria: { type: 'chat_sessions_created', count: 50 },
      },
      {
        name: 'Question Master',
        description: 'Generate 100 questions',
        icon: '❓',
        points: 120,
        criteria: { type: 'questions_generated', count: 100 },
      },
      {
        name: 'Point Hoarder',
        description: 'Earn 1000 points',
        icon: '💰',
        points: 100,
        criteria: { type: 'points_earned', count: 1000 },
      },
      {
        name: 'Plan Architect',
        description: 'Create 10 learning plans',
        icon: '🏗️',
        points: 80,
        criteria: { type: 'learning_plans_created', count: 10 },
      },
      {
        name: 'Quiz Virtuoso',
        description: 'Pass 50 quizzes',
        icon: '🧠',
        points: 250,
        criteria: { type: 'quiz_passed', count: 50 },
      },
      {
        name: 'Eternal Flame',
        description: 'Maintain a 100-day learning streak',
        icon: '🔥',
        points: 500,
        criteria: { type: 'streak', count: 100 },
      },
      // Additional milestone badges
      {
        name: 'Course Explorer',
        description: 'Complete 3 courses',
        icon: '🗺️',
        points: 20,
        criteria: { type: 'course_completed', count: 3 },
      },
      {
        name: 'Quiz Warrior',
        description: 'Pass 3 quizzes',
        icon: '⚔️',
        points: 25,
        criteria: { type: 'quiz_passed', count: 3 },
      },
      {
        name: 'Week Warrior',
        description: 'Maintain a 7-day learning streak',
        icon: '📅',
        points: 35,
        criteria: { type: 'streak', count: 7 },
      },
      {
        name: 'Chat Explorer',
        description: 'Create 3 chat sessions',
        icon: '💭',
        points: 15,
        criteria: { type: 'chat_sessions_created', count: 3 },
      },
      {
        name: 'Question Creator',
        description: 'Generate 15 questions',
        icon: '✏️',
        points: 30,
        criteria: { type: 'questions_generated', count: 15 },
      },
      {
        name: 'Plan Enthusiast',
        description: 'Create 7 learning plans',
        icon: '📋',
        points: 55,
        criteria: { type: 'learning_plans_created', count: 7 },
      },
      {
        name: 'Knowledge Builder',
        description: 'Complete 15 courses',
        icon: '🏗️',
        points: 70,
        criteria: { type: 'course_completed', count: 15 },
      },
      {
        name: 'Quiz Specialist',
        description: 'Pass 15 quizzes',
        icon: '🎯',
        points: 85,
        criteria: { type: 'quiz_passed', count: 15 },
      },
      {
        name: 'Month Master',
        description: 'Maintain a 30-day learning streak',
        icon: '🗓️',
        points: 120,
        criteria: { type: 'streak', count: 30 },
      },
      {
        name: 'Chat Master',
        description: 'Create 25 chat sessions',
        icon: '🗣️',
        points: 65,
        criteria: { type: 'chat_sessions_created', count: 25 },
      },
      {
        name: 'Question Expert',
        description: 'Generate 50 questions',
        icon: '📝',
        points: 90,
        criteria: { type: 'questions_generated', count: 50 },
      },
      {
        name: 'Plan Master',
        description: 'Create 15 learning plans',
        icon: '🎯',
        points: 95,
        criteria: { type: 'learning_plans_created', count: 15 },
      },
      {
        name: 'Century Scholar',
        description: 'Complete 100 courses',
        icon: '💯',
        points: 400,
        criteria: { type: 'course_completed', count: 100 },
      },
      {
        name: 'Quiz Legend',
        description: 'Pass 100 quizzes',
        icon: '👑',
        points: 350,
        criteria: { type: 'quiz_passed', count: 100 },
      },
      {
        name: 'Immortal Streak',
        description: 'Maintain a 365-day learning streak',
        icon: '♾️',
        points: 1000,
        criteria: { type: 'streak', count: 365 },
      },
      {
        name: 'Chat Legend',
        description: 'Create 100 chat sessions',
        icon: '🎙️',
        points: 200,
        criteria: { type: 'chat_sessions_created', count: 100 },
      },
      {
        name: 'Question Legend',
        description: 'Generate 500 questions',
        icon: '🧙',
        points: 300,
        criteria: { type: 'questions_generated', count: 500 },
      },
      {
        name: 'Plan Legend',
        description: 'Create 25 learning plans',
        icon: '🏆',
        points: 150,
        criteria: { type: 'learning_plans_created', count: 25 },
      },
      {
        name: 'Point Millionaire',
        description: 'Earn 2500 points',
        icon: '💵',
        points: 200,
        criteria: { type: 'points_earned', count: 2500 },
      },
      {
        name: 'Point Billionaire',
        description: 'Earn 5000 points',
        icon: '🏦',
        points: 500,
        criteria: { type: 'points_earned', count: 5000 },
      },
      // Special combination badges
      {
        name: 'Well Rounded',
        description: 'Complete 5 courses, pass 5 quizzes, and maintain a 5-day streak',
        icon: '🎪',
        points: 75,
        criteria: { type: 'course_completed', count: 5 }, // Note: This would need a more complex criteria system
      },
      {
        name: 'Social Learner',
        description: 'Create 10 chat sessions and 10 learning plans',
        icon: '👥',
        points: 80,
        criteria: { type: 'chat_sessions_created', count: 10 }, // Simplified for now
      },
    ];

    for (const badgeData of badges) {
      await this.prisma.badge.upsert({
        where: { name: badgeData.name },
        update: {},
        create: badgeData,
      });
    }

    this.logger.log('Seeded initial badges');
  }
}