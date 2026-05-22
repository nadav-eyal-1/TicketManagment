import {
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  Column,
  Unique,
} from 'typeorm';
import { User } from './user.entity';
import { Comment } from './comment.entity';

@Entity('mentions')
@Unique(['userId', 'commentId'])
export class Mention {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, (u) => u.mentions, { nullable: false })
  user: User;

  @Column()
  userId: number;

  @ManyToOne(() => Comment, (c) => c.mentions, { nullable: false, onDelete: 'CASCADE' })
  comment: Comment;

  @Column()
  commentId: number;

  @CreateDateColumn()
  createdAt: Date;
}
