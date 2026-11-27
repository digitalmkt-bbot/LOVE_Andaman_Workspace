// UI parity noise rules (test/uiparity/noise.mjs), on the lines of run 2026-11-27T11-20-33: each rule hides what the run
// proved to be capture noise and nothing else.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { maskLine, tiePairs } from '../uiparity/noise.mjs';

test('rule 1 (prpo): the "updated at" stamp is masked in its time and user only', () => {
  const a = maskLine('ข้อมูลอัพเดตเวลา 27 พ.ย. 2569 18:27 · โดย uiparity');
  const b = maskLine('ข้อมูลอัพเดตเวลา 27 พ.ย. 2569 18:33 · โดย RM');
  assert.equal(a, b);
  assert.equal(maskLine('299 จาน · แพ้อาหาร 93 คน + ยังไม่รู้จำนวน 35 ใบ'), '299 จาน · แพ้อาหาร 93 คน + ยังไม่รู้จำนวน 35 ใบ', 'other lines untouched');
  assert.equal(maskLine('ข้อมูลอัพเดต 18:27'), 'ข้อมูลอัพเดต 18:27', 'only the exact stamp');
});

test('rule 2 (actionboard): rows tied on the same numbers in another order pair up; a different number never does', () => {
  assert.deepEqual(tiePairs(['GREENMAN 6', 'GREENMAN 4'], ['TRIPCOM 6', 'PINKDUGO 4']), [['GREENMAN 6', 'TRIPCOM 6'], ['GREENMAN 4', 'PINKDUGO 4']]);
  assert.deepEqual(tiePairs(['SUPERYAC 2'], ['HANATOUR 2']), [['SUPERYAC 2', 'HANATOUR 2']]);
  assert.deepEqual(tiePairs(['อิสราเอล · 274'], ['เม็กซิโก · 274']), [['อิสราเอล · 274', 'เม็กซิโก · 274']], 'a tie on the guest-insights list');
  // real differences stay
  assert.deepEqual(tiePairs(['ว่าง 610'], ['ว่าง 611']), [], 'same label, other number');
  assert.deepEqual(tiePairs(['10,778 คน · มีอายุ 4,751'], ['10,776 คน · มีอายุ 4,751']), []);
  assert.deepEqual(tiePairs(['▲ +5,484 (64%)'], ['▲ +5,483 (64%)']), []);
  assert.deepEqual(tiePairs(['Aluminous1 44'], ['Aluminous1 38']), []);
  assert.deepEqual(tiePairs(['locks'], ['lock']), [], 'no number, no pair');
  assert.deepEqual(tiePairs(['12,267รวมทั้งช่วง'], ['12,233รวมทั้งช่วง']), []);
  assert.deepEqual(tiePairs(['B2 6'], ['C3 6']), [], 'a label with digits is not paired');
  assert.deepEqual(tiePairs(['GREENMAN 6 · 3 ลำ'], ['TRIPCOM 6 · 2 ลำ']), [], 'all numbers must match');
});

test('rule 5 (operation): the forecast stamp is masked in its minute only', () => {
  const a = maskLine('สรุปช่วงออกเรือ · พยากรณ์ล่าสุด 23:32'), b = maskLine('สรุปช่วงออกเรือ · พยากรณ์ล่าสุด 23:33');
  assert.equal(a, b);
  assert.equal(a, 'สรุปช่วงออกเรือ · พยากรณ์ล่าสุด <เวลา>');
  assert.equal(maskLine('ฝนฟ้าคะนอง 16 น.'), 'ฝนฟ้าคะนอง 16 น.', 'the weather lines are compared as they are');
  assert.equal(maskLine('พยากรณ์ล่าสุด 23:32'), 'พยากรณ์ล่าสุด 23:32', 'only the exact line');
});

test('rule 6 (execboard): the redraw clock is masked; the date must still match', () => {
  const a = maskLine('ศุกร์ 27 พ.ย. 2026 · อัปเดต 23:37 · วาดใหม่ทุก 1 นาที'), b = maskLine('ศุกร์ 27 พ.ย. 2026 · อัปเดต 23:38 · วาดใหม่ทุก 1 นาที');
  assert.equal(a, b);
  assert.notEqual(a, maskLine('เสาร์ 28 พ.ย. 2026 · อัปเดต 23:37 · วาดใหม่ทุก 1 นาที'), 'another day is still a difference');
  assert.equal(maskLine('LIVE · 23:37'), 'LIVE · 23:37', 'other clock lines untouched');
});
