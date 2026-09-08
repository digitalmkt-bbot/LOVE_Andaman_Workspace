import { Writable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { ErrorEnvelope } from '@la/contracts';

const config = loadConfig({ NODE_ENV: 'test', LOG_LEVEL: 'fatal' });

/** Collects pino output so a test can assert what actually reached the logs. */
function captureLogs() {
  const lines: string[] = [];
  const stream = new Writable({
    write(chunk, _enc, cb) {
      lines.push(String(chunk));
      cb();
    },
  });
  return { lines, stream };
}

describe('api skeleton', () => {
  it('reports healthy', async () => {
    const app = await buildApp(config);
    const res = await app.inject({ method: 'GET', url: '/healthz' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
    await app.close();
  });

  it('returns extra detail when asked verbosely', async () => {
    const app = await buildApp(config);
    const res = await app.inject({ method: 'GET', url: '/healthz?verbose=true' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: 'ok', nodeEnv: 'test' });
    expect(typeof res.json().uptimeSeconds).toBe('number');
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
    expect(res.json()).toEqual({ status: 'no-database', database: false });
    await app.close();
  });
});

describe('request validation (P0-03 acceptance)', () => {
  it('rejects a bad query with a 400 envelope whose requestId is in the logs', async () => {
    const { lines, stream } = captureLogs();
    // `warn` so the rejection is actually emitted; the default test level is fatal.
    const app = await buildApp(loadConfig({ NODE_ENV: 'test', LOG_LEVEL: 'warn' }), {
      logStream: stream,
    });

    const res = await app.inject({ method: 'GET', url: '/healthz?verbose=nope' });
    expect(res.statusCode).toBe(400);

    const parsed = ErrorEnvelope.safeParse(res.json());
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;

    expect(parsed.data.error.code).toBe('VALIDATION_FAILED');
    expect(parsed.data.error.details).toBeTruthy();

    const requestId = parsed.data.error.requestId;
    expect(requestId).toBeTruthy();
    // The whole point of the id: a bug report quoting it can be found in the logs.
    expect(lines.join('\n')).toContain(requestId);

    await app.close();
  });

  it('does not leak an internal error code to the client', async () => {
    const app = await buildApp(config);
    // Mimics pg/Node failing underneath a route: the thrown error carries its
    // own `code`, which must not reach the caller.
    app.get('/boom', async () => {
      const err = new Error('connect ECONNREFUSED 10.0.0.5:5432') as Error & { code: string };
      err.code = 'ECONNREFUSED';
      throw err;
    });

    const res = await app.inject({ method: 'GET', url: '/boom' });
    expect(res.statusCode).toBe(500);
    expect(res.json()).toMatchObject({
      error: { code: 'INTERNAL', message: 'Internal server error' },
    });
    expect(JSON.stringify(res.json())).not.toContain('ECONNREFUSED');
    expect(JSON.stringify(res.json())).not.toContain('10.0.0.5');
    await app.close();
  });
});

describe('openapi', () => {
  it('serves a 3.1 document generated from the zod schemas', async () => {
    const app = await buildApp(config);
    const res = await app.inject({ method: 'GET', url: '/docs/json' });
    expect(res.statusCode).toBe(200);

    const doc = res.json();
    expect(doc.openapi).toBe('3.1.0');
    expect(Object.keys(doc.paths)).toEqual(expect.arrayContaining(['/healthz', '/readyz']));

    // The querystring schema must have made it into the document, otherwise the
    // "one definition drives both validation and docs" claim is not true.
    const params = doc.paths['/healthz'].get.parameters ?? [];
    expect(params.some((p: { name: string }) => p.name === 'verbose')).toBe(true);
    await app.close();
  });
});

describe('config', () => {
  it('rejects a bad port instead of starting', () => {
    expect(() => loadConfig({ PORT: '70000' })).toThrow(/Invalid environment/);
  });

  it('rejects a non-url consumer origin instead of starting', () => {
    expect(() => loadConfig({ CORS_ORIGIN_B2C: 'not-a-url' })).toThrow(/Invalid environment/);
  });
});
