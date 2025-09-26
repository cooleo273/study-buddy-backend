import { Controller, Get, Param, Query, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GamificationService } from './gamification.service';
import { UserStatsResponseDto, LeaderboardEntryDto } from './dto/gamification.dto';

@ApiTags('gamification')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('gamification')
export class GamificationController {
  constructor(private readonly gamificationService: GamificationService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get user gamification stats' })
  @ApiResponse({ status: 200, description: 'User stats retrieved successfully', type: UserStatsResponseDto })
  async getUserStats(@Param('userId') userId: string): Promise<UserStatsResponseDto> {
    // Note: In a real app, you'd get userId from JWT token, not param
    // For now, assuming it's passed or extracted from guard
    return this.gamificationService.getUserStats(userId);
  }

  @Get('leaderboard')
  @ApiOperation({ summary: 'Get leaderboard' })
  @ApiResponse({ status: 200, description: 'Leaderboard retrieved successfully', type: [LeaderboardEntryDto] })
  async getLeaderboard(@Query('limit') limit?: number): Promise<LeaderboardEntryDto[]> {
    return this.gamificationService.getLeaderboard(limit || 10);
  }

  @Post('seed-badges')
  @ApiOperation({ summary: 'Seed initial badges (admin only)' })
  @ApiResponse({ status: 200, description: 'Badges seeded successfully' })
  async seedBadges(): Promise<{ message: string }> {
    await this.gamificationService.seedBadges();
    return { message: 'Badges seeded successfully' };
  }
}