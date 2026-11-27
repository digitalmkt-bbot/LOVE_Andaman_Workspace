// UI parity · capture noise the comparison ignores (round 9, 2026-11-27). Each rule names the state that proved it and is
// as narrow as that proof: it never hides a line whose numbers differ between the two sides.
//
// 1. prpo (every state): "ข้อมูลอัพเดตเวลา 27 พ.ย. 2569 18:27 · โดย uiparity" is the minute the page was rendered and the
//    login that rendered it (legacy 18:27, new 18:32/18:33, "โดย RM" on the new side after a write). Only the time and
//    the user are masked; the line itself must still be on both sides.
// 2. actionboard "By agent" / "All piers" / "Tub Lamu" (2026-11-27T11-20-33): "GREENMAN 6" vs "TRIPCOM 6", "SUPERYAC 2" vs
//    "HANATOUR 2" · agents tied on the same count come in another order, so a top-N list cuts the tie elsewhere. A line
//    missing on one side and a line extra on the other are paired only when they carry exactly the same numbers and the
//    same shape (only the label differs), and the label has no digits; the pair is reported in `tiePairs`, not dropped.
// 3. sales-board (page open): the PAX column counts up from 0 (`_sbAnimate`, `.sb-cnt`, 950 ms + 45 ms per rank) and was
//    read mid-way (7,641 vs 7,580). `countUpDone` is what settle() waits for: every `.sb-cnt` shows its `data-pax`.
// 4. actionboard (page open, round 8: 947 vs 922 lines): read while the new side still showed its loading line.
//    `opsLoading` is what settle() also waits on: the ops placeholder (`.la-ops-loading`, `[data-ops-loading]`).
// 5. operation "Visit Panwa" / "Week" / "Month" / "ตัดสินใจ ▾" (2026-11-27T16-32-31, round 10): "สรุปช่วงออกเรือ · พยากรณ์ล่าสุด
//    23:32" vs "23:33" is the minute the forecast was last read on each side. Only the HH:MM of that exact line is masked; the
//    weather summary lines under it are compared as they are.
// 6. execboard (every state): "ศุกร์ 27 พ.ย. 2026 · อัปเดต 23:37 · วาดใหม่ทุก 1 นาที" is the clock of the board's last redraw (once
//    a minute). Only the HH:MM after "อัปเดต" is masked; the date before it and the rest of the line must still match.

const STAMP = /^(ข้อมูลอัพเดตเวลา )\d{1,2} \S+ \d{4} \d{1,2}:\d{2}( · โดย ).+$/;
const FORECAST = /^(สรุปช่วงออกเรือ · พยากรณ์ล่าสุด )\d{1,2}:\d{2}$/;              // rule 5
const EB_CLOCK = /^(.+ · อัปเดต )\d{1,2}:\d{2}( · วาดใหม่ทุก \d+ นาที)$/;          // rule 6
/** A line with its volatile part masked (rules 1, 5, 6); any other line as it is. */
export const maskLine = (line) => {
  if (typeof line !== 'string') return line;
  if (STAMP.test(line)) return line.replace(STAMP, '$1<เวลา>$2<ผู้ใช้>');
  if (FORECAST.test(line)) return line.replace(FORECAST, '$1<เวลา>');
  if (EB_CLOCK.test(line)) return line.replace(EB_CLOCK, '$1<เวลา>$2');
  return line;
};
export const maskLines = (lines) => (lines || []).map(maskLine);

const NUM = /-?\d[\d,]*(\.\d+)?/g;
/**
 * Rule 2: pairs of (missing, extra) lines that are the same row with tied counts in another order. Both lines must have at
 * least one number, the same numbers in the same places, and differ only in a label without digits. Greedy, first match.
 */
export function tiePairs(missing, extra) {
  const nums = (x) => x.match(NUM) || [];
  // the line's structure: numbers as #, each word of the label as L (so only the label's words may differ)
  const shape = (x) => x.replace(NUM, '#').replace(/[^\s#·()%,+\-−/]+/gu, 'L');
  const label = (x) => x.replace(NUM, '').replace(/[·()%\s,+\-−/]+/g, ' ').trim();
  const used = new Set(), pairs = [];
  for (const m of missing) {
    const n = nums(m); if (!n.length || !label(m) || /\d/.test(label(m))) continue;
    const i = extra.findIndex((e, k) => !used.has(k) && e !== m && shape(e) === shape(m) && nums(e).join('|') === n.join('|') && label(e) && !/\d/.test(label(e)));
    if (i < 0) continue;
    used.add(i); pairs.push([m, extra[i]]);
  }
  return pairs;
}

/** Rule 3, run in the page: every count-up cell of the sales board shows its final number. */
export function countUpDone() {
  const cells = document.querySelectorAll('.view.active .sb-cnt, #salesboard-wrap .sb-cnt');
  for (const el of cells) { const want = (+el.dataset.pax || 0).toLocaleString(); if (el.textContent.trim() !== want) return false; }
  return true;
}
/** Rule 4, run in the page: the ops loading placeholder is still on the active view. */
export function opsLoading() {
  const root = document.querySelector('.view.active') || document.body;
  return !!root.querySelector('.la-ops-loading, [data-ops-loading="1"]');
}
