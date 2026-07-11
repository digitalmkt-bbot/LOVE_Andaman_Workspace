<template>
  <div>
    <div class="page-hd">
      <div>
        <h1>Boat Operation</h1>
        <p>ตารางการเดินเรือรายวัน — กำหนด route และดู fill rate</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-ghost btn-sm" @click="prevDay">← ก่อนหน้า</button>
        <button class="btn btn-ghost btn-sm" @click="goToday">วันนี้</button>
        <button class="btn btn-ghost btn-sm" @click="nextDay">ถัดไป →</button>
      </div>
    </div>

    <div class="op-date-bar">
      <span class="op-date-lbl">{{ dateLabelFull }}</span>
      <span v-if="dateStr === TODAY" class="pill pill-green">Today</span>
    </div>

    <!-- Summary strip -->
    <div class="op-summary">
      <div class="kpi">
        <div class="kpi-lbl">Boats Out</div>
        <div class="kpi-val" style="color:var(--ocean-mid)">{{ opRows.length }}</div>
        <div class="kpi-sub">/ {{ boats.length }} total</div>
      </div>
      <div class="kpi k-green">
        <div class="kpi-lbl">Total Seats</div>
        <div class="kpi-val">{{ opRows.reduce((s,r) => s + r.cap, 0) }}</div>
        <div class="kpi-sub">allotted</div>
      </div>
      <div class="kpi">
        <div class="kpi-lbl">Booked</div>
        <div class="kpi-val" :style="{ color: summaryFillColor }">{{ opRows.reduce((s,r) => s + (r.booked||0), 0) }}</div>
        <div class="kpi-sub">{{ summaryFillPct }}% fill</div>
      </div>
      <div class="kpi">
        <div class="kpi-lbl">Charter</div>
        <div class="kpi-val">{{ opRows.filter(r => r.type === 'charter').length }}</div>
        <div class="kpi-sub">charters</div>
      </div>
    </div>

    <!-- Ops table -->
    <div class="card" style="padding:0;overflow:hidden">
      <div class="op-table-hd">
        <span>Boat</span>
        <span>Route</span>
        <span>Type</span>
        <span>Status</span>
        <span>Booked / Cap</span>
        <span>Fill</span>
      </div>

      <div v-if="!opRows.length" class="op-empty">ไม่มีการดำเนินการวันนี้</div>

      <div v-for="row in opRows" :key="row.bid" class="op-row">
        <div class="op-boat">
          <div class="op-boat-dot" :style="{ background: boatColor(row.bid) }"></div>
          <span class="op-boat-name">{{ row.boatName }}</span>
        </div>

        <div class="op-route">
          <span v-if="row.route" class="op-route-dot" :style="{ background: row.routeColor }"></span>
          <span>{{ row.routeName }}</span>
        </div>

        <span>
          <span class="pill" :class="typePill(row.type)">{{ row.type || '—' }}</span>
        </span>

        <span>
          <span class="pill" :class="statusPill(row.boatStatus)">{{ row.boatStatus || 'available' }}</span>
        </span>

        <span class="op-bk-nums">
          <template v-if="row.type === 'charter'">
            <span class="pill pill-amber">Charter</span>
          </template>
          <template v-else>
            <span :style="{ color: rowFillColor(row), fontWeight: 700 }">{{ row.booked || 0 }}</span>
            <span style="color:var(--ink-soft)"> / {{ row.cap }}</span>
          </template>
        </span>

        <div class="op-fill-wrap" v-if="row.type !== 'charter'">
          <div class="op-fill-track">
            <div class="op-fill-bar" :style="{ width: rowFillPct(row) + '%', background: rowFillColor(row) }"></div>
          </div>
          <span class="op-fill-pct" :style="{ color: rowFillColor(row) }">{{ rowFillPct(row) }}%</span>
        </div>
        <div v-else></div>
      </div>

      <!-- Idle boats -->
      <template v-if="idleBoats.length">
        <div class="op-divider">Idle today ({{ idleBoats.length }})</div>
        <div v-for="b in idleBoats" :key="b.id" class="op-row op-row-idle">
          <div class="op-boat">
            <div class="op-boat-dot" :style="{ background: '#ccc' }"></div>
            <span class="op-boat-name" style="color:var(--ink-soft)">{{ b.name }}</span>
          </div>
          <span style="color:var(--ink-soft);font-size:11px">—</span>
          <span></span>
          <span>
            <span class="pill pill-gray">{{ curStatus(b).s }}</span>
          </span>
          <span></span>
          <span></span>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useAppData } from '../../composables/useAppData'

const { routes, boats, trips, getRoute, getBoat, getCurStatus, TODAY } = useAppData()

const dateObj = ref(new Date())
const dateStr = computed(() => dateObj.value.toISOString().slice(0, 10))
const dateLabelFull = computed(() =>
  dateObj.value.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
)
function prevDay() { dateObj.value = new Date(dateObj.value.getTime() - 86400000) }
function nextDay() { dateObj.value = new Date(dateObj.value.getTime() + 86400000) }
function goToday()  { dateObj.value = new Date() }

const dayOps = computed(() => trips.value[dateStr.value] || {})

const opRows = computed(() => {
  return Object.entries(dayOps.value)
    .filter(([, op]) => !Array.isArray(op))
    .map(([bid, op]) => {
      const b = getBoat(bid) || { id: bid, name: bid, cap: 0, log: [] }
      const r = getRoute(op.route)
      const status = getCurStatus(b, dateStr.value)
      return {
        bid,
        boatName:    b.name,
        cap:         b.cap || 0,
        route:       op.route,
        routeName:   r?.name || op.route || '—',
        routeColor:  r?.color || '#ccc',
        type:        op.type,
        booked:      op.booked || 0,
        boatStatus:  status?.s || 'available',
      }
    })
    .sort((a, b) => a.boatName.localeCompare(b.boatName))
})

const deployedIds = computed(() => new Set(opRows.value.map(r => r.bid)))
const idleBoats   = computed(() => boats.value.filter(b => !deployedIds.value.has(b.id)))

const totalSeats  = computed(() => opRows.value.reduce((s, r) => s + r.cap, 0))
const totalBooked = computed(() => opRows.value.reduce((s, r) => s + (r.booked || 0), 0))
const summaryFillPct   = computed(() => totalSeats.value > 0 ? Math.round(totalBooked.value / totalSeats.value * 100) : 0)
const summaryFillColor = computed(() => fillColor(summaryFillPct.value))

function rowFillPct(row) { return row.cap > 0 ? Math.round((row.booked || 0) / row.cap * 100) : 0 }
function rowFillColor(row) { return fillColor(rowFillPct(row)) }
function fillColor(p)  { return p >= 85 ? 'var(--red)' : p >= 65 ? 'var(--amber)' : 'var(--green)' }

function typePill(t) {
  if (t === 'charter') return 'pill-amber'
  if (t === 'early')   return 'pill-blue'
  return 'pill-green'
}
function statusPill(s) {
  if (!s || s === 'available') return 'pill-green'
  if (s === 'maintenance' || s === 'repair') return 'pill-red'
  return 'pill-gray'
}
function boatColor(bid) {
  const b = getBoat(bid)
  return b?.color || '#aaa'
}
function curStatus(b) { return getCurStatus(b, dateStr.value) }
</script>

<style scoped>
.op-date-bar { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; }
.op-date-lbl { font-size: 15px; font-weight: 600; }

.op-summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 14px; }

.op-table-hd {
  display: grid;
  grid-template-columns: 160px 1fr 90px 110px 120px 140px;
  gap: 10px; padding: 8px 14px;
  background: var(--sand); border-bottom: 1px solid var(--border);
  font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: var(--ink-soft);
}
.op-row {
  display: grid;
  grid-template-columns: 160px 1fr 90px 110px 120px 140px;
  gap: 10px; padding: 10px 14px; align-items: center;
  border-bottom: 1px solid var(--border); transition: background .1s;
}
.op-row:last-child { border-bottom: none; }
.op-row:hover { background: var(--sand); }
.op-row-idle { opacity: .6; }

.op-boat { display: flex; align-items: center; gap: 8px; }
.op-boat-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.op-boat-name { font-size: 12px; font-weight: 600; }

.op-route { display: flex; align-items: center; gap: 6px; font-size: 12px; }
.op-route-dot { display: inline-block; width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }

.op-bk-nums { font-size: 13px; }

.op-fill-wrap { display: flex; align-items: center; gap: 8px; }
.op-fill-track { flex: 1; height: 6px; background: var(--border); border-radius: 3px; overflow: hidden; }
.op-fill-bar { height: 100%; border-radius: 3px; }
.op-fill-pct { font-size: 10px; font-weight: 700; min-width: 30px; text-align: right; }

.op-divider {
  padding: 6px 14px; background: var(--sand-dark);
  font-size: 9px; font-weight: 700; text-transform: uppercase;
  letter-spacing: .05em; color: var(--ink-soft);
  border-top: 1px solid var(--border); border-bottom: 1px solid var(--border);
}
.op-empty { padding: 32px; text-align: center; color: var(--ink-soft); font-size: 12px; }
</style>
