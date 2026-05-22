import {
  BadRequestException,
  ConflictException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { stringify as csvStringify } from 'csv-stringify/sync';
import { parse as csvParse } from 'csv-parse/sync';
import { Ticket } from '../entities/ticket.entity';
import { AuditLog } from '../entities/audit-log.entity';
import { User } from '../entities/user.entity';
import { STATUS_ORDER, TicketStatus } from '../common/enums/ticket-status.enum';
import { TicketPriority } from '../common/enums/ticket-priority.enum';
import { TicketType } from '../common/enums/ticket-type.enum';
import { UserRole } from '../common/enums/user-role.enum';
import { AuditAction } from '../common/enums/audit-action.enum';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { DependenciesService } from '../dependencies/dependencies.service';

export interface ImportResult {
  created: number;
  failed: number;
  errors: string[];
}

@Injectable()
export class TicketsService {
  constructor(
    @InjectRepository(Ticket)
    private readonly ticketRepo: Repository<Ticket>,
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @Inject(forwardRef(() => DependenciesService))
    private readonly dependenciesService: DependenciesService,
  ) {}

  async create(dto: CreateTicketDto): Promise<Ticket> {
    const ticket = this.ticketRepo.create(dto);

    if (!dto.assigneeId) {
      const assigneeId = await this.autoAssign(dto.projectId);
      if (assigneeId !== null) {
        ticket.assigneeId = assigneeId;
      }
    }

    const saved = await this.ticketRepo.save(ticket);

    if (!dto.assigneeId && saved.assigneeId) {
      await this.auditRepo.save(
        this.auditRepo.create({
          entityType: 'TICKET',
          entityId: saved.id,
          action: AuditAction.AUTO_ASSIGN,
          actor: 'SYSTEM',
          performedBy: null,
          changes: { assigneeId: saved.assigneeId },
        }),
      );
    }

    return saved;
  }

  /** Pick the DEVELOPER with the fewest non-DONE tickets in the given project. Ties broken by earliest createdAt. */
  private async autoAssign(projectId: number): Promise<number | null> {
    const result = await this.userRepo
      .createQueryBuilder('user')
      .leftJoin(
        'user.assignedTickets',
        'ticket',
        'ticket.projectId = :projectId AND ticket.status != :done AND ticket.deletedAt IS NULL',
        { projectId, done: TicketStatus.DONE },
      )
      .where('user.role = :role', { role: UserRole.DEVELOPER })
      .groupBy('user.id')
      .select('user.id', 'id')
      .addSelect('COUNT(ticket.id)', 'ticketCount')
      .orderBy('COUNT(ticket.id)', 'ASC')
      .addOrderBy('user.createdAt', 'ASC')
      .getRawOne<{ id: number; ticketCount: string }>();

    return result ? Number(result.id) : null;
  }

  findAll(projectId: number): Promise<Ticket[]> {
    return this.ticketRepo.findBy({ projectId });
  }

  async findOne(id: number): Promise<Ticket> {
    const ticket = await this.ticketRepo.findOneBy({ id });
    if (!ticket) throw new NotFoundException(`Ticket ${id} not found`);
    return ticket;
  }

  async update(id: number, dto: UpdateTicketDto): Promise<Ticket> {
    const ticket = await this.findOne(id);

    if (ticket.status === TicketStatus.DONE) {
      throw new BadRequestException('Cannot update a DONE ticket');
    }

    if (dto.status !== undefined) {
      const currentIdx = STATUS_ORDER.indexOf(ticket.status);
      const newIdx = STATUS_ORDER.indexOf(dto.status);
      if (newIdx !== currentIdx + 1) {
        throw new BadRequestException(
          `Invalid status transition: ${ticket.status} → ${dto.status}`,
        );
      }

      if (dto.status === TicketStatus.DONE) {
        const blockersDone = await this.dependenciesService.allBlockersDone(id);
        if (!blockersDone) {
          throw new BadRequestException(
            'Cannot mark ticket as DONE: one or more blocker tickets are not yet DONE',
          );
        }
      }
    }

    if (dto.version !== undefined && dto.version !== ticket.version) {
      throw new ConflictException(
        'Ticket was modified by another request; refresh and retry',
      );
    }

    const { version: _, ...rest } = dto;
    const updates = Object.fromEntries(
      Object.entries(rest).filter(([, v]) => v !== undefined),
    );
    Object.assign(ticket, updates);
    if (dto.priority !== undefined) {
      ticket.isOverdue = false;
    }

    try {
      return await this.ticketRepo.save(ticket);
    } catch (err: unknown) {
      if (
        err instanceof Error &&
        err.name === 'OptimisticLockVersionMismatchError'
      ) {
        throw new ConflictException(
          'Ticket was modified by another request; refresh and retry',
        );
      }
      throw err;
    }
  }

  async remove(id: number): Promise<void> {
    const ticket = await this.findOne(id);
    await this.ticketRepo.softRemove(ticket);
  }

  findDeleted(projectId: number): Promise<Ticket[]> {
    return this.ticketRepo.find({
      withDeleted: true,
      where: { deletedAt: Not(IsNull()), projectId },
    });
  }

  async restore(id: number): Promise<Ticket> {
    const ticket = await this.ticketRepo.findOne({
      withDeleted: true,
      where: { id },
    });
    if (!ticket) throw new NotFoundException(`Ticket ${id} not found`);
    if (!ticket.deletedAt)
      throw new BadRequestException(`Ticket ${id} is not deleted`);
    await this.ticketRepo.restore(id);
    return this.findOne(id);
  }

  async exportCsv(projectId: number): Promise<Buffer> {
    const tickets = await this.ticketRepo.findBy({ projectId });
    const rows = tickets.map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description ?? '',
      status: t.status,
      priority: t.priority,
      type: t.type,
      assigneeId: t.assigneeId ?? '',
    }));

    const csv = csvStringify(rows, {
      header: true,
      columns: ['id', 'title', 'description', 'status', 'priority', 'type', 'assigneeId'],
    });

    return Buffer.from(csv, 'utf-8');
  }

  async importCsv(projectId: number, fileBuffer: Buffer): Promise<ImportResult> {
    const rows = csvParse(fileBuffer, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as Record<string, string>[];

    let created = 0;
    let failed = 0;
    const errors: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 1;

      try {
        if (!row.title?.trim()) {
          throw new Error('title is required');
        }

        if (row.status && !Object.values(TicketStatus).includes(row.status as TicketStatus)) {
          throw new Error(`invalid status "${row.status}"`);
        }
        if (row.priority && !Object.values(TicketPriority).includes(row.priority as TicketPriority)) {
          throw new Error(`invalid priority "${row.priority}"`);
        }
        if (row.type && !Object.values(TicketType).includes(row.type as TicketType)) {
          throw new Error(`invalid type "${row.type}"`);
        }

        const assigneeId = row.assigneeId ? Number(row.assigneeId) : undefined;
        if (row.assigneeId && isNaN(assigneeId!)) {
          throw new Error(`invalid assigneeId "${row.assigneeId}"`);
        }

        const dto: CreateTicketDto = {
          title: row.title.trim(),
          description: row.description?.trim() || undefined,
          status: (row.status as TicketStatus) || undefined,
          priority: (row.priority as TicketPriority) || undefined,
          type: (row.type as TicketType) || undefined,
          projectId,
          assigneeId,
        };

        await this.create(dto);
        created++;
      } catch (err: unknown) {
        failed++;
        errors.push(`Row ${rowNum}: ${err instanceof Error ? err.message : 'unknown error'}`);
      }
    }

    return { created, failed, errors };
  }
}
