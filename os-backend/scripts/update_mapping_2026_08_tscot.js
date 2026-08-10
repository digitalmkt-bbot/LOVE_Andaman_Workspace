'use strict';
// Mapper update 2026-08 · §tsCotSettle เก็บลงฐานไม่ได้เลย
//
// TS_COT (คำตัดสินว่าเงิน COT ที่ลูกค้าจ่ายหน้างานจะหักบิล / โอนออก / บริษัทรับไว้)
// ไม่เคยมีตารางในแมป · decomposeBlob จึงทิ้งทั้งก้อนทุกครั้งที่บันทึกขึ้นเซิร์ฟเวอร์
// ผลคือคำตัดสินอยู่แค่ localStorage ของเครื่องที่กด — เครื่องอื่นเห็นเป็น
// "ยังไม่ตัดสิน" ตลอด และหายทันทีที่ล้าง localStorage หรือย้ายเครื่อง
//
// รูปแบบเดียวกับ travel_sum เป๊ะ (map key → ฟิลด์คงที่) เพราะเป็นข้อมูลชุดเดียวกัน
// คนละมุม: travel_sum = เก็บเท่าไร · ts_cot = เงินที่เก็บมาแล้วเอาไปไหน
const fs = require('fs');
const MAPF = 'src/mapping/field_mapping.json', MODF = 'src/mapping/operation_schemas_model.json';
const MAP = JSON.parse(fs.readFileSync(MAPF, 'utf8'));
const MOD = JSON.parse(fs.readFileSync(MODF, 'utf8'));

const modCols = cols => Object.entries(cols).map(([name, i]) => ({ name, type: i.db_type }));
function setModel(table, cols, pk, fks){ MOD[table] = { columns: modCols(cols), primary_key: pk, foreign_keys: fks || [], rows: 0 }; }

MAP.ts_cot = {
  id:     { source: 'ts_cot map key (generated id)', kind: 'pk',       db_type: 'text' },
  key:    { source: 'ts_cot map key (original)',     kind: 'map_key',  db_type: 'text' },
  mode:   { source: 'ts_cot[key].mode',              kind: 'scalar',   db_type: 'text' },
  deduct: { source: 'ts_cot[key].deduct',            kind: 'scalar',   db_type: 'bigint' },
  payout: { source: 'ts_cot[key].payout',            kind: 'scalar',   db_type: 'bigint' },
  ref:    { source: 'ts_cot[key].ref',               kind: 'scalar',   db_type: 'text' },
  by:     { source: 'ts_cot[key].by',                kind: 'scalar',   db_type: 'text' },
  at:     { source: 'ts_cot[key].at',                kind: 'scalar',   db_type: 'text' },
};
setModel('ts_cot', MAP.ts_cot, 'id');

fs.writeFileSync(MAPF, JSON.stringify(MAP, null, 2));
fs.writeFileSync(MODF, JSON.stringify(MOD, null, 2));
console.log('OK · ts_cot table added');
