import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Ticket } from '../entities/ticket.entity';
import { AuditLog } from '../entities/audit-log.entity';
import { User } from '../entities/user.entity';
import { TicketsService } from './tickets.service';
import { TicketsController } from './tickets.controller';
import { DependenciesModule } from '../dependencies/dependencies.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Ticket, AuditLog, User]),
    forwardRef(() => DependenciesModule),
  ],
  controllers: [TicketsController],
  providers: [TicketsService],
  exports: [TicketsService],
})
export class TicketsModule {}
