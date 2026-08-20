import Fastify, { type FastifyError, type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { ErrorEnvelope } from '@la/contracts';
import { getPool, ping } from '@la/db';
import type { Config } from './config.js';

export async function buildApp(config: Config): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: config.LOG_LEVEL,
      // Never log a connection string or an auth header.
      redact: ['req.headers.authorization', 'req.headers.cookie'],
    },
    genReqId: () => crypto.randomUUID(),
  });

  await app.register(cors, {
    origin: config.CORS_ORIGINS.length > 0 ? config.CORS_ORIGINS : false,
    credentials: true,
  });

  /**
   * One error shape for every failure, matching `ErrorEnvelope` in @la/contracts.
   * Clients parse exactly one thing; `requestId` ties a report to the logs.
   */
  app.setErrorHandler((err: FastifyError, req, reply) => {
    const status = err.statusCode ?? 500;
    if (status >= 500) req.log.error({ err }, 'request failed');
    else req.log.warn({ err: err.message }, 'request rejected');

    const body: ErrorEnvelope = {
      error: {
        code: err.code ?? (status >= 500 ? 'INTERNAL' : 'BAD_REQUEST'),
        message: status >= 500 ? 'Internal server error' : err.message,
        ...(err.validation ? { details: err.validation } : {}),
        requestId: String(req.id),
      },
    };
    reply.status(status).send(body);
  });

  app.setNotFoundHandler((req, reply) => {
    const body: ErrorEnvelope = {
      error: {
        code: 'NOT_FOUND',
        message: `No route for ${req.method} ${req.url}`,
        requestId: String(req.id),
      },
    };
    reply.status(404).send(body);
  });

  /** Process is up. Says nothing about the database — that is /readyz. */
  app.get('/healthz', async () => ({ status: 'ok' as const }));

  /** Up AND able to reach Postgres. This is what a load balancer should poll. */
  app.get('/readyz', async (_req, reply) => {
    if (!config.DATABASE_URL) {
      return reply.status(503).send({ status: 'no-database', database: false });
    }
    try {
      const ok = await ping(getPool(config.DATABASE_URL));
      return ok
        ? { status: 'ok' as const, database: true }
        : reply.status(503).send({ status: 'degraded', database: false });
    } catch {
      return reply.status(503).send({ status: 'degraded', database: false });
    }
  });

  return app;
}
