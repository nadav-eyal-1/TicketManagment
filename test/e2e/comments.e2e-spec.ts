import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { clearDatabase, createApp, login } from '../helpers/create-app';

describe('Comments & Mentions (E2E)', () => {
  let app: INestApplication;
  let adminToken: string;
  let adminId: number;
  let mentionedUserId: number;
  let projectId: number;
  let ticketId: number;
  let commentId: number;

  beforeAll(async () => {
    app = await createApp();

    const adminRes = await request(app.getHttpServer())
      .post('/users')
      .send({ username: 'commentadmin', email: 'commentadmin@test.com', password: 'pass123', fullName: 'Comment Admin', role: 'ADMIN' });
    adminId = adminRes.body.id;

    const mentionRes = await request(app.getHttpServer())
      .post('/users')
      .send({ username: 'mentionme', email: 'mentionme@test.com', password: 'pass123', fullName: 'Mention Me', role: 'DEVELOPER' });
    mentionedUserId = mentionRes.body.id;

    adminToken = await login(app, 'commentadmin', 'pass123');

    const projRes = await request(app.getHttpServer())
      .post('/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Comment Project', ownerId: adminId });
    projectId = projRes.body.id;

    const ticketRes = await request(app.getHttpServer())
      .post('/tickets')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Comment Ticket', projectId, type: 'BUG' });
    ticketId = ticketRes.body.id;
  });

  afterAll(async () => {
    await clearDatabase(app);
    await app.close();
  });

  it('E-C1: GET /tickets/:ticketId/comments → 200 array', async () => {
    const res = await request(app.getHttpServer())
      .get(`/tickets/${ticketId}/comments`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('E-C2: POST comment with @mention → 200 with mentionedUsers resolved', async () => {
    const res = await request(app.getHttpServer())
      .post(`/tickets/${ticketId}/comments`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ authorId: adminId, content: 'Hello @mentionme, please review!' })
      .expect(200);
    expect(res.body).toHaveProperty('id');
    expect(Array.isArray(res.body.mentionedUsers)).toBe(true);
    expect(res.body.mentionedUsers.some((u: any) => u.username === 'mentionme')).toBe(true);
    commentId = res.body.id;
  });

  it('E-C3: POST comment to non-existent ticket → 404 or 500 (FK constraint)', async () => {
    const res = await request(app.getHttpServer())
      .post('/tickets/999999/comments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ authorId: adminId, content: 'Orphan comment' });
    expect([404, 500]).toContain(res.status);
  });

  it('E-C4: PATCH comment → 200 with updated content', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/tickets/${ticketId}/comments/${commentId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ content: 'Updated content without mention' })
      .expect(200);
    expect(res.body.content).toBe('Updated content without mention');
  });

  it('E-C5: PATCH removes stale mention → 200 with empty mentionedUsers', async () => {
    const res = await request(app.getHttpServer())
      .get(`/tickets/${ticketId}/comments`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const comment = res.body.find((c: any) => c.id === commentId);
    expect(comment.mentionedUsers).toHaveLength(0);
  });

  it('E-C6: DELETE comment → 200', () => {
    return request(app.getHttpServer())
      .delete(`/tickets/${ticketId}/comments/${commentId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
  });

  it('E-C7: GET /users/:userId/mentions → 200 { data, total, page }', async () => {
    // Add a comment mentioning mentionedUserId first
    await request(app.getHttpServer())
      .post(`/tickets/${ticketId}/comments`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ authorId: adminId, content: 'Hey @mentionme!' });

    const res = await request(app.getHttpServer())
      .get(`/users/${mentionedUserId}/mentions`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('total');
    expect(res.body).toHaveProperty('page');
    expect(res.body.total).toBeGreaterThan(0);
  });

  it('E-C8: GET /users/:userId/mentions?page=1&pageSize=5 → 200', async () => {
    const res = await request(app.getHttpServer())
      .get(`/users/${mentionedUserId}/mentions?page=1&pageSize=5`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body.page).toBe(1);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});
