import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Ticket } from './ticket.entity';

@Entity('ticket_dependencies')
@Unique(['blockedId', 'blockerId'])
export class TicketDependency {
  @PrimaryGeneratedColumn()
  id: number;

  /** The ticket that is blocked */
  @ManyToOne(() => Ticket, (t) => t.blockedByDeps, { nullable: false })
  blocked: Ticket;

  @Column()
  blockedId: number;

  /** The ticket that blocks */
  @ManyToOne(() => Ticket, (t) => t.blockingDeps, { nullable: false })
  blocker: Ticket;

  @Column()
  blockerId: number;

  @CreateDateColumn()
  createdAt: Date;
}
