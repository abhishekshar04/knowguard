import express from 'express';
import type { Request, Response } from 'express';

import { parseTrustProxy } from '../bootstrap';
import { createUntrustedForwardingDetector } from './untrusted-forwarding.detector';

function requestFrom(peer: string, trustProxy: string, forwardedFor?: string): Request {
  const app = express();
  app.set('trust proxy', parseTrustProxy(trustProxy));
  return {
    app,
    socket: { remoteAddress: peer },
    headers: forwardedFor ? { 'x-forwarded-for': forwardedFor } : {},
  } as unknown as Request;
}

function run(detector: ReturnType<typeof createUntrustedForwardingDetector>, req: Request) {
  const next = jest.fn();
  detector(req, {} as Response, next);
  expect(next).toHaveBeenCalledTimes(1);
}

describe('untrusted X-Forwarded-For detector', () => {
  it('warns when a forwarding peer is not trusted (BFF on another host, TRUST_PROXY=loopback)', () => {
    const warn = jest.fn();
    run(createUntrustedForwardingDetector(warn), requestFrom('10.0.4.7', 'loopback', '203.0.113.9'));
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('10.0.4.7');
    expect(warn.mock.calls[0][0]).toContain('TRUST_PROXY');
  });

  it.each([
    ['loopback BFF with the default setting', '127.0.0.1', 'loopback'],
    ['IPv6 loopback BFF', '::1', 'loopback'],
    ['BFF subnet configured', '10.0.4.7', '10.0.0.0/16'],
    ['explicit hop count', '10.0.4.7', '1'],
  ])('stays quiet for a trusted peer: %s', (_label, peer, trustProxy) => {
    const warn = jest.fn();
    run(createUntrustedForwardingDetector(warn), requestFrom(peer, trustProxy, '203.0.113.9'));
    expect(warn).not.toHaveBeenCalled();
  });

  it('stays quiet when no X-Forwarded-For is sent', () => {
    const warn = jest.fn();
    run(createUntrustedForwardingDetector(warn), requestFrom('10.0.4.7', 'loopback'));
    expect(warn).not.toHaveBeenCalled();
  });

  it('warns only once per process', () => {
    const warn = jest.fn();
    const detector = createUntrustedForwardingDetector(warn);
    for (let i = 0; i < 5; i++) run(detector, requestFrom('10.0.4.7', 'false', '203.0.113.9'));
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
