'use strict';
// Mapper update 2026-08 · §vanBill · วางบิลรถร่วม เก็บลงฐานไม่ได้เลย
//
// VAN_BILL['ผู้ให้บริการ|รถ|YYYY-MM|งวด'] = {perPax, rate, rows:{...}, extra:[...], by, at}
//   perPax = ราคาขายต่อคนทั้งงวด · rate = เรตเรียกเก็บต่อคันตั้งต้น
//   rows   = ค่าที่แก้เฉพาะแถว (rate / ex / cut / per) · คีย์เป็น 'วันที่~เส้นทาง~รถ'
//   extra  = งานรถนอกที่ไม่ได้ผ่านใบงาน · เป็น array ของ object
//
// ค่าเป็นทั้ง object ซ้อน map และ array → ต้องเก็บทั้งก้อนเป็น JSON text
// รูปแบบเดียวกับ vanjob_sent / pier_team เป๊ะ ({id, key, value})
// ข้อดี: เพิ่มช่องในใบวางบิลภายหลังไม่ต้องแตะ DB อีก
//
// ไม่มีตารางนี้ = decomposeBlob ทิ้งทั้งก้อนทุกครั้งที่บันทึกขึ้นเซิร์ฟเวอร์
// ใบวางบิลจะอยู่แค่ localStorage ของเครื่องที่กรอก — บัญชีเปิดอีกเครื่องเห็นว่าง
const fs = require('fs');
const MAPF = 'src/mapping/field_mapping.json', MODF = 'src/mapping/operation_schemas_model.json';
const MAP = JSON.parse(fs.readFileSync(MAPF, 'utf8'));
const MOD = JSON.parse(fs.readFileSync(MODF, 'utf8'));

const modCols = cols => Object.entries(cols).map(([name, i]) => ({ name, type: i.db_type }));
function setModel(table, cols, pk, fks){ MOD[table] = { columns: modCols(cols), primary_key: pk, foreign_keys: fks || [], rows: 0 }; }

MAP.van_bill = {
  id:    { source: 'van_bill map key (generated id)', kind: 'pk',              db_type: 'text' },
  key:   { source: 'van_bill map key (original)',     kind: 'map_key',         db_type: 'text' },
  value: { source: 'van_bill[key] value',             kind: 'map_value_json',  db_type: 'text',
           note: 'ทั้งก้อนเป็น JSON text เหมือน vanjob_sent — perPax/rate/rows/extra/by/at เพิ่มช่องได้โดยไม่ต้องแตะ DB' },
};
setModel('van_bill', MAP.van_bill, 'id');

fs.writeFileSync(MAPF, JSON.stringify(MAP, null, 2));
fs.writeFileSync(MODF, JSON.stringify(MOD, null, 2));
console.log('OK · van_bill table added');
