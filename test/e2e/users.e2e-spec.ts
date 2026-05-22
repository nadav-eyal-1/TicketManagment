import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { clearDatabase, createApp, login } from '../helpers/create-app';

describe('Users (E2E)', () => {
  let app: INestApplication;
  let adminToken: string;
  let createdUserId: number;

  beforeAll(async () => {
    app = await createApp();
    await request(app.getHttpServer())
      .post('/users')
      .send({ username: 'useradmin', email: 'useradmin@test.com', password: 'pass123', fullName: 'User Admin', role: 'ADMIN' });
    adminToken = await login(app, 'useradmin', 'pass123');
  });

  afterAll(async () => {
    await clearDatabase(app);
    await app.close();
  });

  it('E-U1: POST /users with valid fields → 200', async () => {
    const res = await request(app.getHttpServer())
      .post('/users')
      .send({ username: 'devuser', email: 'devuser@test.com', password: 'pass123', fullName: 'Dev User', role: 'DEVELOPER' })
      .expect(200);
    expect(res.body).toHaveProperty('id');
    createdUserId = res.body.id;
  });

  it('E-U2: POST /users with duplicate username → 409', () => {
    return request(app.getHttpServer())
      .post('/users')
      .send({ username: 'devuser', email: 'other@test.com', password: 'pass123', fullName: 'Dup User' })
      .expect(409);
  });

  it('E-U3: POST /users with invalid role → 400', () => {
    return request(app.getHttpServer())
      .post('/users')
      .send({ username: 'roletest', email: 'roletest@test.com', password: 'pass123', fullName: 'Role Test', role: 'SUPERUSER' })
      .expect(400);
  });

  it('E-U4: GET /users → 200 array', async () => {
    const res = await request(app.getHttpServer())
      .get('/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(2);
  });

  it('E-U5: GET /users/:userId with valid ID → 200', async () => {
    const res = await request(app.getHttpServer())
      .get(`/users/${createdUserId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body.username).toBe('devuser');
  });

  it('E-U6: GET /users/:userId non-existent → 404', () => {
    return request(app.getHttpServer())
      .get('/users/999999')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);
  });

  it('E-U7: POST /users/update/:userId changes fullName → 200', async () => {
    const res = await request(app.getHttpServer())
      .post(`/users/update/${createdUserId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ fullName: 'Updated Dev User' })
      .expect(200);
    expect(res.body.fullName).toBe('Updated Dev User');
  });

  it('E-U8: DELETE /users/:userId → 200', () => {
    return request(app.getHttpServer())
      .delete(`/users/${createdUserId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
  });

  it('E-U9: DELETE /users/:userId non-existent → 404', () => {
    return request(app.getHttpServer())
      .delete('/users/999999')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);
  });
});
