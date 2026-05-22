import {
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { Attachment } from '../entities/attachment.entity';
import { Ticket } from '../entities/ticket.entity';

export type AttachmentResponse = Pick<
  Attachment,
  'id' | 'ticketId' | 'filename' | 'contentType'
>;

@Injectable()
export class AttachmentsService implements OnModuleInit {
  constructor(
    @InjectRepository(Attachment)
    private readonly attachmentRepo: Repository<Attachment>,
    @InjectRepository(Ticket)
    private readonly ticketRepo: Repository<Ticket>,
  ) {}

  onModuleInit() {
    const dir = path.join(process.cwd(), 'uploads', 'attachments');
    fs.mkdirSync(dir, { recursive: true });
  }

  async upload(
    ticketId: number,
    file: Express.Multer.File,
  ): Promise<AttachmentResponse> {
    const ticket = await this.ticketRepo.findOneBy({ id: ticketId });
    if (!ticket) {
      fs.unlink(file.path, () => undefined);
      throw new NotFoundException(`Ticket ${ticketId} not found`);
    }

    const saved = await this.attachmentRepo.save(
      this.attachmentRepo.create({
        ticketId,
        filename: file.originalname,
        contentType: file.mimetype,
        filePath: file.path,
      }),
    );

    return { id: saved.id, ticketId: saved.ticketId, filename: saved.filename, contentType: saved.contentType };
  }

  async remove(ticketId: number, attachmentId: number): Promise<void> {
    const attachment = await this.attachmentRepo.findOneBy({
      id: attachmentId,
      ticketId,
    });
    if (!attachment) {
      throw new NotFoundException(`Attachment ${attachmentId} not found`);
    }

    fs.unlink(attachment.filePath, () => undefined);
    await this.attachmentRepo.remove(attachment);
  }
}
