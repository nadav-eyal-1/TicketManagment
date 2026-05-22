import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { clearDatabase, createApp, login } from '../helpers/create-app';

describe('Dependencies (E2E)', () => {
  let app: INestApplication;
  let adminToken: string;
  let adminId: number;
  let projectId: number;
  let projectId2: number;
  let ticketA: number;
  let ticketB: number;
  let ticketOtherProject: number;

  beforeAll(async () => {
    app = await createApp();

    const adminRes = await request(app.getHttpServer())
      .post('/users')
      .send({ username: 'depadmin', email: 'depadmin@test.com', password: 'pass123', fullName: 'Dep Admin', role: 'ADMIN' });
    adminId = adminRes.body.id;

    adminToken = await login(app, 'depadmin', 'pass123');

    const proj1Res = await request(app.getHttpServer())
      .post('/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Dep Project 1', ownerId: adminId });
    projectId = proj1Res.body.id;

    const proj2Res = await request(app.getHttpServer())
      .post('/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Dep Project 2', ownerId: adminId });
    projectId2 = proj2Res.body.id;

    const tARes = await request(app.getHttpServer())
      .post('/tickets')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Ticket A', projectId, type: 'BUG' });
    ticketA = tARes.body.id;

    const tBRes = await request(app.getHttpServer())
      .post('/tickets')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Ticket B (blocker)', projectId, type: 'BUG' });
    ticketB = tBRes.body.id;

    const tOtherRes = await request(app.getHttpServer())
      .post('/tickets')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Ticket Other Project', projectId: projectId2, type: 'BUG' });
    ticketOtherProject = tOtherRes.body.id;
  });

  afterAll(async () => {
    await clearDatabase(app);
    await app.close();
  });

  it('E-D1: POST /tickets/:ticketId/dependencies with valid same-project blocker → 200', async () => {
    await request(app.getHttpServer())
      .post(`/tickets/${ticketA}/dependencies`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ blockedBy: ticketB })
      .expect(200);
  });

  it('E-D3: GET /tickets/:ticketId/dependencies → 200 with blocker list', async () => {
    const res = await request(app.getHttpServer())
      .get(`/tickets/${ticketA}/dependencies`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(1);
    expect(res.body[0].id).toBe(ticketB);
    expect(res.body[0]).toHaveProperty('title');
    expect(res.body[0]).toHaveProperty('status');
  });

  it('E-D2: POST dependency across projects → 400', () => {
    return request(app.getHttpServer())
      .post(`/tickets/${ticketA}/dependencies`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ blockedBy: ticketOtherProject })
      .expect(400);
  });

  it('E-D4: PATCH ticket to DONE with unresolved blocker → 400', async () => {
    // Advance ticketA to IN_PROGRESS first
    await request(app.getHttpServer())
      .patch(`/tickets/${ticketA}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'IN_PROGRESS' });
    await request(app.getHttpServer())
      .patch(`/tickets/${ticketA}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'IN_REVIEW' });

    // Try to mark DONE while ticketB (blocker) is still TODO
    return request(app.getHttpServer())
      .patch(`/tickets/${ticketA}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'DONE' })
      .expect(400);
  });

  it('E-D5: PATCH ticket to DONE after all blockers resolved → 200', async () => {
    // Resolve ticketB (the blocker) by advancing to DONE
    await request(app.getHttpServer())
      .patch(`/tickets/${ticketB}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'IN_PROGRESS' });
    await request(app.getHttpServer())
      .patch(`/tickets/${ticketB}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'IN_REVIEW' });
    await request(app.getHttpServer())
      .patch(`/tickets/${ticketB}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'DONE' });

    // Now ticketA can be marked DONE (already at IN_REVIEW from E-D4)
    const res = await request(app.getHttpServer())
      .patch(`/tickets/${ticketA}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'DONE' })
      .expect(200);
    expect(res.body.status).toBe('DONE');
  });

  it('E-D6: DELETE /tickets/:ticketId/dependencies/:blockerId → 200', async () => {
    // Create a fresh pair of tickets to test removal
    const tCRes = await request(app.getHttpServer())
      .post('/tickets')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Ticket C', projectId, type: 'BUG' });
    const ticketC = tCRes.body.id;

    const tDRes = await request(app.getHttpServer())
      .post('/tickets')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Ticket D blocker', projectId, type: 'BUG' });
    const ticketD = tDRes.body.id;

    await request(app.getHttpServer())
      .post(`/tickets/${ticketC}/dependencies`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ blockedBy: ticketD })
      .expect(200);

    await request(app.getHttpServer())
      .delete(`/tickets/${ticketC}/dependencies/${ticketD}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    // Confirm dependency is gone
    const res = await request(app.getHttpServer())
      .get(`/tickets/${ticketC}/dependencies`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body.length).toBe(0);
  });
});
