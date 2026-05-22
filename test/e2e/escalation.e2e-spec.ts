import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { clearDatabase, createApp, login } from '../helpers/create-app';
import { EscalationService } from '../../src/scheduler/escalation.service';

describe('Auto-Escalation (Integration)', () => {
  let app: INestApplication;
  let adminToken: string;
  let adminId: number;
  let projectId: number;

  beforeAll(async () => {
    app = await createApp();

    const adminRes = await request(app.getHttpServer())
      .post('/users')
      .send({ username: 'escaladmin', email: 'escaladmin@test.com', password: 'pass123', fullName: 'Escal Admin', role: 'ADMIN' });
    adminId = adminRes.body.id;

    adminToken = await login(app, 'escaladmin', 'pass123');

    const projRes = await request(app.getHttpServer())
      .post('/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Escal Project', ownerId: adminId });
    projectId = projRes.body.id;
  });

  afterAll(async () => {
    await clearDatabase(app);
    await app.close();
  });

  it('I-E1: overdue LOW ticket escalates to MEDIUM and creates audit entry', async () => {
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const ticketRes = await request(app.getHttpServer())
      .post('/tickets')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Overdue LOW Ticket', projectId, type: 'BUG', priority: 'LOW', dueDate: pastDate });
    const ticketId = ticketRes.body.id;

    // Invoke the cron job directly
    const escalationService = app.get(EscalationService);
    await escalationService.escalateOverdueTickets();

    const res = await request(app.getHttpServer())
      .get(`/tickets/${ticketId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body.priority).toBe('MEDIUM');

    // Confirm audit log was created
    await new Promise((r) => setTimeout(r, 100));
    const auditRes = await request(app.getHttpServer())
      .get(`/audit-logs?entityId=${ticketId}&action=ESCALATE`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const escalateEntry = auditRes.body.find((e: any) => e.entityId === ticketId && e.action === 'ESCALATE');
    expect(escalateEntry).toBeDefined();
    expect(escalateEntry.actor).toBe('SYSTEM');
  });

  it('I-E2: CRITICAL ticket remains CRITICAL after escalation run', async () => {
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const ticketRes = await request(app.getHttpServer())
      .post('/tickets')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Already CRITICAL Ticket', projectId, type: 'BUG', priority: 'CRITICAL', dueDate: pastDate });
    const ticketId = ticketRes.body.id;

    const escalationService = app.get(EscalationService);
    await escalationService.escalateOverdueTickets();

    const res = await request(app.getHttpServer())
      .get(`/tickets/${ticketId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body.priority).toBe('CRITICAL');
  });
});
