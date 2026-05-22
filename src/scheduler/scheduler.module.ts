import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Ticket } from '../entities/ticket.entity';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { EscalationService } from './escalation.service';

@Module({
  imports: [TypeOrmModule.forFeature([Ticket]), AuditLogsModule],
  providers: [EscalationService],
})
export class SchedulerModule {}
