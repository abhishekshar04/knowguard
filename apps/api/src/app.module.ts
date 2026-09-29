import { type DynamicModule, Module } from '@nestjs/common';

import { InfrastructureModule } from './common/infrastructure.module';
import { API_ENV, type ApiEnv } from './config/api-env';
import { HealthModule } from './health/health.module';

/**
 * Root module. Feature modules (auth, organizations, users, ...) are added per phase.
 * Configuration is injected rather than read from process.env so tests can boot
 * the app against an isolated environment.
 */
@Module({})
export class AppModule {
  static forRoot(env: ApiEnv): DynamicModule {
    return {
      module: AppModule,
      global: true,
      providers: [{ provide: API_ENV, useValue: Object.freeze(env) }],
      exports: [API_ENV],
      imports: [InfrastructureModule, HealthModule],
    };
  }
}
