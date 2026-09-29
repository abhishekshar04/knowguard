import 'reflect-metadata';

import type { HealthResponse } from '@knowguard/types';
import { apiEnvSchema, parseEnv } from '@knowguard/validation';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';

describe('API (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const env = parseEnv(apiEnvSchema, {
      ...process.env,
      NODE_ENV: 'test',
      DATABASE_URL: process.env.TEST_DATABASE_URL,
      WEB_ORIGIN: 'http://localhost:3000',
    });
    const moduleRef = await Test.createTestingModule({ imports: [AppModule.forRoot(env)] }).compile();
    app = moduleRef.createNestApplication({ bodyParser: false, logger: false });
    configureApp(app, env);
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  describe('GET /api/v1/health', () => {
    it('reports database and redis as up', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/health').expect(200);
      const body = res.body as HealthResponse;
      expect(body.status).toBe('ok');
      expect(body.checks).toEqual({ database: 'up', redis: 'up' });
      expect(res.headers['cache-control']).toBe('no-store');
    });

    it('sends security headers and hides the framework', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/health');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-powered-by']).toBeUndefined();
    });
  });

  describe('CORS', () => {
    it('allows the configured web origin', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/health')
        .set('Origin', 'http://localhost:3000');
      expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000');
      expect(res.headers['access-control-allow-credentials']).toBe('true');
    });

    it('does not allow other origins', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/health')
        .set('Origin', 'https://evil.example');
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });
  });

  describe('error envelope', () => {
    it('returns a uniform NOT_FOUND error for unknown routes without echoing the path', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/does-not-exist').expect(404);
      expect(res.body).toEqual({
        error: { code: 'NOT_FOUND', message: 'The requested resource was not found.' },
      });
      expect(JSON.stringify(res.body)).not.toContain('does-not-exist');
    });

    it('returns a uniform error for malformed JSON bodies', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/health')
        .set('Content-Type', 'application/json')
        .send('{"broken":');
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: { code: 'BAD_REQUEST', message: 'The request is invalid.' } });
      expect(JSON.stringify(res.body)).not.toMatch(/SyntaxError|at JSON\.parse/);
    });

    it('rejects oversized JSON bodies', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/health')
        .set('Content-Type', 'application/json')
        .send(JSON.stringify({ blob: 'x'.repeat(2 * 1024 * 1024) }));
      expect(res.status).toBe(413);
      expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE');
    });
  });
});
