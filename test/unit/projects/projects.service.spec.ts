import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ProjectsService } from 'src/projects/projects.service';
import { Project } from 'src/entities/project.entity';
import { Ticket } from 'src/entities/ticket.entity';
import { User } from 'src/entities/user.entity';

const makeQbMock = (getRawManyResult: unknown[] = []) => {
  const qb: Record<string, jest.Mock> = {};
  const chain = ['leftJoin', 'where', 'groupBy', 'select', 'addSelect', 'orderBy'];
  chain.forEach((m) => { qb[m] = jest.fn().mockReturnThis(); });
  qb['getRawMany'] = jest.fn().mockResolvedValue(getRawManyResult);
  return qb;
};

describe('ProjectsService', () => {
  let service: ProjectsService;
  let projectRepo: {
    create: jest.Mock;
    save: jest.Mock;
    findOneBy: jest.Mock;
    find: jest.Mock;
    softRemove: jest.Mock;
    findOne: jest.Mock;
    restore: jest.Mock;
  };
  let userRepo: { createQueryBuilder: jest.Mock };

  beforeEach(async () => {
    projectRepo = {
      create: jest.fn((dto) => ({ ...dto })),
      save: jest.fn((entity) => Promise.resolve({ id: 1, ...entity })),
      findOneBy: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      softRemove: jest.fn().mockResolvedValue(undefined),
      findOne: jest.fn(),
      restore: jest.fn().mockResolvedValue(undefined),
    };
    userRepo = { createQueryBuilder: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectsService,
        { provide: getRepositoryToken(Project), useValue: projectRepo },
        { provide: getRepositoryToken(Ticket), useValue: {} },
        { provide: getRepositoryToken(User), useValue: userRepo },
      ],
    }).compile();

    service = module.get<ProjectsService>(ProjectsService);
  });

  describe('create', () => {
    it('U-P1: creates and returns saved entity', async () => {
      const result = await service.create({ name: 'Alpha', description: 'desc', ownerId: 1 });

      expect(projectRepo.save).toHaveBeenCalledTimes(1);
      expect(result).toMatchObject({ name: 'Alpha' });
    });
  });

  describe('findOne', () => {
    it('U-P2: unknown ID throws NotFoundException', async () => {
      projectRepo.findOneBy.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove (soft delete)', () => {
    it('U-P3: softDelete calls softRemove (sets deletedAt via TypeORM)', async () => {
      projectRepo.findOneBy.mockResolvedValue({ id: 1, name: 'Alpha', deletedAt: null });

      await service.remove(1);

      expect(projectRepo.softRemove).toHaveBeenCalledTimes(1);
    });
  });

  describe('findAll', () => {
    it('U-P4: findAll calls find() without withDeleted (TypeORM excludes soft-deleted)', async () => {
      projectRepo.find.mockResolvedValue([{ id: 1, name: 'Alpha', deletedAt: null }]);

      const results = await service.findAll();

      expect(projectRepo.find).toHaveBeenCalledWith();
      expect(results).toHaveLength(1);
    });
  });

  describe('restore', () => {
    it('U-P5: restore clears deletedAt via repository restore call', async () => {
      const deletedProject = { id: 1, name: 'Alpha', deletedAt: new Date() };
      const restoredProject = { id: 1, name: 'Alpha', deletedAt: null };
      projectRepo.findOne.mockResolvedValue(deletedProject);
      projectRepo.findOneBy.mockResolvedValue(restoredProject);

      const result = await service.restore(1);

      expect(projectRepo.restore).toHaveBeenCalledWith(1);
      expect(result.deletedAt).toBeNull();
    });

    it('U-P6: restore on non-deleted project throws NotFoundException', async () => {
      projectRepo.findOne.mockResolvedValue({ id: 1, deletedAt: null });

      await expect(service.restore(1)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getWorkload', () => {
    it('U-W1: returns only DEVELOPER rows (as provided by query)', async () => {
      projectRepo.findOneBy.mockResolvedValue({ id: 1, name: 'Alpha' });
      const qb = makeQbMock([{ userId: '2', username: 'dev1', openTicketCount: '3' }]);
      userRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getWorkload(1);

      expect(result).toEqual([{ userId: 2, username: 'dev1', openTicketCount: 3 }]);
    });

    it('U-W2: openTicketCount is correctly parsed from string to number', async () => {
      projectRepo.findOneBy.mockResolvedValue({ id: 1 });
      const qb = makeQbMock([{ userId: '5', username: 'dev', openTicketCount: '7' }]);
      userRepo.createQueryBuilder.mockReturnValue(qb);

      const [entry] = await service.getWorkload(1);

      expect(entry.openTicketCount).toBe(7);
      expect(typeof entry.openTicketCount).toBe('number');
    });

    it('U-W3: result order reflects raw query order (sorted ascending)', async () => {
      projectRepo.findOneBy.mockResolvedValue({ id: 1 });
      const qb = makeQbMock([
        { userId: '1', username: 'dev_low', openTicketCount: '1' },
        { userId: '2', username: 'dev_high', openTicketCount: '5' },
      ]);
      userRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getWorkload(1);

      expect(result[0].openTicketCount).toBeLessThanOrEqual(result[1].openTicketCount);
    });

    it('U-W4: project with no developers returns empty array', async () => {
      projectRepo.findOneBy.mockResolvedValue({ id: 1 });
      const qb = makeQbMock([]);
      userRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getWorkload(1);

      expect(result).toEqual([]);
    });

    it('non-existent project throws NotFoundException', async () => {
      projectRepo.findOneBy.mockResolvedValue(null);

      await expect(service.getWorkload(999)).rejects.toThrow(NotFoundException);
    });
  });
});
