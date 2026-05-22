import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { clearDatabase, createApp } from '../helpers/create-app';

describe('Auth (E2E)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createApp();
    await request(app.getHttpServer())
      .post('/users')
      .send({ username: 'authadmin', email: 'authadmin@test.com', password: 'secret123', fullName: 'Auth Admin', role: 'ADMIN' });
  });

  afterAll(async () => {
    await clearDatabase(app);
    await app.close();
  });

  it('E-A1: POST /auth/login with valid credentials → 200 + accessToken', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'authadmin', password: 'secret123' })
      .expect(200);
    expect(res.body).toHaveProperty('accessToken');
    expect(typeof res.body.accessToken).toBe('string');
    expect(res.body).toHaveProperty('tokenType', 'Bearer');
    expect(res.body).toHaveProperty('expiresIn', 3600);
  });

  it('E-A2: POST /auth/login with wrong password → 401', () => {
    return request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'authadmin', password: 'wrongpassword' })
      .expect(401);
  });

  it('E-A3: POST /auth/login with missing field → 400', () => {
    return request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'authadmin' })
      .expect(400);
  });

  it('E-A4: POST /auth/logout with valid token → 200', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'authadmin', password: 'secret123' });
    const token = loginRes.body.accessToken;

    await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });

  it('E-A5: calling protected endpoint after logout → 401', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'authadmin', password: 'secret123' });
    const token = loginRes.body.accessToken;

    await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Authorization', `Bearer ${token}`);

    return request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);
  });

  it('E-A6: GET /auth/me with valid token → 200 + user data', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'authadmin', password: 'secret123' });
    const token = loginRes.body.accessToken;

    const res = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body).toHaveProperty('username', 'authadmin');
  });

  it('E-A7: GET /auth/me without token → 401', () => {
    return request(app.getHttpServer()).get('/auth/me').expect(401);
  });
});
