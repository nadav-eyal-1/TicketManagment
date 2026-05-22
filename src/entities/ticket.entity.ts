import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';
import { TicketStatus } from '../common/enums/ticket-status.enum';
import { TicketPriority } from '../common/enums/ticket-priority.enum';
import { TicketType } from '../common/enums/ticket-type.enum';
import { Project } from './project.entity';
import { User } from './user.entity';
import { Comment } from './comment.entity';
import { Attachment } from './attachment.entity';
import { TicketDependency } from './ticket-dependency.entity';

@Entity('tickets')
export class Ticket {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @Column({ nullable: true, type: 'text' })
  description: string;

  @Column({ type: 'enum', enum: TicketStatus, default: TicketStatus.TODO })
  status: TicketStatus;

  @Column({ type: 'enum', enum: TicketPriority, default: TicketPriority.LOW })
  priority: TicketPriority;

  @Column({ type: 'enum', enum: TicketType, default: TicketType.BUG })
  type: TicketType;

  @Column({ type: 'timestamptz', nullable: true })
  dueDate: Date;

  @Column({ default: false })
  isOverdue: boolean;

  @VersionColumn()
  version: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;

  @ManyToOne(() => Project, (p) => p.tickets, { nullable: false })
  project: Project;

  @Column()
  projectId: number;

  @ManyToOne(() => User, (u) => u.assignedTickets, { nullable: true })
  assignee: User;

  @Column({ nullable: true })
  assigneeId: number;

  @OneToMany(() => Comment, (c) => c.ticket)
  comments: Comment[];

  @OneToMany(() => Attachment, (a) => a.ticket)
  attachments: Attachment[];

  /** Dependencies where this ticket is the blocked one */
  @OneToMany(() => TicketDependency, (td) => td.blocked)
  blockedByDeps: TicketDependency[];

  /** Dependencies where this ticket is the blocker */
  @OneToMany(() => TicketDependency, (td) => td.blocker)
  blockingDeps: TicketDependency[];
}
