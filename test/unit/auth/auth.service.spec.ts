import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthService } from 'src/auth/auth.service';
import { User } from 'src/entities/user.entity';

describe('AuthService', () => {
  let service: AuthService;
  let userRepo: { findOneBy: jest.Mock };

  beforeEach(async () => {
    userRepo = { findOneBy: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: JwtService, useValue: { sign: jest.fn().mockReturnValue('signed.jwt.token') } },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('login', () => {
    it('U-A1: valid credentials return accessToken', async () => {
      const hash = await bcrypt.hash('secret123', 10);
      userRepo.findOneBy.mockResolvedValue({ id: 1, username: 'alice', role: 'ADMIN', password: hash });

      const result = await service.login({ username: 'alice', password: 'secret123' });

      expect(result).toHaveProperty('accessToken');
      expect(typeof result.accessToken).toBe('string');
    });

    it('U-A2: wrong password throws UnauthorizedException', async () => {
      const hash = await bcrypt.hash('correct', 10);
      userRepo.findOneBy.mockResolvedValue({ id: 1, username: 'alice', password: hash });

      await expect(service.login({ username: 'alice', password: 'wrong' })).rejects.toThrow(UnauthorizedException);
    });

    it('U-A3: unknown username throws UnauthorizedException', async () => {
      userRepo.findOneBy.mockResolvedValue(null);

      await expect(service.login({ username: 'nobody', password: 'any' })).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('logout / isTokenRevoked', () => {
    it('U-A4: logout adds token to deny-list', () => {
      service.logout('test.jwt.token');

      expect(service.isTokenRevoked('test.jwt.token')).toBe(true);
    });

    it('fresh token is not in deny-list', () => {
      expect(service.isTokenRevoked('never.seen.token')).toBe(false);
    });

    it('only the revoked token is flagged, not others', () => {
      service.logout('revoked');

      expect(service.isTokenRevoked('other.token')).toBe(false);
    });
  });
});
