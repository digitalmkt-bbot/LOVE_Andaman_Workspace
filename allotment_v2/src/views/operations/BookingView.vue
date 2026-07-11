<template>
  <div>
    <div class="page-hd">
      <div>
        <h1>Booking</h1>
        <p>รายการ booking ทั้งหมด · ค้นหาและกรอง</p>
      </div>
    </div>

    <!-- KPI -->
    <div class="bk-kpi-row">
      <div class="kpi">
        <div class="kpi-lbl">Total Bookings</div>
        <div class="kpi-val">{{ bookings.length }}</div>
        <div class="kpi-sub">all time</div>
      </div>
      <div class="kpi k-green">
        <div class="kpi-lbl">Today</div>
        <div class="kpi-val" style="color:var(--green)">{{ todayCount }}</div>
        <div class="kpi-sub">{{ todayPax }} pax</div>
      </div>
      <div class="kpi k-ocean">
        <div class="kpi-lbl">Upcoming (7d)</div>
        <div class="kpi-val" style="color:var(--ocean-mid)">{{ upcomingCount }}</div>
        <div class="kpi-sub">bookings</div>
      </div>
      <div class="kpi">
        <div class="kpi-lbl">Total Pax (shown)</div>
        <div class="kpi-val">{{ filtered.reduce((s,b) => s + (b.pax||0), 0) }}</div>
        <div class="kpi-sub">filtered</div>
      </div>
    </div>

    <!-- Filters -->
    <div class="bk-toolbar">
      <input v-model="search" class="bk-search" placeholder="ค้นหา ref, agent, route…" type="search" />
      <select v-model="filterRoute" class="bk-select">
        <option value="">All Routes</option>
        <option v-for="r in routes" :key="r.id" :value="r.id">{{ r.name }}</option>
      </select>
      <input v-model="filterDateFrom" class="bk-date" type="date" />
      <span style="font-size:11px;color:var(--ink-soft)">→</span>
      <input v-model="filterDateTo" class="bk-date" type="date" />
      <button class="btn btn-ghost btn-sm" @click="clearFilters">Clear</button>
    </div>

    <!-- Table -->
    <div class="card" style="padding:0;overflow:hidden">
      <div class="bk-table-hd">
        <span>Ref</span>
        <span>Date</span>
        <span>Route</span>
        <span>Agent</span>
        <span>Pax</span>
        <span>Market</span>
        <span>Status</span>
        <span>Note</span>
      </div>

      <div v-if="!filtered.length" class="bk-empty">ไม่พบ booking ที่ตรงกัน</div>

      <div
        v-for="b in paginated"
        :key="b.id"
        class="bk-row"
        :class="{ 'bk-today': b.date === TODAY, 'bk-cancelled': b.status === 'cancelled' }"
      >
        <span class="bk-ref">{{ b.ref || b.id }}</span>
        <span class="bk-date-cell" :class="{ 'date-today': b.date === TODAY }">{{ fmtDate(b.date) }}</span>
        <div class="bk-route">
          <span v-if="getRoute(b.route)" class="bk-route-dot" :style="{ background: getRoute(b.route).color }"></span>
          {{ getRoute(b.route)?.name || b.route || '—' }}
        </div>
        <span class="bk-agent">{{ b.agent || '—' }}</span>
        <span class="bk-pax">{{ b.pax || '—' }}</span>
        <span>
          <span v-if="b.market" class="pill bk-mkt" :style="mktStyle(b.market)">
            {{ getMarket(b.market)?.name || b.market }}
          </span>
          <span v-else style="color:var(--ink-soft);font-size:11px">—</span>
        </span>
        <span>
          <span class="pill" :class="statusPill(b.status)">{{ b.status || 'confirmed' }}</span>
        </span>
        <span class="bk-note">{{ b.note || '' }}</span>
      </div>
    </div>

    <!-- Pagination -->
    <div v-if="totalPages > 1" class="bk-pagination">
      <button class="btn btn-ghost btn-sm" :disabled="page === 1" @click="page--">←</button>
      <span class="bk-page-info">{{ page }} / {{ totalPages }} · {{ filtered.length }} bookings</span>
      <button class="btn btn-ghost btn-sm" :disabled="page === totalPages" @click="page++">→</button>
    </div>
    <div v-else class="bk-pagination">
      <span class="bk-page-info">{{ filtered.length }} bookings</span>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useAppData } from '../../composables/useAppData'

const { bookings, routes, markets, getRoute, getMarket, fmtDate, TODAY } = useAppData()

const search        = ref('')
const filterRoute   = ref('')
const filterDateFrom = ref('')
const filterDateTo   = ref('')
const page = ref(1)
const PAGE_SIZE = 50

const weekAhead = new Date(new Date(TODAY).getTime() + 7 * 86400000).toISOString().slice(0, 10)
const todayCount    = computed(() => bookings.value.filter(b => b.date === TODAY).length)
const todayPax      = computed(() => bookings.value.filter(b => b.date === TODAY).reduce((s, b) => s + (b.pax || 0), 0))
const upcomingCount = computed(() => bookings.value.filter(b => b.date > TODAY && b.date <= weekAhead).length)

const filtered = computed(() => {
  let list = bookings.value
  if (filterRoute.value)    list = list.filter(b => b.route === filterRoute.value)
  if (filterDateFrom.value) list = list.filter(b => b.date >= filterDateFrom.value)
  if (filterDateTo.value)   list = list.filter(b => b.date <= filterDateTo.value)
  if (search.value.trim()) {
    const q = search.value.trim().toLowerCase()
    list = list.filter(b =>
      (b.ref  || '').toLowerCase().includes(q) ||
      (b.agent|| '').toLowerCase().includes(q) ||
      (getRoute(b.route)?.name || '').toLowerCase().includes(q)
    )
  }
  return [...list].sort((a, b) => (b.date || '').localeCompare(a.date || ''))
})

watch(filtered, () => { page.value = 1 })

const totalPages = computed(() => Math.max(1, Math.ceil(filtered.value.length / PAGE_SIZE)))
const paginated  = computed(() => filtered.value.slice((page.value - 1) * PAGE_SIZE, page.value * PAGE_SIZE))

function clearFilters() {
  search.value = filterRoute.value = filterDateFrom.value = filterDateTo.value = ''
}

function mktStyle(mktId) {
  const m = markets.value.find(x => x.id === mktId)
  if (!m) return {}
  return { background: m.color + '22', color: m.color, borderColor: m.color + '55' }
}
function statusPill(s) {
  if (!s || s === 'confirmed') return 'pill-green'
  if (s === 'cancelled') return 'pill-red'
  if (s === 'pending') return 'pill-amber'
  return 'pill-gray'
}
</script>

<style scoped>
.bk-kpi-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 14px; }

.bk-toolbar {
  display: flex; align-items: center; gap: 8px; margin-bottom: 12px; flex-wrap: wrap;
}
.bk-search, .bk-date {
  padding: 6px 10px; border: 1px solid var(--border); border-radius: var(--r-sm);
  font-size: 12px; outline: none; background: var(--white);
}
.bk-search { width: 200px; }
.bk-search:focus, .bk-date:focus { border-color: var(--ocean-mid); }
.bk-select {
  padding: 6px 10px; border: 1px solid var(--border); border-radius: var(--r-sm);
  font-size: 12px; background: var(--white); cursor: pointer; outline: none;
}

.bk-table-hd {
  display: grid;
  grid-template-columns: 100px 90px 1fr 120px 50px 130px 90px 1fr;
  gap: 8px; padding: 8px 14px;
  background: var(--sand); border-bottom: 1px solid var(--border);
  font-size: 9px; font-weight: 700; text-transform: uppercase;
  letter-spacing: .05em; color: var(--ink-soft);
}
.bk-row {
  display: grid;
  grid-template-columns: 100px 90px 1fr 120px 50px 130px 90px 1fr;
  gap: 8px; padding: 8px 14px; align-items: center;
  border-bottom: 1px solid var(--border); font-size: 11px;
  transition: background .1s;
}
.bk-row:last-child { border-bottom: none; }
.bk-row:hover { background: var(--sand); }
.bk-row.bk-today { background: #f0faf5; }
.bk-row.bk-cancelled { opacity: .5; }

.bk-ref  { font-family: 'DM Mono', monospace; font-size: 10px; font-weight: 600; }
.bk-date-cell { font-size: 11px; }
.date-today  { color: var(--green); font-weight: 700; }
.bk-route { display: flex; align-items: center; gap: 6px; font-weight: 500; }
.bk-route-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
.bk-agent { color: var(--ink-mid); }
.bk-pax   { font-weight: 600; text-align: right; }
.bk-mkt   { font-size: 9px; font-weight: 600; border: 1px solid transparent; }
.bk-note  { color: var(--ink-soft); font-size: 10px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.bk-pagination {
  display: flex; align-items: center; gap: 10px; justify-content: center;
  margin-top: 12px;
}
.bk-page-info { font-size: 11px; color: var(--ink-soft); }

.bk-empty { padding: 32px; text-align: center; color: var(--ink-soft); font-size: 12px; }
</style>
