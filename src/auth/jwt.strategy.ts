import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from '../users/users.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private usersService: UsersService) {
    const secret = process.env.JWT_SECRET;
    console.log('JWT Strategy constructor - JWT_SECRET:', secret ? 'SET' : 'NOT SET');
    console.log('JWT_SECRET value:', secret);
    console.log('JWT_SECRET length:', secret?.length);

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: any) {
    console.log('=== JWT STRATEGY VALIDATE CALLED ===');
    console.log('JWT Strategy validate called with payload:', payload);

    // Validate token type - only access tokens should be used for authentication
    if (payload.type !== 'access') {
      console.log('Invalid token type:', payload.type);
      throw new UnauthorizedException('Invalid token type. Access tokens only.');
    }

    console.log('Looking up user with ID:', payload.userId);
    const user = await this.usersService.findUserById(payload.userId);
    console.log('User found:', user ? 'YES' : 'NO');

    if (!user) {
      console.log('User not found for ID:', payload.userId);
      throw new UnauthorizedException('User not found');
    }

    console.log('User validated successfully:', { id: user.id, email: user.email });
    return user;
  }
}
