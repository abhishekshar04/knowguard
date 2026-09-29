import type { Logger } from '@knowguard/logger';
import type { Job } from 'bullmq';

import { JobRegistry } from './registry';

const logger = { child: () => logger } as unknown as Logger;
const job = (name: string) => ({ id: '1', name, data: {} }) as unknown as Job;

describe('JobRegistry', () => {
  it('dispatches to the registered handler', async () => {
    const registry = new JobRegistry().register('PING', async () => 'pong');
    await expect(registry.dispatch(job('PING'), logger)).resolves.toBe('pong');
  });

  it('fails unknown jobs instead of acknowledging them', async () => {
    await expect(new JobRegistry().dispatch(job('NOPE'), logger)).rejects.toThrow(/No handler/);
  });

  it('rejects duplicate registrations', () => {
    const registry = new JobRegistry().register('PING', async () => undefined);
    expect(() => registry.register('PING', async () => undefined)).toThrow(/Duplicate/);
  });
});
