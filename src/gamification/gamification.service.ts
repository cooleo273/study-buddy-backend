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