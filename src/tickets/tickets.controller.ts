import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '../common/enums/user-role.enum';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { TicketsService } from './tickets.service';

@UseGuards(JwtAuthGuard)
@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  create(@Body() dto: CreateTicketDto) {
    return this.ticketsService.create(dto);
  }

  @Get('deleted')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  findDeleted(@Query('projectId', ParseIntPipe) projectId: number) {
    return this.ticketsService.findDeleted(projectId);
  }

  @Get('export')
  async exportCsv(
    @Query('projectId', ParseIntPipe) projectId: number,
  ): Promise<StreamableFile> {
    const buffer = await this.ticketsService.exportCsv(projectId);
    return new StreamableFile(buffer, {
      type: 'text/csv',
      disposition: `attachment; filename="tickets-${projectId}.csv"`,
    });
  }

  @Post('import')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      fileFilter: (_req, file, cb) => {
        if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
          cb(null, true);
        } else {
          cb(new BadRequestException('Only CSV files are allowed'), false);
        }
      },
    }),
  )
  importCsv(
    @UploadedFile() file: Express.Multer.File,
    @Body('projectId') projectIdStr: string,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    const projectId = parseInt(projectIdStr, 10);
    if (isNaN(projectId)) {
      throw new BadRequestException('projectId must be a number');
    }
    return this.ticketsService.importCsv(projectId, file.buffer);
  }

  @Get()
  findAll(@Query('projectId', ParseIntPipe) projectId: number) {
    return this.ticketsService.findAll(projectId);
  }

  @Get(':ticketId')
  findOne(@Param('ticketId', ParseIntPipe) ticketId: number) {
    return this.ticketsService.findOne(ticketId);
  }

  @Patch(':ticketId')
  update(
    @Param('ticketId', ParseIntPipe) ticketId: number,
    @Body() dto: UpdateTicketDto,
  ) {
    return this.ticketsService.update(ticketId, dto);
  }

  @Delete(':ticketId')
  remove(@Param('ticketId', ParseIntPipe) ticketId: number) {
    return this.ticketsService.remove(ticketId);
  }

  @Post(':ticketId/restore')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  restore(@Param('ticketId', ParseIntPipe) ticketId: number) {
    return this.ticketsService.restore(ticketId);
  }
}
