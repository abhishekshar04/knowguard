import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';

import { ApiExceptionFilter } from './common/api-exception.filter';
import type { ApiEnv } from './config/api-env';

export const API_PREFIX = 'api/v1';

/**
 * HTTP-level configuration shared by production bootstrap and e2e tests,
 * so tests exercise exactly the middleware stack that ships.
 */
export function configureApp(app: INestApplication, env: ApiEnv): void {
  const expressApp = app as NestExpressApplication;
  expressApp.set('trust proxy', env.NODE_ENV === 'production' ? 1 : false);
  expressApp.useBodyParser('json', { limit: '1mb' });

  app.setGlobalPrefix(API_PREFIX);
  app.use(helmet());
  app.enableCors({
    origin: env.WEB_ORIGIN,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  });
  app.useGlobalFilters(new ApiExceptionFilter());
  app.enableShutdownHooks();
}
