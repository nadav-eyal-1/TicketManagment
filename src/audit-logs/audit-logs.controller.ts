import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuditLogsService } from './audit-logs.service';

@UseGuards(JwtAuthGuard)
@Controller('audit-logs')
export class AuditLogsController {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  @Get()
  findAll(
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
    @Query('action') action?: string,
    @Query('actor') actor?: string,
  ) {
    return this.auditLogsService.findAll({
      entityType,
      entityId: entityId !== undefined ? Number(entityId) : undefined,
      action,
      actor,
    });
  }
}
