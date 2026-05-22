import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { UserRole } from '../common/enums/user-role.enum';
import { Project } from './project.entity';
import { Ticket } from './ticket.entity';
import { Comment } from './comment.entity';
import { Mention } from './mention.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  username: string;

  @Column({ unique: true })
  email: string;

  @Exclude()
  @Column()
  password: string;

  @Column()
  fullName: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.DEVELOPER })
  role: UserRole;

  @CreateDateColumn()
  createdAt: Date;

  @OneToMany(() => Project, (p) => p.owner)
  ownedProjects: Project[];

  @OneToMany(() => Ticket, (t) => t.assignee)
  assignedTickets: Ticket[];

  @OneToMany(() => Comment, (c) => c.author)
  comments: Comment[];

  @OneToMany(() => Mention, (m) => m.user)
  mentions: Mention[];
}
