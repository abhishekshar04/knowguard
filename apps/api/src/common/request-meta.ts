import { FORWARDED_USER_AGENT_HEADER } from '@knowguard/types';
import type { Request } from 'express';

export interface RequestMeta {
  /** Client IP as resolved by Express "trust proxy" (see TRUST_PROXY). */
  ip: string;
  userAgent: string | null;
}

/** Informational metadata only — never used for authorization decisions. */
export function requestMeta(req: Request): RequestMeta {
  const forwardedAgent = req.headers[FORWARDED_USER_AGENT_HEADER];
  const agent = (typeof forwardedAgent === 'string' ? forwardedAgent : req.headers['user-agent']) ?? null;
  return {
    ip: req.ip ?? 'unknown',
    userAgent: agent ? agent.slice(0, 512) : null,
  };
}
