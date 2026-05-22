import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as fs from 'fs';
import { AttachmentsService } from 'src/attachments/attachments.service';
import { Attachment } from 'src/entities/attachment.entity';
import { Ticket } from 'src/entities/ticket.entity';

const makeFile = (mimetype: string, size = 1024): Express.Multer.File =>
  ({
    originalname: 'test.png',
    mimetype,
    path: '/tmp/test-upload',
    size,
    buffer: Buffer.alloc(size),
  }) as unknown as Express.Multer.File;

describe('AttachmentsService', () => {
  let service: AttachmentsService;
  let attachmentRepo: { create: jest.Mock; save: jest.Mock; findOneBy: jest.Mock; remove: jest.Mock };
  let ticketRepo: { findOneBy: jest.Mock };

  beforeEach(async () => {
    attachmentRepo = {
      create: jest.fn((dto) => dto),
      save: jest.fn((a) => Promise.resolve({ id: 1, ...a })),
      findOneBy: jest.fn(),
      remove: jest.fn().mockResolvedValue(undefined),
    };
    ticketRepo = { findOneBy: jest.fn() };

    jest.spyOn(fs, 'mkdirSync').mockReturnValue(undefined);
    jest.spyOn(fs, 'unlink').mockImplementation((_path, cb) => { if (cb) cb(null); });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttachmentsService,
        { provide: getRepositoryToken(Attachment), useValue: attachmentRepo },
        { provide: getRepositoryToken(Ticket), useValue: ticketRepo },
      ],
    }).compile();

    service = module.get<AttachmentsService>(AttachmentsService);
  });

  afterEach(() => jest.restoreAllMocks());

  describe('upload', () => {
    it('U-AT1: upload valid PNG — metadata record is saved', async () => {
      ticketRepo.findOneBy.mockResolvedValue({ id: 1 });
      const file = makeFile('image/png');

      const result = await service.upload(1, file);

      expect(attachmentRepo.save).toHaveBeenCalledTimes(1);
      expect(result).toMatchObject({ ticketId: 1, contentType: 'image/png' });
    });

    it('U-AT4: upload application/pdf is accepted', async () => {
      ticketRepo.findOneBy.mockResolvedValue({ id: 1 });

      const result = await service.upload(1, makeFile('application/pdf'));

      expect(result.contentType).toBe('application/pdf');
    });

    it('U-AT5: upload text/plain is accepted', async () => {
      ticketRepo.findOneBy.mockResolvedValue({ id: 1 });

      const result = await service.upload(1, makeFile('text/plain'));

      expect(result.contentType).toBe('text/plain');
    });

    it('upload to non-existent ticket throws NotFoundException and deletes temp file', async () => {
      ticketRepo.findOneBy.mockResolvedValue(null);

      await expect(service.upload(999, makeFile('image/png'))).rejects.toThrow(NotFoundException);
      expect(fs.unlink).toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('U-AT6: delete removes file from disk and DB record', async () => {
      attachmentRepo.findOneBy.mockResolvedValue({ id: 1, ticketId: 1, filePath: '/uploads/test.png' });

      await service.remove(1, 1);

      expect(fs.unlink).toHaveBeenCalledWith('/uploads/test.png', expect.any(Function));
      expect(attachmentRepo.remove).toHaveBeenCalledTimes(1);
    });

    it('U-AT7: delete non-existent attachment throws NotFoundException', async () => {
      attachmentRepo.findOneBy.mockResolvedValue(null);

      await expect(service.remove(1, 999)).rejects.toThrow(NotFoundException);
    });
  });
});
