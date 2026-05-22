import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Ticket } from '../entities/ticket.entity';
import { TicketDependency } from '../entities/ticket-dependency.entity';
import { TicketStatus } from '../common/enums/ticket-status.enum';

@Injectable()
export class DependenciesService {
  constructor(
    @InjectRepository(Ticket)
    private readonly ticketRepo: Repository<Ticket>,
    @InjectRepository(TicketDependency)
    private readonly depRepo: Repository<TicketDependency>,
  ) {}

  async addDependency(ticketId: number, blockerId: number): Promise<void> {
    if (ticketId === blockerId) {
      throw new BadRequestException('A ticket cannot block itself');
    }

    const [ticket, blocker] = await Promise.all([
      this.ticketRepo.findOneBy({ id: ticketId }),
      this.ticketRepo.findOneBy({ id: blockerId }),
    ]);

    if (!ticket) throw new NotFoundException(`Ticket ${ticketId} not found`);
    if (!blocker) throw new NotFoundException(`Ticket ${blockerId} not found`);

    if (ticket.projectId !== blocker.projectId) {
      throw new BadRequestException(
        'Both tickets must belong to the same project',
      );
    }

    const existing = await this.depRepo.findOneBy({
      blockedId: ticketId,
      blockerId,
    });
    if (existing) {
      throw new BadRequestException('This dependency already exists');
    }

    await this.depRepo.save(
      this.depRepo.create({ blockedId: ticketId, blockerId }),
    );
  }

  async getDependencies(
    ticketId: number,
  ): Promise<Pick<Ticket, 'id' | 'title' | 'status'>[]> {
    const ticket = await this.ticketRepo.findOneBy({ id: ticketId });
    if (!ticket) throw new NotFoundException(`Ticket ${ticketId} not found`);

    const deps = await this.depRepo.find({
      where: { blockedId: ticketId },
      relations: ['blocker'],
    });

    return deps.map((d) => ({
      id: d.blocker.id,
      title: d.blocker.title,
      status: d.blocker.status,
    }));
  }

  async removeDependency(ticketId: number, blockerId: number): Promise<void> {
    const dep = await this.depRepo.findOneBy({ blockedId: ticketId, blockerId });
    if (!dep) {
      throw new NotFoundException(
        `Dependency between ticket ${ticketId} and blocker ${blockerId} not found`,
      );
    }
    await this.depRepo.remove(dep);
  }

  /** Returns true if all blockers of the given ticket are DONE. */
  async allBlockersDone(ticketId: number): Promise<boolean> {
    const deps = await this.depRepo.find({
      where: { blockedId: ticketId },
      relations: ['blocker'],
    });
    return deps.every((d) => d.blocker.status === TicketStatus.DONE);
  }
}
