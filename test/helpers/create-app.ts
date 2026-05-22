import { ClassSerializerInterceptor, INestApplication, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { HttpExceptionFilter } from '../../src/common/filters/http-exception.filter';

export async function createApp(): Promise<INestApplication> {
  const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = module.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));
  await app.init();
  return app;
}

export async function clearDatabase(app: INestApplication): Promise<void> {
  const ds = app.get(DataSource);
  await ds.query(
    `TRUNCATE TABLE mentions, comments, ticket_dependencies, attachments, audit_logs, tickets, projects, users RESTART IDENTITY CASCADE`,
  );
}

export async function login(
  app: INestApplication,
  username: string,
  password: string,
): Promise<string> {
  const res = await request(app.getHttpServer())
    .post('/auth/login')
    .send({ username, password });
  return res.body.accessToken as string;
}
