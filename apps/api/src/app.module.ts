import { type DynamicModule, Module } from '@nestjs/common';

import { AuthModule } from './auth/auth.module';
import { InfrastructureModule } from './common/infrastructure.module';
import { DocumentsModule } from './documents/documents.module';
import { API_ENV, type ApiEnv } from './config/api-env';
import { HealthModule } from './health/health.module';
import { InvitationsModule } from './invitations/invitations.module';
import { MembersModule } from './members/members.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { RolesModule } from './roles/roles.module';
import { SearchModule } from './search/search.module';
import { StructureModule } from './structure/structure.module';

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
      imports: [
        InfrastructureModule,
        AuthModule,
        OrganizationsModule,
        MembersModule,
        InvitationsModule,
        RolesModule,
        StructureModule,
        DocumentsModule,
        SearchModule,
        HealthModule,
      ],
    };
  }
}
