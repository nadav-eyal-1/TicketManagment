import { Reflector } from '@nestjs/core';
import { ExecutionContext } from '@nestjs/common';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { UserRole } from 'src/common/enums/user-role.enum';
import { ROLES_KEY } from 'src/common/decorators/roles.decorator';

const makeContext = (userRole: string | undefined, requiredRoles: UserRole[]): ExecutionContext => {
  const reflector = new Reflector();
  jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(requiredRoles);
  const guard = new RolesGuard(reflector);

  const ctx = {
    switchToHttp: () => ({
      getRequest: () => ({ user: userRole !== undefined ? { role: userRole } : undefined }),
    }),
    getHandler: jest.fn(),
    getClass: jest.fn(),
  } as unknown as ExecutionContext;

  return ctx;
};

describe('RolesGuard', () => {
  let reflector: Reflector;
  let guard: RolesGuard;

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() } as unknown as Reflector;
    guard = new RolesGuard(reflector);
  });

  const makeCtx = (role: string | undefined): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ user: role !== undefined ? { role } : undefined }),
      }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
    }) as unknown as ExecutionContext;

  it('U-SD5/U-SD6: DEVELOPER cannot access ADMIN-only endpoints (canActivate returns false)', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([UserRole.ADMIN]);

    expect(guard.canActivate(makeCtx(UserRole.DEVELOPER))).toBe(false);
  });

  it('ADMIN can access ADMIN-only endpoints', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([UserRole.ADMIN]);

    expect(guard.canActivate(makeCtx(UserRole.ADMIN))).toBe(true);
  });

  it('endpoint with no required roles allows any authenticated user', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(undefined);

    expect(guard.canActivate(makeCtx(UserRole.DEVELOPER))).toBe(true);
  });

  it('unauthenticated request (no user) is denied from ADMIN-only endpoints', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([UserRole.ADMIN]);

    expect(guard.canActivate(makeCtx(undefined))).toBe(false);
  });
});
