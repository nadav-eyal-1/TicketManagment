import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Ticket } from '../entities/ticket.entity';
import { TicketDependency } from '../entities/ticket-dependency.entity';
import { DependenciesController } from './dependencies.controller';
import { DependenciesService } from './dependencies.service';

@Module({
  imports: [TypeOrmModule.forFeature([Ticket, TicketDependency])],
  controllers: [DependenciesController],
  providers: [DependenciesService],
  exports: [DependenciesService],
})
export class DependenciesModule {}
