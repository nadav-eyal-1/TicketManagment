import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { UsersService } from 'src/users/users.service';
import { User } from 'src/entities/user.entity';
import { Mention } from 'src/entities/mention.entity';
import { UserRole } from 'src/common/enums/user-role.enum';

describe('UsersService', () => {
  let service: UsersService;
  let userRepo: {
    findOne: jest.Mock;
    findOneBy: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    remove: jest.Mock;
    find: jest.Mock;
  };
  let mentionRepo: { findAndCount: jest.Mock };

  beforeEach(async () => {
    userRepo = {
      findOne: jest.fn(),
      findOneBy: jest.fn(),
      create: jest.fn((dto) => ({ ...dto })),
      save: jest.fn((entity) => Promise.resolve({ id: 1, ...entity })),
      remove: jest.fn().mockResolvedValue(undefined),
      find: jest.fn().mockResolvedValue([]),
    };
    mentionRepo = { findAndCount: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: getRepositoryToken(Mention), useValue: mentionRepo },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  describe('create', () => {
    it('U-U1: hashes password before saving', async () => {
      userRepo.findOne.mockResolvedValue(null);

      await service.create({
        username: 'alice',
        email: 'alice@test.com',
        password: 'plaintext',
        fullName: 'Alice',
      });

      const savedArg = userRepo.save.mock.calls[0][0];
      expect(savedArg.password).not.toBe('plaintext');
      await expect(bcrypt.compare('plaintext', savedArg.password)).resolves.toBe(true);
    });

    it('U-U2: invalid role throws BadRequestException', async () => {
      await expect(
        service.create({
          username: 'bob',
          email: 'bob@test.com',
          password: 'pass123',
          fullName: 'Bob',
          role: 'SUPERADMIN' as UserRole,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('duplicate username throws ConflictException', async () => {
      userRepo.findOne.mockResolvedValue({ id: 1, username: 'alice' });

      await expect(
        service.create({ username: 'alice', email: 'new@test.com', password: 'pass123', fullName: 'Alice' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findOne', () => {
    it('U-U3: unknown ID throws NotFoundException', async () => {
      userRepo.findOneBy.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });

    it('known ID returns user', async () => {
      const user = { id: 1, username: 'alice' };
      userRepo.findOneBy.mockResolvedValue(user);

      await expect(service.findOne(1)).resolves.toEqual(user);
    });
  });

  describe('update', () => {
    it('U-U4: updates only provided fields and returns updated entity', async () => {
      const existing = { id: 1, fullName: 'Old Name', role: UserRole.DEVELOPER };
      userRepo.findOneBy.mockResolvedValue(existing);
      userRepo.save.mockResolvedValue({ ...existing, fullName: 'New Name' });

      const result = await service.update(1, { fullName: 'New Name' });

      expect(result.fullName).toBe('New Name');
      expect(result.role).toBe(UserRole.DEVELOPER);
    });
  });

  describe('remove', () => {
    it('U-U5: calls repository remove once', async () => {
      userRepo.findOneBy.mockResolvedValue({ id: 1, username: 'alice' });

      await service.remove(1);

      expect(userRepo.remove).toHaveBeenCalledTimes(1);
    });

    it('remove non-existent user throws NotFoundException', async () => {
      userRepo.findOneBy.mockResolvedValue(null);

      await expect(service.remove(999)).rejects.toThrow(NotFoundException);
    });
  });
});
