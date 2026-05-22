import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { AuthService } from '../auth.service';
import { JWT_SECRET } from '../auth.constants';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly authService: AuthService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: JWT_SECRET,
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: { sub: number; username: string; role: string }) {
    const token = ExtractJwt.fromAuthHeaderAsBearerToken()(req);
    if (token && this.authService.isTokenRevoked(token)) {
      throw new UnauthorizedException('Token has been revoked');
    }
    return payload;
  }
}
