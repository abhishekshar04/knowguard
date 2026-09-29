import type { NextFunction, Request, Response } from 'express';

type TrustFn = (address: string, hop: number) => boolean;

/**
 * Detects a TRUST_PROXY misconfiguration at runtime.
 *
 * The Next.js BFF always sends X-Forwarded-For. If that header arrives from a peer that
 * TRUST_PROXY does not trust, Express ignores it and every user is rate-limited as the BFF's
 * IP — one attacker could then block logins for everyone. Detecting it on real traffic (rather
 * than guessing at startup) gives no false alarms when the BFF legitimately runs on loopback.
 * Warns once per process to avoid log floods.
 */
export function createUntrustedForwardingDetector(warn: (message: string) => void) {
  let warned = false;
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!warned && req.headers['x-forwarded-for'] !== undefined) {
      const peer = req.socket.remoteAddress ?? '';
      const trust = req.app.get('trust proxy fn') as TrustFn | undefined;
      if (!trust || !trust(peer, 0)) {
        warned = true;
        warn(
          `Received X-Forwarded-For from ${peer || 'an unknown peer'}, which TRUST_PROXY does not trust. ` +
            `Per-IP rate limits are applying to that peer's address instead of the client's, so all ` +
            `users share one limit. Set TRUST_PROXY to the web BFF's address or subnet (see ADR 0005).`,
        );
      }
    }
    next();
  };
}
