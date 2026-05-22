import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Request } from 'express';
import { Observable, tap } from 'rxjs';
import { AuditLogsService } from '../../audit-logs/audit-logs.service';
import { AuditAction } from '../enums/audit-action.enum';

/** Route prefixes that are session management, not resource mutations */
const SKIP_PREFIXES = ['/auth'];

/** Maps URL path segment → entity type label */
const ENTITY_TYPE_MAP: Record<string, string> = {
  tickets: 'TICKET',
  projects: 'PROJECT',
  users: 'USER',
  comments: 'COMMENT',
  dependencies: 'TICKET_DEPENDENCY',
  attachments: 'ATTACHMENT',
};

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = ctx.switchToHttp().getRequest<Request>();
    const method = req.method;

    if (!['POST', 'PATCH', 'DELETE'].includes(method)) {
      return next.handle();
    }

    return next.handle().pipe(
      tap({ next: (body: unknown) => void this.log(req, body) }),
    );
  }

  private async log(req: Request, body: unknown): Promise<void> {
    try {
      const routePath: string = (req.route?.path as string | undefined) ?? req.path;
      const params = req.params as Record<string, string>;

      const segments = routePath.split('/').filter(Boolean);

      // Skip auth routes (session management, not resource mutations)
      if (SKIP_PREFIXES.some((prefix) => req.path.startsWith(prefix))) return;

      // Determine entity type by scanning segments from the end
      let entityType: string | null = null;
      for (let i = segments.length - 1; i >= 0; i--) {
        const mapped = ENTITY_TYPE_MAP[segments[i]];
        if (mapped) { entityType = mapped; break; }
      }
      if (!entityType) return;

      // Determine entity ID
      const entityId = this.resolveEntityId(req.method, routePath, params, body);
      if (entityId === null) return;

      const action =
        req.method === 'POST' ? AuditAction.CREATE
        : req.method === 'PATCH' ? AuditAction.UPDATE
        : AuditAction.DELETE;

      const user = req.user as { sub: number } | undefined;

      await this.auditLogsService.create({
        entityType,
        entityId,
        action,
        actor: user ? 'USER' : 'SYSTEM',
        performedBy: user?.sub ?? null,
        changes:
          req.method !== 'DELETE' && body && typeof body === 'object'
            ? (body as Record<string, unknown>)
            : null,
      });
    } catch {
      // if the audit log fails to save, we don't want to crash the whole request
    }
  }

  private resolveEntityId(
    method: string,
    routePath: string,
    params: Record<string, string>,
    body: unknown,
  ): number | null {
    // For POST: prefer the `id` returned in the response body
    if (
      method === 'POST' &&
      body !== null &&
      typeof body === 'object' &&
      'id' in body
    ) {
      const id = (body as Record<string, unknown>).id;
      if (typeof id === 'number') return id;
    }

    // For PATCH/DELETE (or POST without response id): use the last :param in the route template
    const paramNames = (routePath.match(/:(\w+)/g) ?? []).map((p) => p.slice(1));
    for (let i = paramNames.length - 1; i >= 0; i--) {
      const val = params[paramNames[i]];
      if (val && !isNaN(Number(val))) return Number(val);
    }

    return null;
  }
}
