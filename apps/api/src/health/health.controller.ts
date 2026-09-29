import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import type { HealthResponse } from '@knowguard/types';
import type { Response } from 'express';

import { Public } from '../auth/auth.decorators';
import { HealthService } from './health.service';

/**
 * Public liveness/readiness endpoint. Reports only up/down per dependency —
 * never hostnames, versions of dependencies, or error details.
 */
@Public()
@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get()
  async get(@Res({ passthrough: true }) res: Response): Promise<HealthResponse> {
    const result = await this.health.check();
    res.setHeader('Cache-Control', 'no-store');
    if (result.status !== 'ok') res.status(HttpStatus.SERVICE_UNAVAILABLE);
    return result;
  }
}
