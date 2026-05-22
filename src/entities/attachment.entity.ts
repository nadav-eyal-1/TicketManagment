import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Ticket } from './ticket.entity';

@Entity('attachments')
export class Attachment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  filename: string;

  @Column()
  contentType: string;

  @Column()
  filePath: string;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => Ticket, (t) => t.attachments, { nullable: false })
  ticket: Ticket;

  @Column()
  ticketId: number;
}
