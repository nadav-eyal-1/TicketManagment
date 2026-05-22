import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { clearDatabase, createApp, login } from '../helpers/create-app';

describe('Projects (E2E)', () => {
  let app: INestApplication;
  let adminToken: string;
  let devToken: string;
  let projectId: number;
  let adminId: number;

  beforeAll(async () => {
    app = await createApp();
    const adminRes = await request(app.getHttpServer())
      .post('/users')
      .send({ username: 'projadmin', email: 'projadmin@test.com', password: 'pass123', fullName: 'Proj Admin', role: 'ADMIN' });
    adminId = adminRes.body.id;
    const devRes = await request(app.getHttpServer())
      .post('/users')
      .send({ username: 'projdev', email: 'projdev@test.com', password: 'pass123', fullName: 'Proj Dev', role: 'DEVELOPER' });
    adminToken = await login(app, 'projadmin', 'pass123');
    devToken = await login(app, 'projdev', 'pass123');
  });

  afterAll(async () => {
    await clearDatabase(app);
    await app.close();
  });

  it('E-P1: POST /projects → 200', async () => {
    const res = await request(app.getHttpServer())
      .post('/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Test Project', description: 'A test project', ownerId: adminId })
      .expect(200);
    expect(res.body).toHaveProperty('id');
    projectId = res.body.id;
  });

  it('E-P2: GET /projects excludes deleted → 200 array', async () => {
    const res = await request(app.getHttpServer())
      .get('/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.some((p: any) => p.id === projectId)).toBe(true);
  });

  it('E-P3: GET /projects/:projectId → 200', async () => {
    const res = await request(app.getHttpServer())
      .get(`/projects/${projectId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body.name).toBe('Test Project');
  });

  it('E-P4: GET /projects/:projectId non-existent → 404', () => {
    return request(app.getHttpServer())
      .get('/projects/999999')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);
  });

  it('E-P5: PATCH /projects/:projectId updates name → 200', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/projects/${projectId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Renamed Project' })
      .expect(200);
    expect(res.body.name).toBe('Renamed Project');
  });

  it('E-P6: DELETE /projects/:projectId soft-deletes → 200', () => {
    return request(app.getHttpServer())
      .delete(`/projects/${projectId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
  });

  it('E-P7: deleted project absent from GET /projects', async () => {
    const res = await request(app.getHttpServer())
      .get('/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body.some((p: any) => p.id === projectId)).toBe(false);
  });

  it('E-P8: GET /projects/deleted (ADMIN) → 200 with deleted project', async () => {
    const res = await request(app.getHttpServer())
      .get('/projects/deleted')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body.some((p: any) => p.id === projectId)).toBe(true);
  });

  it('E-P9: POST /projects/:projectId/restore (ADMIN) → 200', () => {
    return request(app.getHttpServer())
      .post(`/projects/${projectId}/restore`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
  });

  it('E-P10: restored project reappears in GET /projects', async () => {
    const res = await request(app.getHttpServer())
      .get('/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body.some((p: any) => p.id === projectId)).toBe(true);
  });

  describe('Workload', () => {
    it('E-W1: GET /projects/:projectId/workload → 200 sorted array', async () => {
      const res = await request(app.getHttpServer())
        .get(`/projects/${projectId}/workload`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('E-W2: GET /projects/:projectId/workload non-existent → 404', () => {
      return request(app.getHttpServer())
        .get('/projects/999999/workload')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });
  });
});
