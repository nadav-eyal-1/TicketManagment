import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CommentsService } from 'src/comments/comments.service';
import { Comment } from 'src/entities/comment.entity';
import { Mention } from 'src/entities/mention.entity';
import { User } from 'src/entities/user.entity';

const makeComment = (overrides: Partial<Comment> = {}): Comment =>
  ({
    id: 1,
    ticketId: 10,
    authorId: 1,
    content: 'Hello world',
    version: 1,
    mentions: [],
    ...overrides,
  }) as Comment;

describe('CommentsService', () => {
  let service: CommentsService;
  let commentRepo: { create: jest.Mock; save: jest.Mock; findOne: jest.Mock; find: jest.Mock; remove: jest.Mock };
  let mentionRepo: { delete: jest.Mock; create: jest.Mock; save: jest.Mock };
  let userRepo: { findBy: jest.Mock };

  beforeEach(async () => {
    commentRepo = {
      create: jest.fn((dto) => ({ ...dto })),
      save: jest.fn((c) => Promise.resolve({ id: 1, version: 1, ...c })),
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      remove: jest.fn().mockResolvedValue(undefined),
    };
    mentionRepo = {
      delete: jest.fn().mockResolvedValue(undefined),
      create: jest.fn((dto) => dto),
      save: jest.fn().mockResolvedValue([]),
    };
    userRepo = { findBy: jest.fn().mockResolvedValue([]) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommentsService,
        { provide: getRepositoryToken(Comment), useValue: commentRepo },
        { provide: getRepositoryToken(Mention), useValue: mentionRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
      ],
    }).compile();

    service = module.get<CommentsService>(CommentsService);
  });

  describe('create', () => {
    it('U-C1: @mention in content creates a Mention for the matched user', async () => {
      const jdoe = { id: 2, username: 'jdoe', fullName: 'J Doe' };
      userRepo.findBy.mockResolvedValue([jdoe]);
      const savedComment = makeComment({ content: 'Hello @jdoe!', mentions: [{ user: jdoe, userId: 2, commentId: 1 } as Mention] });
      commentRepo.findOne.mockResolvedValue(savedComment);

      const result = await service.create({ content: 'Hello @jdoe!', authorId: 1 }, 10);

      expect(userRepo.findBy).toHaveBeenCalled();
      expect(mentionRepo.save).toHaveBeenCalledTimes(1);
      expect(result.mentionedUsers).toContainEqual(
        expect.objectContaining({ username: 'jdoe' }),
      );
    });

    it('U-C2: @unknownuser mention is ignored when user does not exist', async () => {
      userRepo.findBy.mockResolvedValue([]);
      commentRepo.findOne.mockResolvedValue(makeComment({ content: 'Hey @ghost!', mentions: [] }));

      const result = await service.create({ content: 'Hey @ghost!', authorId: 1 }, 10);

      expect(mentionRepo.save).not.toHaveBeenCalled();
      expect(result.mentionedUsers).toHaveLength(0);
    });
  });

  describe('update', () => {
    it('U-C3: update syncs mentions — new mention added, dropped mention removed', async () => {
      const existing = makeComment({ content: 'Hello @alice', mentions: [] });
      commentRepo.findOne.mockResolvedValueOnce(existing);

      const bob = { id: 3, username: 'bob', fullName: 'Bob' };
      userRepo.findBy.mockResolvedValue([bob]);
      const afterUpdate = makeComment({ content: 'Hello @bob', mentions: [{ user: bob, userId: 3, commentId: 1 } as Mention] });
      commentRepo.findOne.mockResolvedValueOnce(afterUpdate);

      const result = await service.update(1, 10, { content: 'Hello @bob' });

      expect(mentionRepo.delete).toHaveBeenCalledWith({ commentId: 1 });
      expect(result.mentionedUsers).toContainEqual(expect.objectContaining({ username: 'bob' }));
    });

    it('U-C4: update with same version succeeds', async () => {
      const existing = makeComment({ version: 2 });
      commentRepo.findOne.mockResolvedValueOnce(existing);
      commentRepo.save.mockResolvedValue({ ...existing, content: 'Updated' });
      commentRepo.findOne.mockResolvedValueOnce({ ...existing, content: 'Updated', mentions: [] });

      const result = await service.update(1, 10, { content: 'Updated', version: 2 });

      expect(result.content).toBe('Updated');
    });

    it('U-C5: concurrent comment edits throw ConflictException (optimistic locking)', async () => {
      commentRepo.findOne.mockResolvedValue(makeComment());
      const err = new Error('mismatch');
      err.name = 'OptimisticLockVersionMismatchError';
      commentRepo.save.mockRejectedValue(err);

      await expect(service.update(1, 10, { content: 'Race condition', version: 1 })).rejects.toThrow(ConflictException);
    });
  });

  describe('remove', () => {
    it('U-C6: delete removes the comment and its mentions are cascade-deleted', async () => {
      const existing = makeComment({ mentions: [] });
      commentRepo.findOne.mockResolvedValue(existing);

      await service.remove(1, 10);

      expect(commentRepo.remove).toHaveBeenCalledWith(existing);
    });

    it('remove comment from wrong ticket throws NotFoundException', async () => {
      commentRepo.findOne.mockResolvedValue(makeComment({ ticketId: 99 }));

      await expect(service.remove(1, 10)).rejects.toThrow(NotFoundException);
    });
  });
});
