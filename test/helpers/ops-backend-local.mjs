// A real operation-backend, in-process store, seeded with a small catalogue · for UI tests.
//
//   cd <operation-backend checkout> && node --import tsx <this file>
//   (t_ops.mjs does that for you · OPS_BACKEND_DIR, default D:/projects/operation-backend)
//
// Why not a mock: the point of the test is that the client speaks the server's actual contract
// (validation, 409s on capacity, lock draws, trip ids). A mock would only agree with my reading of it.
//
// The in-process store has no catalogue unless code seeds it, and the app builds its store itself,
// so every OperationsStore method is wrapped to seed the instance on first use.
// Env: PORT (default 0 = any) · prints "OPS_LISTENING <port>" once up.
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const DIR = process.cwd();
const imp = (p) => import(pathToFileURL(path.join(DIR, p)).href);
const { OperationsStore } = await imp('src/domain/operations.ts');
const { hashPassword } = await imp('src/domain/users.ts');

const today = new Date(); const ymd = (d) => d.toISOString().slice(0, 10);
const day = (n) => { const d = new Date(today); d.setDate(d.getDate() + n); return ymd(d); };

const SEED = {
  routes: [
    { id: 'r4', name: 'Similan Islands by Catamaran', pier: 'tublamu', family_id: 'similan', color: '#185fa5', sort: 1, times: ['08:00'] },
    { id: 'r5', name: 'Similan Islands by Speedboat', pier: 'tublamu', family_id: 'similan', color: '#185fa5', sort: 2, times: ['08:30'] },
    { id: 'r10', name: 'Phi Phi Bamboo by Speedboat', pier: 'panwa', family_id: 'phiphi', color: '#c0392b', sort: 3, times: ['08:00'] },
  ],
  // r10 closed one day ahead+3, so the calendar test has a closed day to find
  seasons: [],
  overrides: [{ route_id: 'r10', service_date: day(3), kind: 'closed' }],
  boats: [
    { id: 'b1', name: 'Aluminous1', type: 'Catamaran', pier: 'tublamu', capacity: 64, license_pax: 75, crew: 5 },
    { id: 'b6', name: 'Zeus', type: 'Speedboat', pier: 'tublamu', capacity: 40, license_pax: 47, crew: 3 },
    { id: 'b7', name: 'Verona', type: 'Speedboat', pier: 'tublamu', capacity: 34, license_pax: 45, crew: 3 },
    { id: 'b13', name: 'Oceanus', type: 'Speedboat', pier: 'panwa', capacity: 38, license_pax: 45, crew: 3 },
  ],
};
const nul = (keys) => Object.fromEntries(keys.map((k) => [k, null]));
const AGENT_NULLS = ['code', 'market_id', 'sub_market', 'sales_id', 'color', 'pay_type', 'credit_days', 'credit_limit', 'contact', 'email', 'phone', 'note',
  'rate_type_id', 'contract_template_id', 'contract_status', 'contract_version', 'contract_start', 'contract_end', 'legal_name', 'tax_id', 'tat_license',
  'address', 'company_tel', 'hotline', 'fax', 'website', 'signatory_name', 'signatory_designation', 'signatory_tel', 'signatory_signed_date',
  'booking_method', 'booking_cutoff', 'booking_cancel_policy', 'booking_email', 'booking_phone'];
const agent = (o) => ({ ...nul(AGENT_NULLS), vat_mode: 'none', house: false, active: true, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', programs: [], ...o });
const AGENTS = {
  markets: [{ id: 'ru', name: 'Russia', color: '#c33', sort: 1, subs: ['Moscow'] }, { id: 'th', name: 'Thailand', color: null, sort: 2, subs: [] }],
  sales: [{ id: 's1', code: 'TT', name: 'Tata', full_name: 'Tata Test', designation: 'Sales', email: 'tt@example.com', tel: null, color: null, active: true }],
  agents: [
    agent({ id: 'a01', code: 'SUNTOUR', name: 'Sun Tour', market_id: 'ru', sub_market: 'Moscow', sales_id: 's1', pay_type: 'bt', vat_mode: 'exclude',
      credit_limit: 200000, rate_type_id: 'rt001', email: 'sun@example.com', legal_name: 'Sun Tour Co., Ltd.', tax_id: '0105555000000',
      signatory_name: 'Ivan', booking_method: 'email', programs: [{ route_id: 'r5', book_from: null, book_to: null, note: null }] }),
    agent({ id: 'a_b2c', code: 'B2C', name: 'B2C Website', house: true, market_id: 'th', sales_id: 's1', pay_type: 'invoice', rate_type_id: 'rt001', email: 'web@example.com', programs: [{ route_id: 'r5', book_from: null, book_to: null, note: null }] }),
  ],
  activity: { a01: [{ at: '2026-09-01T10:00:00Z', by: 'tester', kind: 'note', text: 'Seeded activity line' }] },
};

const proto = OperationsStore.prototype;
const SEEDED = Symbol('seeded');
for (const name of Object.getOwnPropertyNames(proto)) {
  if (name === 'constructor') continue;
  const desc = Object.getOwnPropertyDescriptor(proto, name);
  if (typeof desc.value !== 'function') continue;
  const orig = desc.value;
  proto[name] = function (...args) {
    if (!this[SEEDED]) {
      this[SEEDED] = true;
      this.seedCatalogue(SEED);
      this.seedAgents(AGENTS);
      // Auth now reads users from the operations store (not AUTH_PASSWORD_USERS).
      // Seed the staff account that t_ops uses before the first request reaches it.
      this.createUser({ username: 'tester', pass_hash: hashPassword('pw'), name: 'Tester', role: 'admin',
        can_edit: true, edit_areas: null, actions: [], view_perms: null, sales_id: null, agent_id: null,
        dept: null, disabled_at: null, tokens_valid_after: null, legacy_id: null });
    }
    return orig.apply(this, args);
  };
}

process.env.AUTH_JWT_SECRET ||= 'local-test-secret-local-test-secret-32b';
process.env.AUTH_PASSWORD_USERS ||= JSON.stringify([{ username: 'tester', password: 'pw', groups: ['admin'] }]);
process.env.CORS_ORIGIN ||= '*';
process.env.LOG_LEVEL ||= 'warn';
delete process.env.DATABASE_URL;

const { buildApp } = await imp('src/app.ts');
const app = buildApp();
await app.listen({ port: Number(process.env.PORT || 0), host: '127.0.0.1' });
console.log('OPS_LISTENING ' + app.server.address().port);
