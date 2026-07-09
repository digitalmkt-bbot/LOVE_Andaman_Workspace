// Shared definitions for the DBML files: real DB schemas + domain sub-groups.
//
// Actual Postgres schema layout (dev · ERP-Loveandaman, see HANDOFF_2026-07-04.md):
//   operation_schemas.*  app data (all 103 tables in the SQL dump)
//   allotment.*          users / app_state / attachments (created unqualified by
//                        server.js; land here via role allotment_app search_path)
//   public.*             belongs to a DIFFERENT app — do not touch
//   norm.*               (prod only) stale relational snapshot — ignore

// Domain sub-groups WITHIN the operation_schemas schema.
// Order matters: a table belongs to the FIRST group whose test matches.
const GROUPS = [
  { id: 'app_meta',        label: 'app / meta',                          test: n => n.startsWith('app_') },
  { id: 'operations_core', label: 'operations · routes / boats / trips', test: n => n.startsWith('routes') || n.startsWith('boats') || n === 'trips' },
  { id: 'fleet',           label: 'fleet maintenance',                   test: n => n.startsWith('fleet_') },
  { id: 'rate_types',      label: 'sales · rate types',                  test: n => n.startsWith('sb_rate_types') || n === 'sb_agents_rate_bindings' },
  { id: 'agents_team',     label: 'sales · agents & team',               test: n => n.startsWith('sb_agents') || n === 'sb_sales' || n === 'sb_staff' },
  { id: 'booking',         label: 'booking',                             test: n => n.startsWith('sb_bookings') || n.startsWith('sb_seat_locks') || n === 'sb_extras' || n === 'sb_weather' || n === 'sb_nationalities' || n === 'nat_learn' },
  { id: 'accounting',      label: 'accounting',                          test: n => n.startsWith('sb_invoices') || n === 'sb_payments' },
  { id: 'transfer_pickup', label: 'transfer / pickup',                   test: n => n.startsWith('sb_pickup') || n.startsWith('sb_vehicles') || n.startsWith('vanjob_') },
  { id: 'market_intel',    label: 'market intelligence (demand)',        test: n => n.startsWith('sb_market') },
  { id: 'other',           label: 'other',                               test: () => true },
];

function classify(name) {
  return GROUPS.find(g => g.test(name)).id;
}

// Primary separator = real database schema
function schemaBanner(name, desc) {
  const line = '█'.repeat(60);
  return `// ${line}\n// ██  DATABASE SCHEMA: ${name}\n// ██  ${desc}\n// ${line}\n`;
}

// Secondary separator = domain sub-group (single line)
function banner(label) {
  return `// ──────── ${label} ────────\n`;
}

// Tables that live in the `allotment` schema — DDL from server.js (created
// unqualified; resolved to `allotment` by the allotment_app role's search_path).
const EXTRA_TABLE_NAMES = ['users', 'app_state', 'attachments'];

const EXTRA_SCHEMAS_DBML = `${schemaBanner('allotment', 'auth / session / file store · created by server.js boot')}
Table users {
  id serial [pk]
  username text [unique, not null]
  pass_hash text [not null]
  name text
  role text [default: 'staff']
  created_at timestamptz [default: \`now()\`]
}

Table app_state {
  id text [pk, note: 'blob-mode state store · prod source of truth (public.app_state) · unused in relational mode']
  data text
  version int [default: 0]
  updated_by text
  updated_at timestamptz [default: \`now()\`]
}

Table attachments {
  id text [pk]
  booking_id text
  filename text
  mime text
  size int
  data bytea
  uploaded_by text
  created_at timestamptz [default: \`now()\`]
}

// (schema \`public\` = a different app's tables — not modeled here)
// (schema \`norm\` = prod-only stale snapshot — ignore)
`;

module.exports = { GROUPS, classify, banner, schemaBanner, EXTRA_TABLE_NAMES, EXTRA_SCHEMAS_DBML };
