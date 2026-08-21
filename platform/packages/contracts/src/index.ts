/**
 * @la/contracts — the shared definition of every value crossing the API.
 *
 * Consumed by:
 *   - apps/api        (validates requests and responses against these schemas)
 *   - apps/ops-web    (imports the inferred types; no hand-written data models)
 *   - Loveandaman-Kingdom (B2C + ERP) — installs this as a published package
 *
 * Rule: this package must never import from `apps/*`. It is the bottom of the
 * dependency graph so it stays independently publishable.
 */
export * from './common.js';
export * from './booking.js';
