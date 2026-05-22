import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Comment } from '../entities/comment.entity';
import { Mention } from '../entities/mention.entity';
import { User } from '../entities/user.entity';
import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';

@Module({
  imports: [TypeOrmModule.forFeature([Comment, Mention, User])],
  controllers: [CommentsController],
  providers: [CommentsService],
})
export class CommentsModule {}
