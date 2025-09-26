import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BadgeResponseDto {
  @ApiProperty({ description: 'Badge ID' })
  id: string;

  @ApiProperty({ description: 'Badge name' })
  name: string;

  @ApiPropertyOptional({ description: 'Badge description' })
  description?: string;

  @ApiPropertyOptional({ description: 'Badge icon (URL or emoji)' })
  icon?: string;

  @ApiProperty({ description: 'Points awarded for earning this badge' })
  points: number;

  @ApiPropertyOptional({ description: 'Criteria to earn the badge' })
  criteria?: any;

  @ApiProperty({ description: 'When badge was created' })
  createdAt: Date;
}

export class UserBadgeResponseDto {
  @ApiProperty({ description: 'User badge ID' })
  id: string;

  @ApiProperty({ description: 'Badge details' })
  badge: BadgeResponseDto;

  @ApiProperty({ description: 'When badge was earned' })
  earnedAt: Date;
}

export class UserStatsResponseDto {
  @ApiProperty({ description: 'Total points' })
  points: number;

  @ApiProperty({ description: 'Current streak count' })
  streakCount: number;

  @ApiProperty({ description: 'Last activity date' })
  lastActivityDate?: Date;

  @ApiProperty({ description: 'List of earned badges' })
  badges: UserBadgeResponseDto[];

  @ApiProperty({ description: 'Total courses completed' })
  coursesCompleted: number;

  @ApiProperty({ description: 'Total quizzes passed' })
  quizzesPassed: number;
}

export class LeaderboardEntryDto {
  @ApiProperty({ description: 'User ID' })
  userId: string;

  @ApiPropertyOptional({ description: 'Username' })
  username?: string;

  @ApiProperty({ description: 'Total points' })
  points: number;

  @ApiProperty({ description: 'Rank' })
  rank: number;
}