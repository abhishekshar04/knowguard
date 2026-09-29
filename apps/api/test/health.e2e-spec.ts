import type { HealthResponse } from '@knowguard/types';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { createTestApp } from './test-app';

describe('API (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    ({ app } = await createTestApp());
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

  describe('CORS (API is not browser-facing; the Next.js BFF is its only client)', () => {
    it.each(['http://localhost:3000', 'https://evil.example'])(
      'grants no cross-origin access to %s',
      async (origin) => {
        const res = await request(app.getHttpServer()).get('/api/v1/health').set('Origin', origin);
        expect(res.headers['access-control-allow-origin']).toBeUndefined();
        expect(res.headers['access-control-allow-credentials']).toBeUndefined();
      },
    );

    it('does not answer credentialed preflight requests', async () => {
      const res = await request(app.getHttpServer())
        .options('/api/v1/auth/me')
        .set('Origin', 'https://evil.example')
        .set('Access-Control-Request-Method', 'GET')
        .set('Access-Control-Request-Headers', 'authorization');
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
