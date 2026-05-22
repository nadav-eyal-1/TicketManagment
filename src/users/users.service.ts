import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../entities/user.entity';
import { Mention } from '../entities/mention.entity';
import { UserRole } from '../common/enums/user-role.enum';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Mention)
    private readonly mentionRepo: Repository<Mention>,
  ) {}

  async create(dto: CreateUserDto): Promise<User> {
    if (dto.role !== undefined && !Object.values(UserRole).includes(dto.role)) {
      throw new BadRequestException(`Invalid role: ${dto.role}`);
    }
    const existing = await this.userRepo.findOne({
      where: [{ username: dto.username }, { email: dto.email }],
    });
    if (existing) {
      throw new ConflictException('Username or email already taken');
    }
    const hashed = await bcrypt.hash(dto.password, 10);
    const user = this.userRepo.create({ ...dto, password: hashed });
    return this.userRepo.save(user);
  }

  findAll(): Promise<User[]> {
    return this.userRepo.find();
  }

  async findOne(id: number): Promise<User> {
    const user = await this.userRepo.findOneBy({ id });
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return user;
  }

  async update(id: number, dto: UpdateUserDto): Promise<User> {
    const user = await this.findOne(id);
    Object.assign(user, dto);
    return this.userRepo.save(user);
  }

  async remove(id: number): Promise<void> {
    const user = await this.findOne(id);
    await this.userRepo.remove(user);
  }

  async getMentions(userId: number, page: number, pageSize: number) {
    await this.findOne(userId);
    const [mentions, total] = await this.mentionRepo.findAndCount({
      where: { userId },
      relations: { comment: { mentions: { user: true } } },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    const data = mentions.map((m) => {
      const { mentions: commentMentions, ...rest } = m.comment as typeof m.comment & { mentions?: typeof m.comment.mentions };
      return {
        ...rest,
        mentionedUsers: (commentMentions ?? []).map((cm) => ({
          id: cm.user.id,
          username: cm.user.username,
          fullName: cm.user.fullName,
        })),
      };
    });
    return { data, total, page };
  }
}
