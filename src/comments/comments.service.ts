import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Comment } from '../entities/comment.entity';
import { Mention } from '../entities/mention.entity';
import { User } from '../entities/user.entity';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';

export interface CommentResponse {
  id: number;
  ticketId: number;
  authorId: number;
  content: string;
  mentionedUsers: { id: number; username: string; fullName: string }[];
}

@Injectable()
export class CommentsService {
  constructor(
    @InjectRepository(Comment)
    private readonly commentRepo: Repository<Comment>,
    @InjectRepository(Mention)
    private readonly mentionRepo: Repository<Mention>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  private extractUsernames(content: string): string[] {
    return [...new Set([...content.matchAll(/\B@(\w+)/g)].map((m) => m[1]))];
  }

  private toResponse(comment: Comment): CommentResponse {
    return {
      id: comment.id,
      ticketId: comment.ticketId,
      authorId: comment.authorId,
      content: comment.content,
      mentionedUsers: (comment.mentions ?? []).map((m) => ({
        id: m.user.id,
        username: m.user.username,
        fullName: m.user.fullName,
      })),
    };
  }

private async syncMentions(content: string, commentId: number): Promise<void> {
    await this.mentionRepo.delete({ commentId });
    const usernames = this.extractUsernames(content);
    if (!usernames.length) return;

    const users = await this.userRepo.findBy({ username: In(usernames) });
    if (!users.length) return;

    await this.mentionRepo.save(
      users.map((user) => this.mentionRepo.create({ userId: user.id, commentId })),
    );
  }

  private async loadOne(id: number): Promise<Comment> {
    const comment = await this.commentRepo.findOne({
      where: { id },
      relations: { mentions: { user: true } },
    });
    if (!comment) throw new NotFoundException(`Comment ${id} not found`);
    return comment;
  }

  async create(dto: CreateCommentDto, ticketId: number): Promise<CommentResponse> {
    const saved = await this.commentRepo.save(
      this.commentRepo.create({ content: dto.content, ticketId, authorId: dto.authorId }),
    );
    await this.syncMentions(dto.content, saved.id);
    return this.toResponse(await this.loadOne(saved.id));
  }

  async findAllForTicket(ticketId: number): Promise<CommentResponse[]> {
    const comments = await this.commentRepo.find({
      where: { ticketId },
      relations: { mentions: { user: true } },
      order: { createdAt: 'ASC' },
    });
    return comments.map((c) => this.toResponse(c));
  }

  async update(id: number, ticketId: number, dto: UpdateCommentDto): Promise<CommentResponse> {
    const comment = await this.loadOne(id);
    if (comment.ticketId !== ticketId) throw new NotFoundException(`Comment ${id} not found`);

    if (dto.content !== undefined) {
      comment.content = dto.content;
    }
    if (dto.version !== undefined) {
      comment.version = dto.version;
    }

    try {
      const saved = await this.commentRepo.save(comment);
      if (dto.content !== undefined) {
        await this.syncMentions(dto.content, saved.id);
      }
      return this.toResponse(await this.loadOne(saved.id));
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'OptimisticLockVersionMismatchError') {
        throw new ConflictException('Comment was modified by another request; refresh and retry');
      }
      throw err;
    }
  }

  async remove(id: number, ticketId: number): Promise<void> {
    const comment = await this.loadOne(id);
    if (comment.ticketId !== ticketId) throw new NotFoundException(`Comment ${id} not found`);
    await this.commentRepo.remove(comment);
  }
}
