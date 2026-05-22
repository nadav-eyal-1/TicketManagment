import {
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
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '../common/enums/user-role.enum';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectsService } from './projects.service';

@UseGuards(JwtAuthGuard)
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  create(@Body() dto: CreateProjectDto) {
    return this.projectsService.create(dto);
  }

  @Get()
  findAll() {
    return this.projectsService.findAll();
  }

  @Get('deleted')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  findDeleted() {
    return this.projectsService.findDeleted();
  }
  
  @Get(':projectId/workload')
  getWorkload(@Param('projectId', ParseIntPipe) id: number) {
    return this.projectsService.getWorkload(id);
  }

  @Get(':projectId')
  findOne(@Param('projectId', ParseIntPipe) id: number) {
    return this.projectsService.findOne(id);
  }

  @Patch(':projectId')
  update(@Param('projectId', ParseIntPipe) id: number, @Body() dto: UpdateProjectDto) {
    return this.projectsService.update(id, dto);
  }

  @Delete(':projectId')
  remove(@Param('projectId', ParseIntPipe) id: number) {
    return this.projectsService.remove(id);
  }

  @Post(':projectId/restore')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  restore(@Param('projectId', ParseIntPipe) id: number) {
    return this.projectsService.restore(id);
  }
}
