import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { clearDatabase, createApp, login } from '../helpers/create-app';

describe('Attachments (E2E)', () => {
  let app: INestApplication;
  let adminToken: string;
  let adminId: number;
  let projectId: number;
  let ticketId: number;
  let attachmentId: number;

  beforeAll(async () => {
    app = await createApp();

    const adminRes = await request(app.getHttpServer())
      .post('/users')
      .send({ username: 'attachadmin', email: 'attachadmin@test.com', password: 'pass123', fullName: 'Attach Admin', role: 'ADMIN' });
    adminId = adminRes.body.id;

    adminToken = await login(app, 'attachadmin', 'pass123');

    const projRes = await request(app.getHttpServer())
      .post('/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Attach Project', ownerId: adminId });
    projectId = projRes.body.id;

    const ticketRes = await request(app.getHttpServer())
      .post('/tickets')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Attach Ticket', projectId, type: 'BUG' });
    ticketId = ticketRes.body.id;
  });

  afterAll(async () => {
    await clearDatabase(app);
    await app.close();
  });

  it('E-AT1: POST /tickets/:ticketId/attachments with valid PNG → 200 metadata', async () => {
    const pngBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64',
    );
    const res = await request(app.getHttpServer())
      .post(`/tickets/${ticketId}/attachments`)
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('file', pngBuffer, { filename: 'test.png', contentType: 'image/png' })
      .expect(200);
    expect(res.body).toHaveProperty('id');
    expect(res.body.ticketId).toBe(ticketId);
    expect(res.body.contentType).toBe('image/png');
    attachmentId = res.body.id;
  });

  it('E-AT3: POST with invalid MIME type (.exe) → 400', () => {
    return request(app.getHttpServer())
      .post(`/tickets/${ticketId}/attachments`)
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('file', Buffer.from('MZ'), { filename: 'virus.exe', contentType: 'application/octet-stream' })
      .expect(400);
  });

  it('E-AT2: POST with oversized file (> 10 MB) → 413 or 400', async () => {
    const big = Buffer.alloc(11 * 1024 * 1024, 'x');
    const res = await request(app.getHttpServer())
      .post(`/tickets/${ticketId}/attachments`)
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('file', big, { filename: 'big.png', contentType: 'image/png' });
    expect([400, 413]).toContain(res.status);
  });

  it('E-AT4: DELETE /tickets/:ticketId/attachments/:attachmentId → 200', () => {
    return request(app.getHttpServer())
      .delete(`/tickets/${ticketId}/attachments/${attachmentId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
  });

  it('E-AT5: DELETE non-existent attachment → 404', () => {
    return request(app.getHttpServer())
      .delete(`/tickets/${ticketId}/attachments/999999`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);
  });
});
