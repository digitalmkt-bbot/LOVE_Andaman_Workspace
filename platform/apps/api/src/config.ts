import { z } from 'zod';

/**
 * The four consumer classes from decision D4. Every one of them reaches the
 * database only through this API, and each gets exactly one allowed origin.
 * Kept in the same order as `SourceSystem` in @la/contracts.
 */
export const CONSUMERS = ['ops', 'b2c', 'erp', 'agent'] as const;
export type Consumer = (typeof CONSUMERS)[number];

/**
 * Environment is validated once at boot and the process exits on a bad value.
 * Failing at startup beats failing on the first request that happens to need it.
 */
const Env = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  HOST: z.string().default('0.0.0.0'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  /** Postgres connection string. Use a READ-ONLY role for anything that only reads. */
  DATABASE_URL: z.string().url().optional(),

  /**
   * One origin per consumer class. Anything unset is simply not allowed —
   * there is no wildcard and no shared list, so granting the agent portal
   * access can never quietly grant it to B2C as well.
   */
  CORS_ORIGIN_OPS: z.string().url().optional(),
  CORS_ORIGIN_B2C: z.string().url().optional(),
  CORS_ORIGIN_ERP: z.string().url().optional(),
  CORS_ORIGIN_AGENT: z.string().url().optional(),
});

export type Config = z.infer<typeof Env>;

export function loadConfig(source: NodeJS.ProcessEnv = process.env): Config {
  const parsed = Env.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment:\n${issues}`);
  }
  return parsed.data;
}

/** The configured origin for each consumer class, omitting the unset ones. */
export function corsOriginsByConsumer(config: Config): Partial<Record<Consumer, string>> {
  return {
    ...(config.CORS_ORIGIN_OPS ? { ops: config.CORS_ORIGIN_OPS } : {}),
    ...(config.CORS_ORIGIN_B2C ? { b2c: config.CORS_ORIGIN_B2C } : {}),
    ...(config.CORS_ORIGIN_ERP ? { erp: config.CORS_ORIGIN_ERP } : {}),
    ...(config.CORS_ORIGIN_AGENT ? { agent: config.CORS_ORIGIN_AGENT } : {}),
  };
}

/** Flat allow-list handed to @fastify/cors. Empty means same-origin only. */
export function corsAllowList(config: Config): string[] {
  return Object.values(corsOriginsByConsumer(config));
}
