import 'reflect-metadata';

import { createLogger } from '@knowguard/logger';
import { apiEnvSchema, parseEnv } from '@knowguard/validation';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';

import { AppModule } from './app.module';
import { API_PREFIX, configureApp } from './bootstrap';
import { PinoNestLogger } from './common/pino-nest-logger';

async function main(): Promise<void> {
  const env = parseEnv(apiEnvSchema, process.env);
  const logger = createLogger({ name: 'api', level: env.LOG_LEVEL, pretty: env.NODE_ENV === 'development' });

  const app = await NestFactory.create<NestExpressApplication>(AppModule.forRoot(env), {
    logger: new PinoNestLogger(logger),
    bodyParser: false, // configured explicitly (with size limits) in configureApp
  });
  configureApp(app, env);

  await app.listen(env.API_PORT);
  logger.info(`API listening on http://localhost:${env.API_PORT}/${API_PREFIX}`);
}

main().catch((error: unknown) => {
  // Logger may not exist yet (e.g. invalid env), so fall back to stderr.
  // eslint-disable-next-line no-console
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
