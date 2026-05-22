import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Not, Repository } from 'typeorm';
import { Ticket } from '../entities/ticket.entity';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { PRIORITY_ORDER, TicketPriority } from '../common/enums/ticket-priority.enum';
import { TicketStatus } from '../common/enums/ticket-status.enum';
import { AuditAction } from '../common/enums/audit-action.enum';

@Injectable()
export class EscalationService {
  private readonly logger = new Logger(EscalationService.name);

  constructor(
    @InjectRepository(Ticket)
    private readonly ticketRepo: Repository<Ticket>,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async escalateOverdueTickets(): Promise<void> {
    const now = new Date();

    const tickets = await this.ticketRepo.find({
      where: {
        dueDate: LessThan(now),
        status: Not(TicketStatus.DONE),
        priority: Not(TicketPriority.CRITICAL),
      },
    });

    if (tickets.length === 0) return;

    this.logger.log(`Escalating ${tickets.length} overdue ticket(s)`);

    for (const ticket of tickets) {
      const currentIdx = PRIORITY_ORDER.indexOf(ticket.priority);
      const newPriority = PRIORITY_ORDER[currentIdx + 1];
      const previousPriority = ticket.priority;

      ticket.priority = newPriority;
      if (newPriority === TicketPriority.CRITICAL) {
        ticket.isOverdue = true;
      }

      await this.ticketRepo.save(ticket);

      await this.auditLogsService.create({
        entityType: 'TICKET',
        entityId: ticket.id,
        action: AuditAction.ESCALATE,
        actor: 'SYSTEM',
        performedBy: null,
        changes: { priority: { from: previousPriority, to: newPriority } },
      });
    }
  }
}
