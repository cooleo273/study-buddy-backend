import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from '../users/users.service';

@Injectable()
export class RefreshTokenStrategy extends PassportStrategy(Strategy, 'refresh') {
  constructor(private usersService: UsersService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET,
    });
  }

  async validate(payload: any) {
    // Validate token type - only refresh tokens should be used for token refresh
    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Invalid token type. Refresh tokens only.');
    }

    const user = await this.usersService.findUserById(payload.userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return user;
  }
}