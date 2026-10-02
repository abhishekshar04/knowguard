import { type INestApplication, Logger } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';

import { ApiExceptionFilter } from './common/api-exception.filter';
import { requestContextMiddleware } from './common/request-context';
import { createUntrustedForwardingDetector } from './common/untrusted-forwarding.detector';
import type { ApiEnv } from './config/api-env';

export const API_PREFIX = 'api/v1';

/**
 * HTTP-level configuration shared by production bootstrap and e2e tests,
 * so tests exercise exactly the middleware stack that ships.
 */
export function configureApp(app: INestApplication, env: ApiEnv): void {
  const expressApp = app as NestExpressApplication;
  expressApp.set('trust proxy', parseTrustProxy(env.TRUST_PROXY));
  expressApp.useBodyParser('json', { limit: '1mb' });

  app.setGlobalPrefix(API_PREFIX);
  app.use(helmet());
  // After "trust proxy" is set, so the recorded client IP is the resolved one.
  app.use(requestContextMiddleware);
  const proxyLogger = new Logger('TrustProxy');
  app.use(createUntrustedForwardingDetector((message) => proxyLogger.warn(message)));
  // No CORS: browsers never call the API directly (they go through the Next.js BFF), so
  // cross-origin browser requests are refused by default.
  app.useGlobalFilters(new ApiExceptionFilter());
  app.enableShutdownHooks();
}

/** Maps TRUST_PROXY to Express' setting: "true"/"false", a hop count, or address/subnet list. */
export function parseTrustProxy(value: string): boolean | number | string {
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (/^\d+$/.test(value)) return Number(value);
  return value;
}
