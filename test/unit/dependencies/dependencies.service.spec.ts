import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DependenciesService } from 'src/dependencies/dependencies.service';
import { Ticket } from 'src/entities/ticket.entity';
import { TicketDependency } from 'src/entities/ticket-dependency.entity';
import { TicketStatus } from 'src/common/enums/ticket-status.enum';

const makeTicket = (id: number, projectId = 10, status = TicketStatus.TODO): Partial<Ticket> =>
  ({ id, projectId, status }) as Ticket;

describe('DependenciesService', () => {
  let service: DependenciesService;
  let ticketRepo: { findOneBy: jest.Mock };
  let depRepo: { findOneBy: jest.Mock; find: jest.Mock; create: jest.Mock; save: jest.Mock; remove: jest.Mock };

  beforeEach(async () => {
    ticketRepo = { findOneBy: jest.fn() };
    depRepo = {
      findOneBy: jest.fn().mockResolvedValue(null),
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn((dto) => dto),
      save: jest.fn().mockResolvedValue({}),
      remove: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DependenciesService,
        { provide: getRepositoryToken(Ticket), useValue: ticketRepo },
        { provide: getRepositoryToken(TicketDependency), useValue: depRepo },
      ],
    }).compile();

    service = module.get<DependenciesService>(DependenciesService);
  });

  describe('addDependency', () => {
    it('U-D1: add dependency where both tickets are in the same project — saved successfully', async () => {
      ticketRepo.findOneBy
        .mockResolvedValueOnce(makeTicket(1, 10))
        .mockResolvedValueOnce(makeTicket(2, 10));

      await expect(service.addDependency(1, 2)).resolves.toBeUndefined();
      expect(depRepo.save).toHaveBeenCalledTimes(1);
    });

    it('U-D2: tickets in different projects throws BadRequestException', async () => {
      ticketRepo.findOneBy
        .mockResolvedValueOnce(makeTicket(1, 10))
        .mockResolvedValueOnce(makeTicket(2, 99));

      await expect(service.addDependency(1, 2)).rejects.toThrow(BadRequestException);
    });

    it('U-D3: self-dependency throws BadRequestException', async () => {
      await expect(service.addDependency(5, 5)).rejects.toThrow(BadRequestException);
    });
  });

  describe('getDependencies', () => {
    it('U-D7: list returns blockers with id, title, status', async () => {
      ticketRepo.findOneBy.mockResolvedValue(makeTicket(1));
      depRepo.find.mockResolvedValue([
        { blocker: { id: 2, title: 'Blocker A', status: TicketStatus.IN_PROGRESS } },
      ]);

      const result = await service.getDependencies(1);

      expect(result).toEqual([{ id: 2, title: 'Blocker A', status: TicketStatus.IN_PROGRESS }]);
    });
  });

  describe('removeDependency', () => {
    it('U-D6: remove a dependency deletes the relation', async () => {
      const dep = { blockedId: 1, blockerId: 2 };
      depRepo.findOneBy.mockResolvedValue(dep);

      await service.removeDependency(1, 2);

      expect(depRepo.remove).toHaveBeenCalledWith(dep);
    });

    it('remove non-existent dependency throws NotFoundException', async () => {
      depRepo.findOneBy.mockResolvedValue(null);

      await expect(service.removeDependency(1, 2)).rejects.toThrow(NotFoundException);
    });
  });

  describe('allBlockersDone', () => {
    it('U-D4: returns false when any blocker is not DONE', async () => {
      depRepo.find.mockResolvedValue([
        { blocker: { status: TicketStatus.DONE } },
        { blocker: { status: TicketStatus.IN_PROGRESS } },
      ]);

      await expect(service.allBlockersDone(1)).resolves.toBe(false);
    });

    it('U-D5: returns true when all blockers are DONE', async () => {
      depRepo.find.mockResolvedValue([
        { blocker: { status: TicketStatus.DONE } },
        { blocker: { status: TicketStatus.DONE } },
      ]);

      await expect(service.allBlockersDone(1)).resolves.toBe(true);
    });

    it('returns true when there are no blockers', async () => {
      depRepo.find.mockResolvedValue([]);

      await expect(service.allBlockersDone(1)).resolves.toBe(true);
    });
  });
});
