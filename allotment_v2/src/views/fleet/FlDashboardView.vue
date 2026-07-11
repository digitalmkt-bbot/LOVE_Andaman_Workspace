<template>
  <div>
    <div class="page-hd">
      <div>
        <h1>Fleet Dashboard</h1>
        <p>ภาพรวมกองเรือ — สถานะ, การใช้งาน, และสรุปรายเดือน</p>
      </div>
    </div>

    <!-- Top KPIs -->
    <div class="fld-kpi-row">
      <div class="kpi k-green">
        <div class="kpi-lbl">Available</div>
        <div class="kpi-val" style="color:var(--green)">{{ availableCount }}</div>
        <div class="kpi-sub">/ {{ boats.length }} boats</div>
      </div>
      <div class="kpi k-ocean">
        <div class="kpi-lbl">Deployed Today</div>
        <div class="kpi-val" style="color:var(--ocean-mid)">{{ deployedToday }}</div>
        <div class="kpi-sub">on water</div>
      </div>
      <div class="kpi k-coral">
        <div class="kpi-lbl">In Maintenance</div>
        <div class="kpi-val" style="color:var(--red)">{{ maintCount }}</div>
        <div class="kpi-sub">out of service</div>
      </div>
      <div class="kpi">
        <div class="kpi-lbl">Total Capacity</div>
        <div class="kpi-val">{{ totalCap }}</div>
        <div class="kpi-sub">pax (fleet total)</div>
      </div>
      <div class="kpi">
        <div class="kpi-lbl">Today Seats</div>
        <div class="kpi-val">{{ todaySeats }}</div>
        <div class="kpi-sub">{{ todayBooked }} booked · {{ todayFill }}%</div>
      </div>
    </div>

    <div class="fld-layout">
      <!-- Left: Boat summary list -->
      <div>
        <div class="fld-section-hd">Boats</div>
        <div class="card fld-boat-list">
          <div v-for="b in boats" :key="b.id" class="fld-boat-row">
            <div class="fld-boat-status-bar" :class="`bar-${statusKey(b)}`"></div>
            <div class="fld-boat-info">
              <div class="fld-boat-name">{{ b.name }}</div>
              <div class="fld-boat-meta">
                <span style="color:var(--ink-soft)">{{ b.cap || 0 }} pax</span>
                <span v-if="todayOp(b.id)" class="fld-today-route" :style="{ color: todayOpColor(b.id) }">
                  · {{ todayOpName(b.id) }}
                </span>
              </div>
            </div>
            <span class="pill" :class="statusPill(b)" style="flex-shrink:0">{{ curStatus(b).s || 'available' }}</span>
          </div>
        </div>
      </div>

      <!-- Right: Usage heatmap for last 30 days + upcoming -->
      <div>
        <div class="fld-section-hd">Deployment — last 30 days</div>
        <div class="card fld-heat-card">
          <div class="fld-heat-grid">
            <div class="fld-heat-row" v-for="b in boats" :key="b.id">
              <div class="fld-heat-label">{{ b.name }}</div>
              <div class="fld-heat-cells">
                <div
                  v-for="ds in last30"
                  :key="ds"
                  class="fld-heat-cell"
                  :class="cellClass(b.id, ds)"
                  :title="`${b.name} · ${ds} · ${cellLabel(b.id, ds)}`"
                ></div>
              </div>
            </div>
          </div>
          <div class="fld-heat-legend">
            <span class="fld-heat-leg-item"><span class="fld-heat-leg-dot leg-deployed"></span>Deployed</span>
            <span class="fld-heat-leg-item"><span class="fld-heat-leg-dot leg-charter"></span>Charter</span>
            <span class="fld-heat-leg-item"><span class="fld-heat-leg-dot leg-maint"></span>Maintenance</span>
            <span class="fld-heat-leg-item"><span class="fld-heat-leg-dot leg-idle"></span>Idle</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useAppData } from '../../composables/useAppData'

const { boats, trips, getRoute, getCurStatus, TODAY } = useAppData()

// last 30 days
const last30 = computed(() => {
  const days = []
  for (let i = 29; i >= 0; i--) {
    const d = new Date(new Date(TODAY).getTime() - i * 86400000)
    days.push(d.toISOString().slice(0, 10))
  }
  return days
})

const todayOps = computed(() => trips.value[TODAY] || {})

function curStatus(b) { return getCurStatus(b, TODAY) }
function statusKey(b) {
  const s = curStatus(b).s
  if (!s || s === 'available') return 'ok'
  if (s === 'maintenance' || s === 'repair') return 'out'
  return 'other'
}
function statusPill(b) {
  const k = statusKey(b)
  return k === 'ok' ? 'pill-green' : k === 'out' ? 'pill-red' : 'pill-gray'
}

const availableCount = computed(() => boats.value.filter(b => statusKey(b) === 'ok').length)
const maintCount     = computed(() => boats.value.filter(b => statusKey(b) === 'out').length)
const deployedToday  = computed(() => Object.keys(todayOps.value).length)
const totalCap       = computed(() => boats.value.reduce((s, b) => s + (b.cap || 0), 0))

const todaySeats  = computed(() => {
  return Object.entries(todayOps.value).reduce((s, [bid, op]) => {
    if (Array.isArray(op)) return s
    const b = boats.value.find(x => x.id === bid)
    return s + (b?.cap || 0)
  }, 0)
})
const todayBooked = computed(() => {
  return Object.values(todayOps.value).reduce((s, op) => {
    if (Array.isArray(op)) return s
    return s + (op.booked || 0)
  }, 0)
})
const todayFill = computed(() =>
  todaySeats.value > 0 ? Math.round(todayBooked.value / todaySeats.value * 100) : 0
)

function todayOp(bid)      { const op = todayOps.value[bid]; return op && !Array.isArray(op) ? op : null }
function todayOpName(bid)  { const op = todayOp(bid); return op ? getRoute(op.route)?.name || op.route || '?' : '' }
function todayOpColor(bid) { const op = todayOp(bid); return op ? getRoute(op.route)?.color || '#aaa' : '#aaa' }

function cellClass(bid, ds) {
  const dayOps = trips.value[ds] || {}
  const op = dayOps[bid]
  if (!op || Array.isArray(op)) {
    const b = boats.value.find(x => x.id === bid)
    if (!b) return 'leg-idle'
    const s = getCurStatus(b, ds)
    if (s?.s === 'maintenance' || s?.s === 'repair') return 'leg-maint'
    return 'leg-idle'
  }
  return op.type === 'charter' ? 'leg-charter' : 'leg-deployed'
}
function cellLabel(bid, ds) {
  const op = (trips.value[ds] || {})[bid]
  if (!op || Array.isArray(op)) return 'idle'
  return op.type === 'charter' ? 'charter' : `${getRoute(op.route)?.name || op.route}`
}
</script>

<style scoped>
.fld-kpi-row { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-bottom: 16px; }

.fld-layout { display: grid; grid-template-columns: 280px 1fr; gap: 14px; align-items: start; }
.fld-section-hd {
  font-size: 9px; font-weight: 700; text-transform: uppercase;
  letter-spacing: .05em; color: var(--ink-soft);
  margin-bottom: 8px;
}

.fld-boat-list { padding: 0; overflow: hidden; }
.fld-boat-row {
  display: flex; align-items: center; gap: 10px;
  padding: 9px 14px; border-bottom: 1px solid var(--border);
}
.fld-boat-row:last-child { border-bottom: none; }
.fld-boat-status-bar { width: 4px; height: 32px; border-radius: 2px; flex-shrink: 0; }
.bar-ok    { background: var(--green); }
.bar-out   { background: var(--red); }
.bar-other { background: var(--amber); }
.fld-boat-info { flex: 1; min-width: 0; }
.fld-boat-name { font-size: 12px; font-weight: 600; }
.fld-boat-meta { font-size: 10px; margin-top: 1px; }
.fld-today-route { font-weight: 600; }

.fld-heat-card { padding: 14px; overflow-x: auto; }
.fld-heat-grid { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.fld-heat-row  { display: flex; align-items: center; gap: 8px; }
.fld-heat-label { font-size: 10px; font-weight: 600; width: 80px; flex-shrink: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.fld-heat-cells { display: flex; gap: 2px; flex: 1; }
.fld-heat-cell  {
  width: 14px; height: 14px; border-radius: 2px;
  background: var(--border); flex-shrink: 0; cursor: default;
}

.leg-deployed { background: #16a34a; }
.leg-charter  { background: #d48a14; }
.leg-maint    { background: #e53e3e; }
.leg-idle     { background: var(--border); }

.fld-heat-legend {
  display: flex; gap: 14px; margin-top: 12px; flex-wrap: wrap;
  font-size: 10px; color: var(--ink-soft);
}
.fld-heat-leg-item { display: flex; align-items: center; gap: 5px; }
.fld-heat-leg-dot  { width: 10px; height: 10px; border-radius: 2px; }
</style>
