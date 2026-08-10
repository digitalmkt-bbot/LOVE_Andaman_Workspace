'use strict';
// Mapper update 2026-08 · §openMap · แผนที่ที่ "คีย์ชั้นในเปิดกว้าง" ห้ามเป็นคอลัมน์ตายตัว
//
// แมปถูกสร้างจาก snapshot ของข้อมูลจริง ณ วันนั้น · คีย์ชั้นในที่บังเอิญมีอยู่ตอนนั้น
// จึงกลายเป็น "คอลัมน์" ไปเลย · คีย์ใหม่ที่เกิดทีหลัง (เรือลำใหม่ · ท่าใหม่) ไม่มีคอลัมน์
// decomposeBlob จึงทิ้งค่าทิ้งเงียบ ๆ ทุกครั้งที่บันทึก
//
//   fleet_fuelprice · คอลัมน์: panwa, b10, b2, b13, b6
//        → ราคาน้ำมันรายลำของ b12 ใส่แล้วหายทุกครั้ง (อาการที่ผู้ใช้เจอ)
//          และราคาของท่าอื่นที่ไม่ใช่ panwa ก็หายเหมือนกัน
//   fleet_drlock · คอลัมน์: panwa เท่านั้น
//        → กด Save/ล็อกใบ Daily Fleet Log ของท่า Tub Lamu ไม่เคยถูกบันทึก
//
// ทั้งคู่เป็นแผนที่แบน (วันที่ → คีย์ → ค่า) จึงเก็บทั้งก้อนเป็น JSON ได้ตรง ๆ
// รูปแบบเดียวกับที่ update_mapping_2026_07.js ใช้กับ sb_market_stats / nat_learn
//
// fleet_daily แก้คนละทาง — ดู os_repo.js §FD_BOAT · คอลัมน์เดิมคงไว้ทั้งหมดและยังเขียนอยู่
// ตารางลูกใหม่แค่ทับซ้อนข้อมูลเดิม จึงไม่มีจังหวะไหนที่ข้อมูลเก่าพึ่งพาการ migrate
const fs = require('fs');
const MAPF = 'src/mapping/field_mapping.json', MODF = 'src/mapping/operation_schemas_model.json';
const MAP = JSON.parse(fs.readFileSync(MAPF, 'utf8'));
const MOD = JSON.parse(fs.readFileSync(MODF, 'utf8'));

const modCols = cols => Object.entries(cols).map(([name, i]) => ({ name, type: i.db_type }));
function setModel(table, cols, pk, fks){ MOD[table] = { columns: modCols(cols), primary_key: pk, foreign_keys: fks || [], rows: 0 }; }

// ── แผนที่ชั้นบนที่คีย์ชั้นในเปิดกว้าง → เก็บค่าทั้งก้อนเป็น JSON ──
for (const k of ['fleet_fuelprice', 'fleet_drlock']) {
  MAP[k] = {
    id:    { source: k + ' map key (generated id)', kind: 'pk',             db_type: 'text' },
    key:   { source: k + ' map key (original)',     kind: 'map_key',        db_type: 'text' },
    value: { source: k + '[key] value',             kind: 'map_value_json', db_type: 'text' },
  };
  setModel(k, MAP[k], 'id');
}

// ── fleet_daily · ฟิลด์รายลำ (fuel · paxActual · อะไรก็ตามที่เพิ่มมาทีหลัง) ──
//    คอลัมน์เดิมของ fleet_daily ไม่ถูกแตะ · ตารางนี้ทับซ้อนไว้ให้ครบทุกลำ
MAP['fleet_daily__boat'] = {
  fleet_daily_id: { source: '(link) fleet_daily.id',                  kind: 'fk',             db_type: 'text' },
  key:            { source: '(map key of fleet_daily[key].boats)',    kind: 'map_key',        db_type: 'text' },
  row_pk:         { source: '(generated child key)',                  kind: 'synthetic-pk',   db_type: 'text' },
  value:          { source: 'fleet_daily[key][boat] scalars',         kind: 'map_value_json', db_type: 'text' },
};
setModel('fleet_daily__boat', MAP['fleet_daily__boat'], 'row_pk', [{ column: 'fleet_daily_id', references: 'fleet_daily.id' }]);

fs.writeFileSync(MAPF, JSON.stringify(MAP, null, 2));
fs.writeFileSync(MODF, JSON.stringify(MOD, null, 2));
console.log('OK · fleet_fuelprice / fleet_drlock → open map · fleet_daily__boat added');
