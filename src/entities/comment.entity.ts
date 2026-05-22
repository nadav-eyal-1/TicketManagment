import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';
import { Ticket } from './ticket.entity';
import { User } from './user.entity';
import { Mention } from './mention.entity';

@Entity('comments')
export class Comment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'text' })
  content: string;

  @VersionColumn()
  version: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Ticket, (t) => t.comments, { nullable: false })
  ticket: Ticket;

  @Column()
  ticketId: number;

  @ManyToOne(() => User, (u) => u.comments, { nullable: false })
  author: User;

  @Column()
  authorId: number;

  @OneToMany(() => Mention, (m) => m.comment)
  mentions: Mention[];
}
