import type { FastifyInstance, FastifyPluginAsync, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import {
  ErrorEnvelope,
  RateTypeDetail,
  RateTypeIdParam,
  RateTypeListQuery,
  RateTypeListResponse,
  type RateTypeAddon,
  type RateTypeCharterRate,
  type RateTypeRouteBundle,
  type RateTypeRouteValidity,
  type RateTypeSeatRate,
} from '@la/contracts';
import { getPool, SCHEMA } from '@la/db';
import type { Config } from '../config.js';

/**
 * RT-01 · read-only rate types.
 *
 * Pulled forward out of the sales domain because `BK-09` cannot price a trip
 * without them. Read-only on purpose: rate types are still edited in the
 * monolith until the sales phase, and a second writer would diverge.
 */

export interface RateTypeRoutesOptions {
  config: Config;
}

/** The schema the RT-01 tables live in. Not hardcoded — see @la/db's SCHEMA map. */
const S = SCHEMA.ops;

/**
 * Rows as they leave Postgres.
 *
 * The aggregate columns are built by `json_build_object` in the query below, so
 * they already arrive in the contract's camelCase shape and are handed straight
 * to the reply. Nothing re-checks them here — Fastify serialises the reply
 * against `RateTypeDetail`, and a drift between this SQL and the contract
 * becomes a logged 500 (`isResponseSerializationError` in app.ts) rather than a
 * malformed payload a client has to discover.
 */
interface RateTypeSummaryRow {
  id: string;
  code: string;
  name: string;
  note: string | null;
  color: string | null;
  active: boolean;
  valid_from: string | null;
  valid_to: string | null;
  legacy_id: string | null;
}

interface RateTypeListRow extends RateTypeSummaryRow {
  /** `count(*) over ()` — bigint, which node-pg hands back as a string. */
  total: string;
}

interface RateTypeDetailRow extends RateTypeSummaryRow {
  routes: string[];
  seat_rates: RateTypeSeatRate[];
  route_validity: RateTypeRouteValidity[];
  route_bundles: RateTypeRouteBundle[];
  charter_rates: RateTypeCharterRate[];
  addons: RateTypeAddon[];
}

function toSummary(row: RateTypeSummaryRow) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    note: row.note,
    color: row.color,
    active: row.active,
    validFrom: row.valid_from,
    validTo: row.valid_to,
    legacyId: row.legacy_id,
  };
}

/** A 404 the shared error handler turns into the standard envelope. */
function notFound(message: string): Error {
  const err = new Error(message) as Error & { statusCode: number; code: string };
  err.statusCode = 404;
  // Must be in app.ts's PUBLIC_ERROR_CODES or it collapses to BAD_REQUEST.
  err.code = 'NOT_FOUND';
  return err;
}

/**
 * Turns a user substring into an ILIKE pattern.
 *
 * `%` and `_` are wildcards and `\` is the escape character, so an unescaped
 * `q=100%` would match every rate type rather than none. Escaped here rather
 * than in SQL so the parameter stays a plain bound value.
 */
function likePattern(q: string): string {
  return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

/**
 * Serving these routes with no database configured.
 *
 * `DATABASE_URL` is optional (config.ts) and this API is deliberately bootable
 * without it: /healthz answers, the OpenAPI document is served, and /readyz —
 * the endpoint a load balancer actually polls — reports `no-database` and 503s.
 * These read routes follow the same rule and serve an empty catalogue instead
 * of a 500, so the contract stays exercisable in CI and in a fresh checkout.
 *
 * It is logged every time, at warn, so an empty list is never quietly mistaken
 * for "no rate types have been imported yet".
 */
function databaseUrl(config: Config, req: FastifyRequest): string | null {
  if (config.DATABASE_URL) return config.DATABASE_URL;
  req.log.warn('rate-types: no DATABASE_URL configured; serving an empty catalogue');
  return null;
}

const LIST_SQL = `
  select
    rt.id,
    rt.code,
    rt.name,
    rt.note,
    rt.color,
    rt.active,
    -- ::text, not the date itself: node-pg would hand back a JS Date, and the
    -- contract's LocalDate is a calendar date that must never round-trip
    -- through UTC (a documented live bug in the monolith).
    rt.valid_from::text as valid_from,
    rt.valid_to::text   as valid_to,
    rt.legacy_id
    -- Window functions run after WHERE but before LIMIT, so this is the total
    -- matching the filter, not the size of the page.
    , count(*) over () as total
  from ${S}.rate_type rt
  where ($1::boolean is null or rt.active = $1::boolean)
    and ($2::text is null or rt.code ilike $2 or rt.name ilike $2)
  order by rt.code
  limit $3 offset $4
`;

/**
 * One statement, so every part of a rate type is read from one snapshot.
 *
 * Six separate queries would let an import commit between them and return, say,
 * seat rates for a route whose validity row had not landed yet.
 */
const DETAIL_SQL = `
  with rt as (
    select * from ${S}.rate_type where id = $1
  )
  select
    rt.id,
    rt.code,
    rt.name,
    rt.note,
    rt.color,
    rt.active,
    rt.valid_from::text as valid_from,
    rt.valid_to::text   as valid_to,
    rt.legacy_id,

    -- The routes list is derived, not stored. The monolith keeps a routes[] array that
    -- can disagree with the prices actually published; a route with no price is
    -- not sellable whatever the array claims.
    coalesce((
      select json_agg(u.route_id order by u.route_id)
      from (
        select route_id from ${S}.rate_type_seat_rate      where rate_type_id = rt.id
        union
        select route_id from ${S}.rate_type_route_validity where rate_type_id = rt.id
        union
        select route_id from ${S}.rate_type_route_bundle   where rate_type_id = rt.id
        union
        select route_id from ${S}.rate_type_charter_rate   where rate_type_id = rt.id
        union
        select route_id from ${S}.rate_type_addon          where rate_type_id = rt.id
      ) u
    ), '[]'::json) as routes,

    coalesce((
      select json_agg(json_build_object(
               'routeId', sr.route_id,
               'zone',    sr.zone,
               'paxType', sr.pax_type,
               'price',   sr.price
             ) order by sr.route_id, sr.zone, sr.pax_type)
      from ${S}.rate_type_seat_rate sr
      where sr.rate_type_id = rt.id
    ), '[]'::json) as seat_rates,

    coalesce((
      select json_agg(json_build_object(
               'routeId',   rv.route_id,
               'validFrom', rv.valid_from::text,
               'validTo',   rv.valid_to::text
             ) order by rv.route_id)
      from ${S}.rate_type_route_validity rv
      where rv.rate_type_id = rt.id
    ), '[]'::json) as route_validity,

    coalesce((
      select json_agg(json_build_object(
               'routeId',    rb.route_id,
               'addonKey',   rb.addon_key,
               'mode',       rb.mode,
               'adultPrice', rb.adult_price,
               'childPrice', rb.child_price,
               'applyTo',    rb.apply_to
             ) order by rb.route_id, rb.addon_key)
      from ${S}.rate_type_route_bundle rb
      where rb.rate_type_id = rt.id
    ), '[]'::json) as route_bundles,

    coalesce((
      select json_agg(json_build_object(
               'routeId',         cr.route_id,
               'boatType',        cr.boat_type,
               'starterPrice',    cr.starter_price,
               'starterIncludes', cr.starter_includes,
               'extraPerPax',     cr.extra_per_pax
             ) order by cr.route_id, cr.boat_type)
      from ${S}.rate_type_charter_rate cr
      where cr.rate_type_id = rt.id
    ), '[]'::json) as charter_rates,

    coalesce((
      select json_agg(json_build_object(
               'id',         ad.id,
               'addonKey',   ad.addon_key,
               'routeId',    ad.route_id,
               'zone',       ad.zone,
               'variant',    ad.variant,
               'adultPrice', ad.adult_price,
               'childPrice', ad.child_price,
               'unitPrice',  ad.unit_price,
               'capacity',   ad.capacity,
               'unit',       ad.unit
             ) order by ad.addon_key, ad.route_id, ad.zone, ad.variant)
      from ${S}.rate_type_addon ad
      where ad.rate_type_id = rt.id
    ), '[]'::json) as addons

  from rt
`;

export const rateTypeRoutes: FastifyPluginAsync<RateTypeRoutesOptions> = async (
  app: FastifyInstance,
  opts: RateTypeRoutesOptions,
) => {
  const { config } = opts;
  const routes = app.withTypeProvider<ZodTypeProvider>();

  routes.get(
    '/v1/rate-types',
    {
      schema: {
        summary: 'List rate types',
        description:
          'Paginated. Prices are not included — fetch a rate type by id for seat rates, ' +
          'validity, bundles, charter rates and add-ons.',
        tags: ['rate-types'],
        querystring: RateTypeListQuery,
        response: { 200: RateTypeListResponse, 400: ErrorEnvelope },
      },
    },
    async (req) => {
      const { limit, offset, active, q } = req.query;
      const url = databaseUrl(config, req);
      if (!url) return { items: [], total: 0, limit, offset };

      const result = await getPool(url).query<RateTypeListRow>(LIST_SQL, [
        active === undefined ? null : active === 'true',
        q === undefined ? null : likePattern(q),
        limit,
        offset,
      ]);

      return {
        items: result.rows.map(toSummary),
        // No rows means no matches, and the window function had nothing to
        // count — the total is 0, not undefined.
        total: Number(result.rows[0]?.total ?? 0),
        limit,
        offset,
      };
    },
  );

  routes.get(
    '/v1/rate-types/:id',
    {
      schema: {
        summary: 'Get one rate type with every published price',
        description:
          'Everything BK-09 needs to price a trip: seat rates (route x zone x pax type), ' +
          'per-route validity (the source of truth for the active period), forced bundles, ' +
          'charter rates and optional add-ons.',
        tags: ['rate-types'],
        params: RateTypeIdParam,
        response: { 200: RateTypeDetail, 400: ErrorEnvelope, 404: ErrorEnvelope },
      },
    },
    async (req) => {
      const { id } = req.params;
      const url = databaseUrl(config, req);
      if (!url) throw notFound(`No rate type ${id}`);

      const result = await getPool(url).query<RateTypeDetailRow>(DETAIL_SQL, [id]);
      const row = result.rows[0];
      if (!row) throw notFound(`No rate type ${id}`);

      return {
        ...toSummary(row),
        routes: row.routes,
        seatRates: row.seat_rates,
        routeValidity: row.route_validity,
        routeBundles: row.route_bundles,
        charterRates: row.charter_rates,
        addOns: row.addons,
      };
    },
  );
};

export default rateTypeRoutes;
