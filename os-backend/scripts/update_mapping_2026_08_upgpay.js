'use strict';
// Mapper update 2026-08 · §upgPay · วิธีรับเงินของรายการอัพเกรดหน้างาน
//
// upgrades[] เก็บแค่ ราคาขาย / จ่ายบริษัท / คอมมิชชั่น / เก็บเงินแล้ว
// ไม่มีที่เก็บว่ารับเงินมาด้วยวิธีไหน · sb_extras มีครบมานานแล้ว
// (method · feePct · fee · customerPaid · slips) แต่ upgrades ไม่มีสักตัว
// ถ้าเพิ่มแต่หน้าจอโดยไม่เพิ่มคอลัมน์ decomposeBlob จะทิ้งค่าทุกครั้งที่บันทึก
// ซึ่งเป็นกับดักเดียวกับ ts_cot / fleet_fuelprice เมื่อวันก่อน
const fs = require('fs');
const MAPF = 'src/mapping/field_mapping.json', MODF = 'src/mapping/operation_schemas_model.json';
const MAP = JSON.parse(fs.readFileSync(MAPF, 'utf8'));
const MOD = JSON.parse(fs.readFileSync(MODF, 'utf8'));
const modCols = cols => Object.entries(cols).map(([name, i]) => ({ name, type: i.db_type }));
const addCols = (table, defs) => {
  Object.assign(MAP[table], defs);
  const have = new Set(MOD[table].columns.map(c => c.name));   // idempotent
  MOD[table].columns.push(...modCols(defs).filter(c => !have.has(c.name)));
};

addCols('sb_bookings__upgrades', {
  method:       { source: 'upgrades[].method',       kind: 'scalar',    db_type: 'text' },
  feepct:       { source: 'upgrades[].feePct',       kind: 'scalar',    db_type: 'double precision' },
  fee:          { source: 'upgrades[].fee',          kind: 'scalar',    db_type: 'bigint' },
  customerpaid: { source: 'upgrades[].customerPaid', kind: 'scalar',    db_type: 'bigint' },
  slips:        { source: 'upgrades[].slips',        kind: 'json_text', db_type: 'text' },
});

fs.writeFileSync(MAPF, JSON.stringify(MAP, null, 2));
fs.writeFileSync(MODF, JSON.stringify(MOD, null, 2));
console.log('OK · sb_bookings__upgrades payment columns added');
