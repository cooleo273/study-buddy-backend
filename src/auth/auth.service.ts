import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { SignupDto } from './dto/signup.dto';
import { SigninDto } from './dto/signin.dto';
import { JwtAuthResponseDto, AuthUserResponseDto } from './dto/auth-response.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async signUp(dto: SignupDto): Promise<JwtAuthResponseDto> {
    try {
      const hashedPassword = await bcrypt.hash(dto.password, 12);
      const user = await this.prisma.user.create({
        data: {
          email: dto.email,
          hashedPassword,
          username: dto.username,
        },
        select: {
          id: true,
          email: true,
          username: true,
          createdAt: true
        },
      });

      // Generate tokens
      const payload = { userId: user.id, email: user.email, type: 'access' };
      const refreshPayload = { userId: user.id, email: user.email, type: 'refresh' };
      const accessToken = this.jwtService.sign(payload, { expiresIn: '15m' });
      const refreshToken = this.jwtService.sign(refreshPayload, { expiresIn: '7d' });

      // Create user response
      const userResponse: AuthUserResponseDto = {
        id: user.id,
        email: user.email,
        name: user.username || user.email.split('@')[0],
      };

      return {
        accessToken,
        refreshToken,
        user: userResponse,
      };
    } catch (error) {
      if (error.code === 'P2002') {
        throw new BadRequestException('Email already exists');
      }
      throw error;
    }
  }

  async signIn(dto: SigninDto): Promise<JwtAuthResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user || !(await bcrypt.compare(dto.password, user.hashedPassword))) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Generate tokens
    const accessPayload = { userId: user.id, email: user.email, type: 'access' };
    const refreshPayload = { userId: user.id, email: user.email, type: 'refresh' };
    const accessToken = this.jwtService.sign(accessPayload, { expiresIn: '15m' });
    const refreshToken = this.jwtService.sign(refreshPayload, { expiresIn: '7d' });

    // Create user response
    const userResponse: AuthUserResponseDto = {
      id: user.id,
      email: user.email,
      name: user.username || user.email.split('@')[0],
    };

    return {
      accessToken,
      refreshToken,
      user: userResponse,
    };
  }

  async refreshToken(refreshToken: string): Promise<JwtAuthResponseDto> {
    try {
      // Verify the refresh token
      const payload = this.jwtService.verify(refreshToken);

      // Validate token type
      if (payload.type !== 'refresh') {
        throw new UnauthorizedException('Invalid token type');
      }

      // Get user from database
      const user = await this.prisma.user.findUnique({
        where: { id: payload.userId },
      });

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      // Generate new tokens
      const newPayload = { userId: user.id, email: user.email, type: 'access' };
      const newRefreshPayload = { userId: user.id, email: user.email, type: 'refresh' };
      const accessToken = this.jwtService.sign(newPayload, { expiresIn: '15m' });
      const newRefreshToken = this.jwtService.sign(newRefreshPayload, { expiresIn: '7d' });

      // Create user response
      const userResponse: AuthUserResponseDto = {
        id: user.id,
        email: user.email,
        name: user.username || user.email.split('@')[0],
      };

      return {
        accessToken,
        refreshToken: newRefreshToken,
        user: userResponse,
      };
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }
}
