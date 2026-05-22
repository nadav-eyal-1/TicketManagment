import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';
import { AuditLogInterceptor } from 'src/common/interceptors/audit-log.interceptor';
import { AuditLogsService } from 'src/audit-logs/audit-logs.service';

const makeContext = (method: string, path: string, routePath: string, params: Record<string, string> = {}): ExecutionContext => ({
  switchToHttp: () => ({
    getRequest: () => ({
      method,
      path,
      route: { path: routePath },
      params,
      user: { sub: 1 },
      body: {},
    }),
  }),
  getHandler: jest.fn(),
  getClass: jest.fn(),
}) as unknown as ExecutionContext;

const makeHandler = (responseBody: unknown = { id: 1 }): CallHandler => ({
  handle: () => of(responseBody),
});

describe('AuditLogInterceptor', () => {
  let interceptor: AuditLogInterceptor;
  let auditLogsService: { create: jest.Mock };

  beforeEach(async () => {
    auditLogsService = { create: jest.fn().mockResolvedValue({}) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditLogInterceptor,
        { provide: AuditLogsService, useValue: auditLogsService },
      ],
    }).compile();

    interceptor = module.get<AuditLogInterceptor>(AuditLogInterceptor);
  });

  it('U-AL1: POST request triggers AuditLog save', (done) => {
    const ctx = makeContext('POST', '/tickets', '/tickets', {});
    interceptor.intercept(ctx, makeHandler({ id: 5 })).subscribe({
      complete: () => {
        setTimeout(() => {
          expect(auditLogsService.create).toHaveBeenCalledTimes(1);
          done();
        }, 10);
      },
    });
  });

  it('U-AL2: PATCH request triggers AuditLog save', (done) => {
    const ctx = makeContext('PATCH', '/tickets/1', '/tickets/:ticketId', { ticketId: '1' });
    interceptor.intercept(ctx, makeHandler({ id: 1 })).subscribe({
      complete: () => {
        setTimeout(() => {
          expect(auditLogsService.create).toHaveBeenCalledTimes(1);
          done();
        }, 10);
      },
    });
  });

  it('U-AL3: DELETE request triggers AuditLog save', (done) => {
    const ctx = makeContext('DELETE', '/tickets/1', '/tickets/:ticketId', { ticketId: '1' });
    interceptor.intercept(ctx, makeHandler(null)).subscribe({
      complete: () => {
        setTimeout(() => {
          expect(auditLogsService.create).toHaveBeenCalledTimes(1);
          done();
        }, 10);
      },
    });
  });

  it('U-AL4: GET request does NOT trigger AuditLog save', (done) => {
    const ctx = makeContext('GET', '/tickets', '/tickets', {});
    interceptor.intercept(ctx, makeHandler([{ id: 1 }])).subscribe({
      complete: () => {
        expect(auditLogsService.create).not.toHaveBeenCalled();
        done();
      },
    });
  });

  it('Auth routes (POST /auth/login) are skipped', (done) => {
    const ctx = makeContext('POST', '/auth/login', '/auth/login', {});
    interceptor.intercept(ctx, makeHandler({ access_token: 'jwt' })).subscribe({
      complete: () => {
        setTimeout(() => {
          expect(auditLogsService.create).not.toHaveBeenCalled();
          done();
        }, 10);
      },
    });
  });
});
