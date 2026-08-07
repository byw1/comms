import { describe, it, expect } from 'vitest';
import {
  checkServerUrl,
  diagnoseConnectionError,
} from '../src/bluebubbles/diagnose.js';

describe('checkServerUrl', () => {
  it('rejects localhost — the most common real-world mistake', () => {
    const d = checkServerUrl('http://localhost:1234');
    expect(d?.problem).toBe('local-address');
    expect(d?.hint).toMatch(/proxy/i);
  });

  it('rejects private LAN ranges', () => {
    for (const host of ['192.168.1.50', '10.0.0.4', '172.16.5.5', '127.0.0.1']) {
      expect(checkServerUrl(`http://${host}:1234`)?.problem).toBe('local-address');
    }
  });

  it('rejects .local bonjour names', () => {
    expect(checkServerUrl('http://marks-mac-mini.local:1234')?.problem).toBe('local-address');
  });

  it('flags a missing scheme and suggests the fix', () => {
    const d = checkServerUrl('abc.trycloudflare.com');
    expect(d?.problem).toBe('no-scheme');
    expect(d?.hint).toContain('https://abc.trycloudflare.com');
  });

  it('flags an empty address', () => {
    expect(checkServerUrl('   ')?.problem).toBe('bad-url');
  });

  it('accepts a normal public tunnel address', () => {
    expect(checkServerUrl('https://calm-forest-1234.trycloudflare.com')).toBeNull();
    expect(checkServerUrl('https://msg.example.com')).toBeNull();
  });

  it('does not mistake a public IP for a private one', () => {
    expect(checkServerUrl('http://172.32.1.1:1234')).toBeNull();
    expect(checkServerUrl('http://11.0.0.1:1234')).toBeNull();
  });
});

describe('diagnoseConnectionError', () => {
  it('turns a bare "fetch failed" into something actionable', () => {
    const d = diagnoseConnectionError(new Error('BlueBubbles GET server/info request error: fetch failed'));
    expect(d.problem).toBe('unreachable');
    expect(d.message).not.toMatch(/fetch failed/);
    expect(d.hint.length).toBeGreaterThan(20);
  });

  it('prefers a URL problem over the raw error', () => {
    const d = diagnoseConnectionError(new Error('fetch failed'), 'http://localhost:1234');
    expect(d.problem).toBe('local-address');
  });

  it('detects a wrong password from the status code', () => {
    const err = Object.assign(new Error('nope'), { status: 401 });
    expect(diagnoseConnectionError(err).problem).toBe('password');
  });

  it('detects a timeout', () => {
    expect(diagnoseConnectionError(new Error('request timed out')).problem).toBe('timeout');
  });

  it('detects DNS failure and mentions the rotating address', () => {
    const err = Object.assign(new Error('fetch failed'), { cause: { code: 'ENOTFOUND' } });
    const d = diagnoseConnectionError(err);
    expect(d.problem).toBe('dns');
    expect(d.hint).toMatch(/restart/i);
  });

  it('detects a refused connection', () => {
    const err = Object.assign(new Error('fetch failed'), { cause: { code: 'ECONNREFUSED' } });
    expect(diagnoseConnectionError(err).problem).toBe('refused');
  });

  it('detects a TLS problem', () => {
    expect(diagnoseConnectionError(new Error('SELF_SIGNED_CERT_IN_CHAIN')).problem).toBe('tls');
  });

  it('never returns an empty message', () => {
    for (const e of [null, undefined, 'boom', new Error('')]) {
      expect(diagnoseConnectionError(e).message.length).toBeGreaterThan(0);
    }
  });
});
