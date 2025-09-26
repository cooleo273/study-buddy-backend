import { Controller, Post, Body, UseGuards, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { AdminGuard } from './admin.guard';
import { SignupDto } from './dto/signup.dto';
import { SigninDto } from './dto/signin.dto';
import { JwtAuthResponseDto } from './dto/auth-response.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('signup')
  @ApiOperation({ summary: 'User registration' })
  @ApiResponse({ status: 201, description: 'User registered successfully', type: JwtAuthResponseDto })
  @ApiResponse({ status: 400, description: 'Email already exists' })
  async signup(@Body() dto: SignupDto): Promise<JwtAuthResponseDto> {
    return this.authService.signUp(dto);
  }

  @Post('login')
  @ApiOperation({ summary: 'User login' })
  @ApiResponse({ status: 200, description: 'Login successful, returns JWT tokens', type: JwtAuthResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async signin(@Body() dto: SigninDto): Promise<JwtAuthResponseDto> {
    return this.authService.signIn(dto);
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({ status: 200, description: 'New access token generated', type: JwtAuthResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid refresh token' })
  async refresh(@Body() dto: RefreshTokenDto): Promise<JwtAuthResponseDto> {
    return this.authService.refreshToken(dto.refreshToken);
  }

  @Post('admin/promote/:userId')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Promote user to admin (Admin only)' })
  @ApiResponse({ status: 200, description: 'User promoted to admin successfully' })
  @ApiResponse({ status: 403, description: 'Admin access required' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async promoteToAdmin(@Param('userId') userId: string) {
    await this.authService.promoteToAdmin(userId);
    return { message: 'User promoted to admin successfully' };
  }
}
