<template>
  <div>
    <div class="page-hd">
      <div>
        <h1>Daily Availability</h1>
        <p>ความพร้อมที่นั่งรายวัน — ใช้ copy เพื่อส่ง Line</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-ghost btn-sm" @click="prevDay">← ก่อนหน้า</button>
        <button class="btn btn-ghost btn-sm" @click="goToday" :class="{ 'btn-primary': dateStr === data.TODAY }">วันนี้</button>
        <button class="btn btn-ghost btn-sm" @click="nextDay">ถัดไป →</button>
        <button class="btn btn-primary btn-sm" :class="{ done: copied }" @click="copyMessage">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
          {{ copied ? 'Copied!' : 'Copy message' }}
        </button>
      </div>
    </div>

    <div class="da-date-bar">
      <span class="da-date-label">{{ dateLabelFull }}</span>
    </div>

    <div class="da-layout">
      <!-- Left: visual availability -->
      <div class="card">
        <template v-for="pier in ['tublamu', 'panwa']" :key="pier">
          <template v-if="Object.keys(groups[pier] || {}).length">
            <div class="da-pier-lbl">
              <div class="da-pier-dot" :style="{ background: pier === 'tublamu' ? 'var(--ocean-mid)' : 'var(--green)' }"></div>
              {{ pier === 'tublamu' ? 'Tub Lamu Pier' : 'Visit Panwa' }}
            </div>
            <div
              v-for="row in Object.values(groups[pier])"
              :key="`${row.r.id}-${row.type}`"
              class="da-route-row"
            >
              <div class="da-rr-dot" :style="{ background: row.r.color }"></div>
              <span class="da-rr-name">{{ row.r.name }}</span>
              <span class="da-type-chip" :class="row.type === 'early' ? 'chip-early' : 'chip-normal'">
                {{ row.type === 'early' ? 'Early' : 'Normal' }}
              </span>
              <template v-if="fillPct(row) >= 95">
                <span class="da-rr-full">✕ Full</span>
              </template>
              <template v-else>
                <span class="da-rr-free" :style="{ color: freeColor(fillPct(row)) }">{{ row.allot - row.booked }}</span>
                <span class="da-rr-of"> /{{ row.allot }}</span>
              </template>
            </div>
          </template>
        </template>
        <div v-if="totalRows === 0" class="da-empty">ไม่มีเที่ยวออกวันนี้</div>
      </div>

      <!-- Right: copy-ready text preview -->
      <div class="card da-preview-card">
        <div class="card-title" style="margin-bottom:8px">Preview Message</div>
        <pre class="da-preview-text">{{ previewText }}</pre>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useAppData } from '../../composables/useAppData'

const data = useAppData()

const dateObj = ref(new Date())
const dateStr = computed(() => dateObj.value.toISOString().slice(0, 10))
const dateLabelFull = computed(() =>
  dateObj.value.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
)

function prevDay() { dateObj.value = new Date(dateObj.value.getTime() - 86400000) }
function nextDay() { dateObj.value = new Date(dateObj.value.getTime() + 86400000) }
function goToday() { dateObj.value = new Date() }

const groups = computed(() => data.buildDAGroups(dateStr.value))
const totalRows = computed(() =>
  Object.keys(groups.value.tublamu || {}).length + Object.keys(groups.value.panwa || {}).length
)

function fillPct(row) {
  return row.allot > 0 ? Math.round((row.booked / row.allot) * 100) : 0
}
function freeColor(pct) {
  if (pct >= 85) return 'var(--red)'
  if (pct >= 65) return 'var(--amber)'
  return 'var(--green)'
}

const previewText = computed(() => {
  const label = dateObj.value.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
  const lines = [`🚢 LOVE Andaman  |  ${label}`, '']
  const pierNames = { tublamu: 'Tub Lamu Pier', panwa: 'Visit Panwa' }
  for (const pier of ['tublamu', 'panwa']) {
    const rows = Object.values(groups.value[pier] || {})
    if (!rows.length) continue
    lines.push(`📍 ${pierNames[pier]}`)
    for (const row of rows) {
      const free = row.allot - row.booked
      const pct = fillPct(row)
      const lbl = `${row.r.name} — ${row.type === 'early' ? 'Early' : 'Normal'}`
      lines.push(pct >= 95
        ? `✕  ${lbl.padEnd(28)}Full`
        : `✓  ${lbl.padEnd(28)}${free} seats`
      )
    }
    lines.push('')
  }
  lines.push('📩 Line: @loveandaman')
  return lines.join('\n')
})

const copied = ref(false)
function copyMessage() {
  navigator.clipboard.writeText(previewText.value).then(() => {
    copied.value = true
    setTimeout(() => (copied.value = false), 2500)
  })
}
</script>

<style scoped>
.da-date-bar { margin-bottom: 14px; }
.da-date-label { font-size: 15px; font-weight: 600; color: var(--ink); }
.da-layout { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; align-items: start; }
.da-pier-lbl {
  display: flex; align-items: center; gap: 7px;
  font-size: 10px; font-weight: 700; text-transform: uppercase;
  letter-spacing: .05em; color: var(--ink-mid);
  padding: 10px 0 6px; margin-top: 4px;
}
.da-pier-dot { width: 6px; height: 6px; border-radius: 50%; }
.da-route-row {
  display: flex; align-items: center; gap: 8px;
  padding: 7px 0; border-bottom: 1px solid var(--border);
}
.da-route-row:last-child { border-bottom: none; }
.da-rr-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.da-rr-name { flex: 1; font-size: 12px; font-weight: 500; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.da-type-chip { font-size: 9px; font-weight: 500; padding: 1px 5px; border-radius: 3px; flex-shrink: 0; }
.chip-early  { background: #fff7d6; color: #7a5500; }
.chip-normal { background: var(--ocean-50); color: var(--ocean); }
.da-rr-free { font-size: 13px; font-weight: 700; min-width: 24px; text-align: right; }
.da-rr-of   { font-size: 11px; color: var(--ink-soft); }
.da-rr-full { font-size: 11px; font-weight: 700; color: var(--red); }
.da-empty   { padding: 24px 0; text-align: center; color: var(--ink-soft); font-size: 12px; }
.da-preview-card { display: flex; flex-direction: column; }
.da-preview-text {
  font-family: 'DM Mono', monospace; font-size: 11px; line-height: 1.7;
  color: var(--ink-mid); white-space: pre-wrap;
  background: var(--sand); border-radius: var(--r-sm); padding: 12px; margin: 0;
}
.btn.done { background: var(--green); border-color: var(--green); color: #fff; }
</style>
