import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { User } from '../entities/user.entity';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  private readonly revokedTokens = new Set<string>();

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly jwtService: JwtService,
  ) {}

  async login(dto: LoginDto): Promise<{ accessToken: string; tokenType: string; expiresIn: number }> {
    const user = await this.userRepo.findOneBy({ username: dto.username });
    if (!user || !(await bcrypt.compare(dto.password, user.password))) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const payload = { sub: user.id, username: user.username, role: user.role, jti: randomUUID() };
    return { accessToken: this.jwtService.sign(payload), tokenType: 'Bearer', expiresIn: 3600 };
  }

  logout(token: string): void {
    this.revokedTokens.add(token);
  }

  isTokenRevoked(token: string): boolean {
    return this.revokedTokens.has(token);
  }
}
