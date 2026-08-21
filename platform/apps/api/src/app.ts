import Fastify, { type FastifyError, type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import {
  hasZodFastifySchemaValidationErrors,
  isResponseSerializationError,
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { z } from 'zod';
import { ErrorEnvelope } from '@la/contracts';
import { getPool, ping } from '@la/db';
import { corsAllowList, type Config } from './config.js';
import { rateTypeRoutes } from './routes/rate-types.js';

/**
 * Codes a client is allowed to see and branch on.
 *
 * Everything else collapses to INTERNAL or BAD_REQUEST. Without this the
 * underlying error's own `code` escapes — Fastify stamps `FST_ERR_*`, Node
 * stamps `ECONNREFUSED`/`ETIMEDOUT`, pg stamps SQLSTATEs like `23505` — which
 * leaks infrastructure detail and hands clients an unbounded set of strings to
 * branch on.
 */
const PUBLIC_ERROR_CODES = new Set([
  'BAD_REQUEST',
  'VALIDATION_FAILED',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'UNPROCESSABLE',
  'RATE_LIMITED',
  'INTERNAL',
]);

function publicCode(err: FastifyError, status: number): string {
  if (status >= 500) return 'INTERNAL';
  return err.code && PUBLIC_ERROR_CODES.has(err.code) ? err.code : 'BAD_REQUEST';
}

const HealthQuery = z.object({
  // An enum, not a coerced boolean: `z.coerce.boolean()` maps any non-empty
  // string to `true`, so a typo would silently succeed instead of being rejected.
  verbose: z.enum(['true', 'false']).optional(),
});

const HealthResponse = z.object({
  status: z.literal('ok'),
  uptimeSeconds: z.number().optional(),
  nodeEnv: z.string().optional(),
});

const ReadyResponse = z.object({
  status: z.literal('ok'),
  database: z.literal(true),
});

const NotReadyResponse = z.object({
  status: z.enum(['no-database', 'degraded']),
  database: z.literal(false),
});

export interface BuildAppOptions {
  /**
   * Test seam: capture pino output. P0-03 requires that a failed request's
   * `requestId` actually reaches the logs, which is only provable by reading them.
   */
  logStream?: NodeJS.WritableStream;
}

export async function buildApp(
  config: Config,
  opts: BuildAppOptions = {},
): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: config.LOG_LEVEL,
      // Never log a connection string or an auth header.
      redact: ['req.headers.authorization', 'req.headers.cookie'],
      ...(opts.logStream ? { stream: opts.logStream } : {}),
    },
    genReqId: () => crypto.randomUUID(),
  });

  // Requests and responses are validated against the zod schemas in
  // @la/contracts, and the same schemas generate the OpenAPI document — one
  // definition, never a hand-maintained spec drifting from the code.
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  const allowList = corsAllowList(config);
  await app.register(cors, {
    origin: allowList.length > 0 ? allowList : false,
    credentials: true,
  });

  await app.register(swagger, {
    openapi: {
      openapi: '3.1.0',
      info: {
        title: 'LOVE Andaman API',
        version: '0.1.0',
        description:
          'The only path to the database. Serves the ops app, the B2C site, ERP and the agent portal.',
      },
    },
    transform: jsonSchemaTransform,
  });

  await app.register(swaggerUi, { routePrefix: '/docs' });

  /**
   * One error shape for every failure, matching `ErrorEnvelope` in @la/contracts.
   * Clients parse exactly one thing; `requestId` ties a report to the logs.
   */
  app.setErrorHandler((err: FastifyError, req, reply) => {
    if (hasZodFastifySchemaValidationErrors(err)) {
      req.log.warn({ issues: err.validation }, 'request rejected by schema');
      const body: ErrorEnvelope = {
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Request failed validation',
          details: err.validation,
          requestId: String(req.id),
        },
      };
      return reply.status(400).send(body);
    }

    // We produced a response that does not match our own declared schema.
    // That is our bug, not the caller's, so it is a 500 and it is logged loudly.
    if (isResponseSerializationError(err)) {
      req.log.error({ err, route: err.method + ' ' + err.url }, 'response failed its own schema');
      const body: ErrorEnvelope = {
        error: {
          code: 'INTERNAL',
          message: 'Internal server error',
          requestId: String(req.id),
        },
      };
      return reply.status(500).send(body);
    }

    const status = err.statusCode ?? 500;
    if (status >= 500) req.log.error({ err }, 'request failed');
    else req.log.warn({ err: err.message }, 'request rejected');

    const body: ErrorEnvelope = {
      error: {
        code: publicCode(err, status),
        message: status >= 500 ? 'Internal server error' : err.message,
        requestId: String(req.id),
      },
    };
    return reply.status(status).send(body);
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

  const routes = app.withTypeProvider<ZodTypeProvider>();

  /** Process is up. Says nothing about the database — that is /readyz. */
  routes.get(
    '/healthz',
    {
      schema: {
        summary: 'Liveness probe',
        description: 'The process is up. Says nothing about the database.',
        tags: ['health'],
        querystring: HealthQuery,
        response: { 200: HealthResponse, 400: ErrorEnvelope },
      },
    },
    async (req) => {
      if (req.query.verbose === 'true') {
        return {
          status: 'ok' as const,
          uptimeSeconds: Math.round(process.uptime()),
          nodeEnv: config.NODE_ENV,
        };
      }
      return { status: 'ok' as const };
    },
  );

  /** Up AND able to reach Postgres. This is what a load balancer should poll. */
  routes.get(
    '/readyz',
    {
      schema: {
        summary: 'Readiness probe',
        description: 'Up and able to reach Postgres. Poll this from the load balancer.',
        tags: ['health'],
        response: { 200: ReadyResponse, 503: NotReadyResponse },
      },
    },
    async (req, reply) => {
      if (!config.DATABASE_URL) {
        req.log.warn('readyz: no DATABASE_URL configured');
        return reply.status(503).send({ status: 'no-database' as const, database: false as const });
      }
      try {
        const ok = await ping(getPool(config.DATABASE_URL));
        if (ok) return { status: 'ok' as const, database: true as const };
        req.log.error('readyz: database ping returned an unexpected result');
        return reply.status(503).send({ status: 'degraded' as const, database: false as const });
      } catch (err) {
        // Swallowing this used to make the one route that can actually fail the
        // one route with nothing in the log to correlate against its requestId.
        req.log.error({ err }, 'readyz: database probe failed');
        return reply.status(503).send({ status: 'degraded' as const, database: false as const });
      }
    },
  );

  // Domain routes. Registered as plugins so each owns its own encapsulated
  // context; the validator/serializer compilers and the error handler set above
  // are inherited, so every route answers with the same envelope.
  await app.register(rateTypeRoutes, { config });

  return app;
}
