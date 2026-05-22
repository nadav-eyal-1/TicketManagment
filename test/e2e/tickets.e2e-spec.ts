import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { clearDatabase, createApp, login } from '../helpers/create-app';

describe('Tickets (E2E)', () => {
  let app: INestApplication;
  let adminToken: string;
  let devToken: string;
  let adminId: number;
  let devId: number;
  let projectId: number;
  let ticketId: number;

  beforeAll(async () => {
    app = await createApp();

    const adminRes = await request(app.getHttpServer())
      .post('/users')
      .send({ username: 'ticketadmin', email: 'ticketadmin@test.com', password: 'pass123', fullName: 'Ticket Admin', role: 'ADMIN' });
    adminId = adminRes.body.id;

    const devRes = await request(app.getHttpServer())
      .post('/users')
      .send({ username: 'ticketdev', email: 'ticketdev@test.com', password: 'pass123', fullName: 'Ticket Dev', role: 'DEVELOPER' });
    devId = devRes.body.id;

    adminToken = await login(app, 'ticketadmin', 'pass123');
    devToken = await login(app, 'ticketdev', 'pass123');

    const projRes = await request(app.getHttpServer())
      .post('/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Ticket Project', ownerId: adminId });
    projectId = projRes.body.id;
  });

  afterAll(async () => {
    await clearDatabase(app);
    await app.close();
  });

  // ── CRUD ──────────────────────────────────────────────────────────────────

  describe('CRUD', () => {
    it('E-T1: POST /tickets with all fields → 200', async () => {
      const res = await request(app.getHttpServer())
        .post('/tickets')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'First Ticket', description: 'desc', projectId, priority: 'LOW', type: 'BUG' })
        .expect(200);
      expect(res.body).toHaveProperty('id');
      ticketId = res.body.id;
    });

    it('E-T2: POST /tickets missing required field → 400', () => {
      return request(app.getHttpServer())
        .post('/tickets')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ description: 'no title', projectId })
        .expect(400);
    });

    it('E-T3: GET /tickets?projectId → 200 array', async () => {
      const res = await request(app.getHttpServer())
        .get(`/tickets?projectId=${projectId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });

    it('E-T4: GET /tickets/:ticketId → 200', async () => {
      const res = await request(app.getHttpServer())
        .get(`/tickets/${ticketId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(res.body.title).toBe('First Ticket');
    });

    it('E-T5: GET /tickets/:ticketId non-existent → 404', () => {
      return request(app.getHttpServer())
        .get('/tickets/999999')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });

    it('E-T6: PATCH /tickets/:ticketId updates title → 200', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/tickets/${ticketId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'Updated Ticket' })
        .expect(200);
      expect(res.body.title).toBe('Updated Ticket');
    });
  });

  // ── Status Lifecycle ──────────────────────────────────────────────────────

  describe('Status Lifecycle', () => {
    let slTicketId: number;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post('/tickets')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'SL Ticket', projectId, type: 'TECHNICAL' });
      slTicketId = res.body.id;
    });

    it('E-SL1: valid forward transition TODO → IN_PROGRESS → 200', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/tickets/${slTicketId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'IN_PROGRESS' })
        .expect(200);
      expect(res.body.status).toBe('IN_PROGRESS');
    });

    it('E-SL2: invalid backward transition IN_PROGRESS → TODO → 400', () => {
      return request(app.getHttpServer())
        .patch(`/tickets/${slTicketId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'TODO' })
        .expect(400);
    });

    it('E-SL3: update DONE ticket → 400', async () => {
      // Advance to DONE: IN_PROGRESS → IN_REVIEW → DONE
      await request(app.getHttpServer())
        .patch(`/tickets/${slTicketId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'IN_REVIEW' });
      await request(app.getHttpServer())
        .patch(`/tickets/${slTicketId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'DONE' });

      return request(app.getHttpServer())
        .patch(`/tickets/${slTicketId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'Try to update DONE' })
        .expect(400);
    });
  });

  // ── Optimistic Locking ────────────────────────────────────────────────────

  describe('Optimistic Locking', () => {
    let olTicketId: number;
    let currentVersion: number;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post('/tickets')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'OL Ticket', projectId, type: 'TECHNICAL' });
      olTicketId = res.body.id;
      currentVersion = res.body.version;
    });

    it('E-OL2: PATCH with correct version → 200 and version incremented', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/tickets/${olTicketId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ version: currentVersion, title: 'OL Updated' })
        .expect(200);
      expect(res.body.version).toBe(currentVersion + 1);
      currentVersion = res.body.version;
    });

    it('E-OL1: PATCH with stale version → 409', () => {
      return request(app.getHttpServer())
        .patch(`/tickets/${olTicketId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ version: currentVersion - 1, title: 'Stale update' })
        .expect(409);
    });
  });

  // ── Auto-Assignment ───────────────────────────────────────────────────────

  describe('Auto-Assignment', () => {
    it('E-AA1: ticket created without assigneeId gets auto-assigned to a developer', async () => {
      const res = await request(app.getHttpServer())
        .post('/tickets')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'Auto Assign Ticket', projectId, type: 'TECHNICAL' })
        .expect(200);
      expect(res.body.assigneeId).toBe(devId);
    });

    it('E-AA2: audit log contains AUTO_ASSIGN entry after auto-assignment', async () => {
      const res = await request(app.getHttpServer())
        .get('/audit-logs?action=AUTO_ASSIGN')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body[0].actor).toBe('SYSTEM');
    });
  });

  // ── Soft Delete & Restore ─────────────────────────────────────────────────

  describe('Soft Delete & Restore', () => {
    let sdTicketId: number;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post('/tickets')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'SD Ticket', projectId, type: 'TECHNICAL' });
      sdTicketId = res.body.id;
    });

    it('E-SD1: soft-deleted ticket disappears from normal list', async () => {
      await request(app.getHttpServer())
        .delete(`/tickets/${sdTicketId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const res = await request(app.getHttpServer())
        .get(`/tickets?projectId=${projectId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(res.body.some((t: any) => t.id === sdTicketId)).toBe(false);
    });

    it('E-SD2: GET /tickets/deleted?projectId (ADMIN) → 200 with deleted ticket', async () => {
      const res = await request(app.getHttpServer())
        .get(`/tickets/deleted?projectId=${projectId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(res.body.some((t: any) => t.id === sdTicketId)).toBe(true);
    });

    it('E-SD5: GET /tickets/deleted as non-ADMIN → 403', () => {
      return request(app.getHttpServer())
        .get(`/tickets/deleted?projectId=${projectId}`)
        .set('Authorization', `Bearer ${devToken}`)
        .expect(403);
    });

    it('E-SD3: POST /tickets/:ticketId/restore (ADMIN) → 200', () => {
      return request(app.getHttpServer())
        .post(`/tickets/${sdTicketId}/restore`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });

    it('E-SD4: restored ticket reappears in normal list', async () => {
      const res = await request(app.getHttpServer())
        .get(`/tickets?projectId=${projectId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(res.body.some((t: any) => t.id === sdTicketId)).toBe(true);
    });
  });

  // ── CSV Export / Import ───────────────────────────────────────────────────

  describe('CSV Export / Import', () => {
    it('E-CSV1: GET /tickets/export?projectId → 200 text/csv', async () => {
      const res = await request(app.getHttpServer())
        .get(`/tickets/export?projectId=${projectId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(res.headers['content-type']).toMatch(/text\/csv/);
    });

    it('E-CSV3: POST /tickets/import with valid CSV → 200 { created, failed, errors }', async () => {
      const csv = 'title,description,status,priority,type,assigneeId\nImported Ticket,desc,TODO,LOW,BUG,\n';
      const res = await request(app.getHttpServer())
        .post('/tickets/import')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', Buffer.from(csv), { filename: 'tickets.csv', contentType: 'text/csv' })
        .field('projectId', String(projectId))
        .expect(200);
      expect(res.body.created).toBe(1);
      expect(res.body.failed).toBe(0);
    });

    it('E-CSV4: POST /tickets/import with partial failures → 200 with errors array', async () => {
      const csv = 'title,description,status,priority,type,assigneeId\nGood Ticket,desc,,,BUG,\n,empty title row,,,,\n';
      const res = await request(app.getHttpServer())
        .post('/tickets/import')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', Buffer.from(csv), { filename: 'tickets.csv', contentType: 'text/csv' })
        .field('projectId', String(projectId))
        .expect(200);
      expect(res.body.created).toBe(1);
      expect(res.body.failed).toBe(1);
      expect(res.body.errors.length).toBe(1);
    });

    it('E-CSV2: GET /tickets/export with unknown projectId → 200 empty CSV', async () => {
      const res = await request(app.getHttpServer())
        .get('/tickets/export?projectId=999999')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(res.headers['content-type']).toMatch(/text\/csv/);
      // Only the header row, no data rows
      const lines = (res.text as string).trim().split('\n').filter(Boolean);
      expect(lines.length).toBe(1);
    });

    it('E-CSV5: POST /tickets/import with non-CSV file → 400', () => {
      return request(app.getHttpServer())
        .post('/tickets/import')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', Buffer.from('not a csv file'), { filename: 'data.txt', contentType: 'text/plain' })
        .field('projectId', String(projectId))
        .expect(400);
    });

    it('E-CSV6: POST /tickets/import without projectId → 400', () => {
      const csv = 'title\nTest\n';
      return request(app.getHttpServer())
        .post('/tickets/import')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', Buffer.from(csv), { filename: 'tickets.csv', contentType: 'text/csv' })
        .expect(400);
    });

    it('E-T7: DELETE /tickets/:ticketId (soft-delete) → 200', () => {
      return request(app.getHttpServer())
        .delete(`/tickets/${ticketId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });
  });
});
