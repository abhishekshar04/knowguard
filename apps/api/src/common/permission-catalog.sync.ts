import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { syncPermissionCatalog } from '@knowguard/database';

import { PrismaService } from './prisma.service';

/**
 * Ensures the `permissions` table matches the code catalog in every environment
 * (the dev seed is not run in production). Idempotent and cheap.
 */
@Injectable()
export class PermissionCatalogSync implements OnApplicationBootstrap {
  private readonly logger = new Logger(PermissionCatalogSync.name);

  constructor(private readonly prisma: PrismaService) {}

  async onApplicationBootstrap(): Promise<void> {
    try {
      const ids = await syncPermissionCatalog(this.prisma);
      this.logger.log(`Permission catalog synced (${ids.size} permissions)`);
    } catch (error) {
      // Registration fails loudly (loadPermissionIds) until this succeeds; don't crash boot.
      this.logger.error(`Permission catalog sync failed: ${(error as Error).message}`);
    }
  }
}
