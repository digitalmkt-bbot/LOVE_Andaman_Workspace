import { Writable } from 'node:stream';
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';
import { loadConfig } from '../config.js';
import { ErrorEnvelope, RateTypeListResponse } from '@la/contracts';

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

describe('GET /v1/rate-types', () => {
  it('returns an empty page and echoes the pagination defaults', async () => {
    const app = await buildApp(config);
    const res = await app.inject({ method: 'GET', url: '/v1/rate-types' });
    expect(res.statusCode).toBe(200);

    // Validated against the shared contract rather than hand-checked, so a
    // drift in @la/contracts fails here.
    const parsed = RateTypeListResponse.safeParse(res.json());
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data).toEqual({ items: [], total: 0, limit: 50, offset: 0 });
    await app.close();
  });

  it('rejects a limit above the cap with the standard 400 envelope', async () => {
    const { lines, stream } = captureLogs();
    // `warn` so the rejection is actually emitted; the default test level is fatal.
    const app = await buildApp(loadConfig({ NODE_ENV: 'test', LOG_LEVEL: 'warn' }), {
      logStream: stream,
    });

    const res = await app.inject({ method: 'GET', url: '/v1/rate-types?limit=500' });
    expect(res.statusCode).toBe(400);

    const parsed = ErrorEnvelope.safeParse(res.json());
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;

    expect(parsed.data.error.code).toBe('VALIDATION_FAILED');
    expect(parsed.data.error.details).toBeTruthy();
    // A bug report quoting the id has to be findable in the logs.
    expect(lines.join('\n')).toContain(parsed.data.error.requestId);
    await app.close();
  });

  it('rejects a non-numeric limit rather than coercing it to the default', async () => {
    const app = await buildApp(config);
    const res = await app.inject({ method: 'GET', url: '/v1/rate-types?limit=lots' });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: { code: 'VALIDATION_FAILED' } });
    await app.close();
  });

  it('rejects a mistyped active flag instead of silently returning the wrong page', async () => {
    // The whole reason `active` is an enum and not z.coerce.boolean(): coercion
    // maps every non-empty string to true, so `flase` would look like a filter
    // that worked.
    const app = await buildApp(config);
    const res = await app.inject({ method: 'GET', url: '/v1/rate-types?active=flase' });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: { code: 'VALIDATION_FAILED' } });
    await app.close();
  });

  it('accepts the documented filters', async () => {
    const app = await buildApp(config);
    const res = await app.inject({
      method: 'GET',
      url: '/v1/rate-types?limit=10&offset=20&active=true&q=DMC',
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ limit: 10, offset: 20 });
    await app.close();
  });
});

describe('GET /v1/rate-types/:id', () => {
  it('returns a 404 envelope for an id that does not exist', async () => {
    const app = await buildApp(config);
    const res = await app.inject({ method: 'GET', url: `/v1/rate-types/${randomUUID()}` });
    expect(res.statusCode).toBe(404);

    const parsed = ErrorEnvelope.safeParse(res.json());
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.error.code).toBe('NOT_FOUND');
    expect(parsed.success && parsed.data.error.requestId).toBeTruthy();
    await app.close();
  });

  it('rejects a malformed id as a validation error, not a 404', async () => {
    // The route param is the surrogate uuid. `rt001` is a monolith blob id and
    // is exposed read-only as `legacyId`, so it is not a valid path segment.
    const app = await buildApp(config);
    const res = await app.inject({ method: 'GET', url: '/v1/rate-types/rt001' });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: { code: 'VALIDATION_FAILED' } });
    await app.close();
  });

  it('does not leak the connection string or a driver error code', async () => {
    const app = await buildApp(config);
    const res = await app.inject({ method: 'GET', url: `/v1/rate-types/${randomUUID()}` });
    const body = JSON.stringify(res.json());
    expect(body).not.toContain('postgres');
    expect(body).not.toContain('ECONNREFUSED');
    await app.close();
  });
});

describe('openapi', () => {
  it('documents both rate-type routes', async () => {
    const app = await buildApp(config);
    const res = await app.inject({ method: 'GET', url: '/docs/json' });
    expect(res.statusCode).toBe(200);

    const doc = res.json();
    expect(Object.keys(doc.paths)).toEqual(
      expect.arrayContaining(['/v1/rate-types', '/v1/rate-types/{id}']),
    );

    // The querystring schema must have reached the document, otherwise "one
    // definition drives both validation and docs" is not true.
    const params = doc.paths['/v1/rate-types'].get.parameters ?? [];
    const names = params.map((p: { name: string }) => p.name);
    expect(names).toEqual(expect.arrayContaining(['limit', 'offset', 'active', 'q']));

    // The detail route declares a 404, so a client can see the failure mode
    // without reading the source.
    expect(doc.paths['/v1/rate-types/{id}'].get.responses['404']).toBeTruthy();
    await app.close();
  });
});
