import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { JwtStrategy } from 'src/auth/strategies/jwt.strategy';
import { AuthService } from 'src/auth/auth.service';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let authService: { isTokenRevoked: jest.Mock };

  beforeEach(async () => {
    authService = { isTokenRevoked: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        { provide: AuthService, useValue: authService },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
  });

  const makeReq = (token: string): Request =>
    ({ headers: { authorization: `Bearer ${token}` } }) as unknown as Request;

  it('U-A5: revoked token throws UnauthorizedException', async () => {
    authService.isTokenRevoked.mockReturnValue(true);

    await expect(
      strategy.validate(makeReq('revoked.token'), { sub: 1, username: 'alice', role: 'ADMIN' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('U-A6: valid non-revoked token returns payload', async () => {
    authService.isTokenRevoked.mockReturnValue(false);

    const result = await strategy.validate(makeReq('valid.token'), {
      sub: 1,
      username: 'alice',
      role: 'ADMIN',
    });

    expect(result).toEqual({ sub: 1, username: 'alice', role: 'ADMIN' });
  });
});
