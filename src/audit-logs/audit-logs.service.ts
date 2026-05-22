import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../entities/audit-log.entity';

export interface CreateAuditLogDto {
  entityType: string;
  entityId: number;
  action: string;
  actor: string;
  performedBy: number | null;
  changes?: Record<string, unknown> | null;
}

export interface AuditLogFilters {
  entityType?: string;
  entityId?: number;
  action?: string;
  actor?: string;
}

@Injectable()
export class AuditLogsService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
  ) {}

  create(dto: CreateAuditLogDto): Promise<AuditLog> {
    return this.auditRepo.save(this.auditRepo.create(dto));
  }

  findAll(filters: AuditLogFilters): Promise<AuditLog[]> {
    const where: Partial<AuditLog> = {};
    if (filters.entityType !== undefined) where.entityType = filters.entityType;
    if (filters.entityId !== undefined) where.entityId = Number(filters.entityId);
    if (filters.action !== undefined) where.action = filters.action;
    if (filters.actor !== undefined) where.actor = filters.actor;

    return this.auditRepo.find({ where, order: { timestamp: 'DESC' } });
  }
}
