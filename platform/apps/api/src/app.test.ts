import { describe, expect, it } from 'vitest';
import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { ErrorEnvelope } from '@la/contracts';

const config = loadConfig({ NODE_ENV: 'test', LOG_LEVEL: 'fatal' });

describe('api skeleton', () => {
  it('reports healthy', async () => {
    const app = await buildApp(config);
    const res = await app.inject({ method: 'GET', url: '/healthz' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
    await app.close();
  });

  it('returns the standard error envelope on an unknown route', async () => {
    const app = await buildApp(config);
    const res = await app.inject({ method: 'GET', url: '/nope' });
    expect(res.statusCode).toBe(404);

    // The envelope is validated against the shared contract, not hand-checked —
    // if the shape drifts from @la/contracts this test fails.
    const parsed = ErrorEnvelope.safeParse(res.json());
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.error.code).toBe('NOT_FOUND');
    expect(parsed.success && parsed.data.error.requestId).toBeTruthy();
    await app.close();
  });

  it('reports not-ready when no database is configured', async () => {
    const app = await buildApp(config);
    const res = await app.inject({ method: 'GET', url: '/readyz' });
    expect(res.statusCode).toBe(503);
    await app.close();
  });
});

describe('config', () => {
  it('rejects a bad port instead of starting', () => {
    expect(() => loadConfig({ PORT: '70000' })).toThrow(/Invalid environment/);
  });
});
