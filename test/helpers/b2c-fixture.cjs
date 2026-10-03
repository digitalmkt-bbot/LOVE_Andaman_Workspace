// §b2cMapMod · load a captured B2C order (tools/b2c-fixture-capture.mjs) and run it through the
// same mapper path relSyncB2C uses. Kept as CJS so both node:test files and ad-hoc scripts can use it.
const fs = require('fs');
const path = require('path');
const map = require('../../b2c-map.js');

const DIR = path.join(__dirname, '..', 'fixtures', 'b2c');

// Rebuild what pg hands back: date columns as Date at LOCAL midnight, timestamps as Date.
function revive(v) {
  if (Array.isArray(v)) return v.map(revive);
  if (v && typeof v === 'object') {
    if (typeof v.$date === 'string') { const [y, m, d] = v.$date.split('-').map(Number); return new Date(y, m - 1, d); }
    if (typeof v.$ts === 'string') return new Date(v.$ts);
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, revive(x)]));
  }
  return v;
}

// Inverse of revive, for copying already-revived rows.
function encode(v) {
  if (v instanceof Date) {
    const dateOnly = !v.getHours() && !v.getMinutes() && !v.getSeconds() && !v.getMilliseconds();
    const p = x => String(x).padStart(2, '0');
    return dateOnly ? { $date: v.getFullYear() + '-' + p(v.getMonth() + 1) + '-' + p(v.getDate()) } : { $ts: v.toISOString() };
  }
  if (Array.isArray(v)) return v.map(encode);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, encode(x)]));
  return v;
}

function loadFixture(id) {
  const fx = JSON.parse(fs.readFileSync(path.join(DIR, id + '.json'), 'utf8'));
  fx.items = revive(fx.items);
  return fx;
}

function listFixtures() {
  return fs.readdirSync(DIR).filter(f => /\.json$/.test(f)).map(f => f.replace(/\.json$/, '')).sort();
}

function runFixture(fx) {
  const ctx = {
    findArea: map.b2cFindArea(fx.areas || []),
    paxByBooking: new Map([[fx.id, fx.paxRows || []]]),
    addonCat: new Map(fx.catalogs.addon), progCat: new Map(fx.catalogs.prog),
    trfCat: new Map(fx.catalogs.trf), extCat: new Map(fx.catalogs.ext),
  };
  // Fresh copy each run: the mapper must not depend on (or leak through) mutated input.
  return map.mapB2COrders(revive(JSON.parse(JSON.stringify(encode(fx.items)))), ctx);
}

module.exports = { loadFixture, listFixtures, runFixture, revive, encode, DIR };
