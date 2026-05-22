import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ProjectsModule } from './projects/projects.module';
import { TicketsModule } from './tickets/tickets.module';
import { CommentsModule } from './comments/comments.module';
import { AuditLogsModule } from './audit-logs/audit-logs.module';
import { DependenciesModule } from './dependencies/dependencies.module';
import { AttachmentsModule } from './attachments/attachments.module';
import { SchedulerModule } from './scheduler/scheduler.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST ?? 'localhost',
      port: parseInt(process.env.DB_PORT ?? '5432', 10),
      username: process.env.DB_USER ?? 'issueflow',
      password: process.env.DB_PASS ?? 'issueflow',
      database: process.env.DB_NAME ?? 'issueflow',
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      synchronize: true,
    }),
    ScheduleModule.forRoot(),
    AuthModule,
    UsersModule,
    ProjectsModule,
    TicketsModule,
    CommentsModule,
    AuditLogsModule,
    DependenciesModule,
    AttachmentsModule,
    SchedulerModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
