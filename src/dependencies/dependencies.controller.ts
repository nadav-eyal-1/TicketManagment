import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DependenciesService } from './dependencies.service';
import { AddDependencyDto } from './dto/add-dependency.dto';

@UseGuards(JwtAuthGuard)
@Controller('tickets/:ticketId/dependencies')
export class DependenciesController {
  constructor(private readonly dependenciesService: DependenciesService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  addDependency(
    @Param('ticketId', ParseIntPipe) ticketId: number,
    @Body() dto: AddDependencyDto,
  ) {
    return this.dependenciesService.addDependency(ticketId, dto.blockedBy);
  }

  @Get()
  getDependencies(@Param('ticketId', ParseIntPipe) ticketId: number) {
    return this.dependenciesService.getDependencies(ticketId);
  }

  @Delete(':blockerId')
  removeDependency(
    @Param('ticketId', ParseIntPipe) ticketId: number,
    @Param('blockerId', ParseIntPipe) blockerId: number,
  ) {
    return this.dependenciesService.removeDependency(ticketId, blockerId);
  }
}
