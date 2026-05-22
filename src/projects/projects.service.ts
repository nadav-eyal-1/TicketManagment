import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { Project } from '../entities/project.entity';
import { Ticket } from '../entities/ticket.entity';
import { User } from '../entities/user.entity';
import { TicketStatus } from '../common/enums/ticket-status.enum';
import { UserRole } from '../common/enums/user-role.enum';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

export interface WorkloadEntry {
  userId: number;
  username: string;
  openTicketCount: number;
}

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
    @InjectRepository(Ticket)
    private readonly ticketRepo: Repository<Ticket>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  create(dto: CreateProjectDto): Promise<Project> {
    const project = this.projectRepo.create(dto);
    return this.projectRepo.save(project);
  }

  findAll(): Promise<Project[]> {
    return this.projectRepo.find();
  }

  async findOne(id: number): Promise<Project> {
    const project = await this.projectRepo.findOneBy({ id });
    if (!project) throw new NotFoundException(`Project ${id} not found`);
    return project;
  }

  async update(id: number, dto: UpdateProjectDto): Promise<Project> {
    const project = await this.findOne(id);
    Object.assign(project, dto);
    return this.projectRepo.save(project);
  }

  async remove(id: number): Promise<void> {
    const project = await this.findOne(id);
    await this.projectRepo.softRemove(project);
  }

  findDeleted(): Promise<Project[]> {
    return this.projectRepo.find({ withDeleted: true, where: { deletedAt: Not(IsNull()) } });
  }

  async restore(id: number): Promise<Project> {
    const project = await this.projectRepo.findOne({ withDeleted: true, where: { id } });
    if (!project) throw new NotFoundException(`Project ${id} not found`);
    if (!project.deletedAt) throw new NotFoundException(`Project ${id} is not deleted`);
    await this.projectRepo.restore(id);
    return this.findOne(id);
  }

  async getWorkload(projectId: number): Promise<WorkloadEntry[]> {
    await this.findOne(projectId);

    const rows = await this.userRepo
      .createQueryBuilder('user')
      .leftJoin(
        'user.assignedTickets',
        'ticket',
        'ticket.projectId = :projectId AND ticket.status != :done AND ticket.deletedAt IS NULL',
        { projectId, done: TicketStatus.DONE },
      )
      .where('user.role = :role', { role: UserRole.DEVELOPER })
      .groupBy('user.id')
      .select('user.id', 'userId')
      .addSelect('user.username', 'username')
      .addSelect('COUNT(ticket.id)', 'openTicketCount')
      .orderBy('COUNT(ticket.id)', 'ASC')
      .getRawMany<{ userId: number; username: string; openTicketCount: string }>();

    return rows.map((r) => ({
      userId: Number(r.userId),
      username: r.username,
      openTicketCount: Number(r.openTicketCount),
    }));
  }
}
