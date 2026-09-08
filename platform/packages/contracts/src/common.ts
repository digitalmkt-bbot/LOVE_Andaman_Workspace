import { z } from 'zod';

/**
 * The single error envelope every endpoint returns on failure.
 * `requestId` is echoed in the API logs — always quote it in a bug report.
 */
export const ErrorEnvelope = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
    requestId: z.string(),
  }),
});
export type ErrorEnvelope = z.infer<typeof ErrorEnvelope>;

/**
 * A calendar date in Asia/Bangkok, as `YYYY-MM-DD`.
 *
 * Deliberately a string, not a JS Date. The monolith's habit of
 * `toISOString().slice(0,10)` shifts to the previous day before 07:00 local
 * (+07:00), which is a documented live bug. Dates crossing this API are always
 * local calendar dates and are never converted through UTC.
 */
export const LocalDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD (Asia/Bangkok calendar date)');
export type LocalDate = z.infer<typeof LocalDate>;

/** Cursor-free offset pagination, used by every list endpoint. */
export const PageQuery = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
export type PageQuery = z.infer<typeof PageQuery>;

export const pageOf = <T extends z.ZodTypeAny>(item: T) =>
  z.object({
    items: z.array(item),
    total: z.number().int().min(0),
    limit: z.number().int(),
    offset: z.number().int(),
  });

/**
 * Which system a record originated from.
 *
 * Replaces the monolith's `b2c_` id-prefix convention, which is a naming
 * convention nothing validates — 22 `b2c_` bookings in production have no
 * matching row in the B2C schema.
 */
export const SourceSystem = z.enum(['ops', 'b2c', 'erp', 'agent']);
export type SourceSystem = z.infer<typeof SourceSystem>;
