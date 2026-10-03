#!/usr/bin/env node
// §b2cCheck · run the post-import checks over everything a full B2C sync would import right now.
// Read-only. Same window, same mapper, same checks as relSyncB2C — use it to see what the sync
// would flag before shipping a mapper change, or to calibrate a new check against real data.
//
//   B2C_DB_URL=… OPS_DATABASE_URL=… B2C_SCHEMA=love_kingdom node tools/b2c-check-live.mjs [--json] [--info]
import { openLive, map } from './b2c-live.mjs';

const asJson = process.argv.includes('--json');
const withInfo = process.argv.includes('--info');
const live = await openLive();
try {
  const items = await live.itemsWindow();
  const c = await live.context(items);
  const bks = map.mapB2COrders(items, c);
  // Same as the sync: a nat ops typed by hand survives the re-insert, so it counts as answered.
  const opsNat = new Set((await live.opsPool.query(
    `SELECT sb_bookings_id FROM operation_schemas.sb_bookings__trips
      WHERE sb_bookings_id LIKE 'b2c\_%' AND COALESCE(nat_ad, nat_chd, nat_inf, nat_foc) IS NOT NULL`)).rows.map(r => r.sb_bookings_id));
  const issues = map.b2cCheckOrders(items, bks, c.paxByBooking, opsNat).filter(i => withInfo || i.sev === 'warn');
  if (asJson) { console.log(JSON.stringify(issues, null, 1)); }
  else {
    const byCode = {};
    for (const i of issues) (byCode[i.sev + ' ' + i.code] = byCode[i.sev + ' ' + i.code] || []).push(i);
    console.log(`${new Set(items.map(r => r.booking_id)).size} orders · ${bks.length} bookings imported · ${issues.length} issue(s)`);
    for (const [k, list] of Object.entries(byCode).sort()) {
      console.log(`\n${k} · ${list.length}`);
      for (const i of list.slice(0, 15)) console.log(`  ${i.ref.padEnd(13)} ${i.msg}`);
      if (list.length > 15) console.log(`  … ${list.length - 15} more`);
    }
  }
} finally { await live.close(); }
