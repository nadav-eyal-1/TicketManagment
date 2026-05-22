import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { clearDatabase, createApp, login } from '../helpers/create-app';

describe('Audit Logs (E2E)', () => {
  let app: INestApplication;
  let adminToken: string;
  let adminId: number;
  let projectId: number;
  let ticketId: number;

  beforeAll(async () => {
    app = await createApp();

    const adminRes = await request(app.getHttpServer())
      .post('/users')
      .send({ username: 'auditadmin', email: 'auditadmin@test.com', password: 'pass123', fullName: 'Audit Admin', role: 'ADMIN' });
    adminId = adminRes.body.id;

    adminToken = await login(app, 'auditadmin', 'pass123');

    const projRes = await request(app.getHttpServer())
      .post('/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Audit Project', ownerId: adminId });
    projectId = projRes.body.id;

    const ticketRes = await request(app.getHttpServer())
      .post('/tickets')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Audit Ticket', projectId, type: 'BUG' });
    ticketId = ticketRes.body.id;
  });

  afterAll(async () => {
    await clearDatabase(app);
    await app.close();
  });

  it('E-AL1: GET /audit-logs → 200 array', async () => {
    const res = await request(app.getHttpServer())
      .get('/audit-logs')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('E-AL2: GET /audit-logs?entityType=TICKET → 200 only TICKET entries', async () => {
    const res = await request(app.getHttpServer())
      .get('/audit-logs?entityType=TICKET')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    res.body.forEach((entry: any) => {
      expect(entry.entityType).toBe('TICKET');
    });
  });

  it('E-AL3: GET /audit-logs?entityId=<ticketId> → 200 entries for that entity', async () => {
    const res = await request(app.getHttpServer())
      .get(`/audit-logs?entityId=${ticketId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    res.body.forEach((entry: any) => {
      expect(entry.entityId).toBe(ticketId);
    });
  });

  it('E-AL4: GET /audit-logs?action=CREATE → 200 only CREATE entries', async () => {
    const res = await request(app.getHttpServer())
      .get('/audit-logs?action=CREATE')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    res.body.forEach((entry: any) => {
      expect(entry.action).toBe('CREATE');
    });
  });

  it('E-AL5: GET /audit-logs?actor=SYSTEM → 200 only SYSTEM entries', async () => {
    // Trigger auto-assignment which creates a SYSTEM audit entry
    const devRes = await request(app.getHttpServer())
      .post('/users')
      .send({ username: 'auditdev', email: 'auditdev@test.com', password: 'pass123', fullName: 'Audit Dev', role: 'DEVELOPER' });

    await request(app.getHttpServer())
      .post('/tickets')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Auto Assign For Audit', projectId, type: 'TASK' });

    const res = await request(app.getHttpServer())
      .get('/audit-logs?actor=SYSTEM')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    res.body.forEach((entry: any) => {
      expect(entry.actor).toBe('SYSTEM');
    });
  });

  it('E-AL6: creating a ticket produces an audit entry', async () => {
    const ticketRes = await request(app.getHttpServer())
      .post('/tickets')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Audit Entry Ticket', projectId, type: 'FEATURE' });
    const newTicketId = ticketRes.body.id;

    // The interceptor logs asynchronously (fire-and-forget); give it a moment to flush.
    await new Promise((r) => setTimeout(r, 150));

    const res = await request(app.getHttpServer())
      .get('/audit-logs?entityType=TICKET&action=CREATE')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body.length).toBeGreaterThan(0);
    const entry = res.body.find((e: any) => e.entityId === newTicketId);
    expect(entry).toBeDefined();
    expect(entry.action).toBe('CREATE');
  });
});
