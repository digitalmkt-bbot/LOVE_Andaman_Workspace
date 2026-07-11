<template>
  <div>
    <div class="page-hd">
      <div>
        <h1>Demand</h1>
        <p>ยอดขายและ demand แยกตาม market segment</p>
      </div>
      <div class="page-actions">
        <select v-model="filterRoute" class="md-select">
          <option value="">All Routes</option>
          <option v-for="r in routes" :key="r.id" :value="r.id">{{ r.name }}</option>
        </select>
      </div>
    </div>

    <!-- KPI row -->
    <div class="md-kpi-row">
      <div class="kpi">
        <div class="kpi-lbl">Total Bookings</div>
        <div class="kpi-val">{{ filteredBk.length }}</div>
        <div class="kpi-sub">all markets</div>
      </div>
      <div class="kpi k-green">
        <div class="kpi-lbl">Total Pax</div>
        <div class="kpi-val" style="color:var(--green)">{{ totalPax }}</div>
        <div class="kpi-sub">passengers</div>
      </div>
      <div class="kpi k-ocean">
        <div class="kpi-lbl">Active Markets</div>
        <div class="kpi-val" style="color:var(--ocean-mid)">{{ activeMarkets }}</div>
        <div class="kpi-sub">with bookings</div>
      </div>
      <div class="kpi">
        <div class="kpi-lbl">Top Market</div>
        <div class="kpi-val" style="font-size:14px">{{ topMarket }}</div>
        <div class="kpi-sub">by pax</div>
      </div>
    </div>

    <div class="md-layout">
      <!-- Market breakdown bars -->
      <div class="card md-breakdown">
        <div class="card-title">By Market Segment</div>
        <div v-if="!mktRows.length" class="md-empty">ไม่มีข้อมูล booking</div>
        <div v-for="row in mktRows" :key="row.id" class="md-mkt-row">
          <div class="md-mkt-top">
            <div class="md-mkt-name">
              <span class="md-mkt-dot" :style="{ background: row.color }"></span>
              {{ row.name }}
            </div>
            <div class="md-mkt-nums">
              <span class="md-mkt-pax">{{ row.pax }} pax</span>
              <span class="md-mkt-bk">{{ row.bk }} bk</span>
              <span class="md-mkt-pct" :style="{ color: row.color }">{{ row.pct }}%</span>
            </div>
          </div>
          <div class="md-bar-track">
            <div class="md-bar-fill" :style="{ width: row.pct + '%', background: row.color }"></div>
          </div>
        </div>
      </div>

      <!-- Route breakdown table -->
      <div class="card md-route-table">
        <div class="card-title">By Route</div>
        <div v-if="!routeRows.length" class="md-empty">ไม่มีข้อมูล</div>
        <table v-else class="md-table">
          <thead>
            <tr>
              <th>Route</th>
              <th>Bookings</th>
              <th>Pax</th>
              <th>Share</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in routeRows" :key="row.id">
              <td>
                <div class="md-route-cell">
                  <span class="md-mkt-dot" :style="{ background: row.color }"></span>
                  {{ row.name }}
                </div>
              </td>
              <td class="num">{{ row.bk }}</td>
              <td class="num">{{ row.pax }}</td>
              <td>
                <div class="md-bar-track" style="width:80px;display:inline-block">
                  <div class="md-bar-fill" :style="{ width: row.pct + '%', background: row.color }"></div>
                </div>
                <span style="font-size:10px;color:var(--ink-soft);margin-left:6px">{{ row.pct }}%</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Monthly trend table -->
    <div class="card md-trend" style="margin-top:14px">
      <div class="card-title">Monthly Trend</div>
      <div v-if="!monthRows.length" class="md-empty">ไม่มีข้อมูล</div>
      <table v-else class="md-table">
        <thead>
          <tr>
            <th>Month</th>
            <th>Bookings</th>
            <th>Pax</th>
            <th v-for="m in topMarkets" :key="m.id" :style="{ color: m.color }">{{ m.name }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in monthRows" :key="row.month">
            <td style="font-weight:600">{{ row.label }}</td>
            <td class="num">{{ row.bk }}</td>
            <td class="num">{{ row.pax }}</td>
            <td v-for="m in topMarkets" :key="m.id" class="num">{{ row.byMkt[m.id] || 0 }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useAppData } from '../../composables/useAppData'

const { bookings, routes, markets, getRoute, getMarket } = useAppData()

const filterRoute = ref('')

const filteredBk = computed(() => {
  if (!filterRoute.value) return bookings.value
  return bookings.value.filter(b => b.route === filterRoute.value)
})

const totalPax = computed(() => filteredBk.value.reduce((s, b) => s + (b.pax || 0), 0))

const mktRows = computed(() => {
  const map = {}
  for (const b of filteredBk.value) {
    const mid = b.market || '__none__'
    if (!map[mid]) map[mid] = { bk: 0, pax: 0 }
    map[mid].bk++
    map[mid].pax += b.pax || 0
  }
  const rows = Object.entries(map).map(([id, v]) => {
    const m = getMarket(id)
    return { id, name: m?.name || id, color: m?.color || '#aaa', ...v, pct: 0 }
  }).sort((a, b) => b.pax - a.pax)
  const maxPax = rows[0]?.pax || 1
  return rows.map(r => ({ ...r, pct: Math.round(r.pax / totalPax.value * 100) }))
})

const activeMarkets = computed(() => mktRows.value.filter(r => r.bk > 0).length)
const topMarket     = computed(() => mktRows.value[0]?.name || '—')
const topMarkets    = computed(() => mktRows.value.slice(0, 4))

const routeRows = computed(() => {
  const map = {}
  for (const b of filteredBk.value) {
    const rid = b.route || '__none__'
    if (!map[rid]) map[rid] = { bk: 0, pax: 0 }
    map[rid].bk++
    map[rid].pax += b.pax || 0
  }
  const rows = Object.entries(map).map(([id, v]) => {
    const r = getRoute(id)
    return { id, name: r?.name || id, color: r?.color || '#aaa', ...v, pct: 0 }
  }).sort((a, b) => b.pax - a.pax)
  return rows.map(r => ({ ...r, pct: Math.round(r.pax / (totalPax.value || 1) * 100) }))
})

const monthRows = computed(() => {
  const map = {}
  for (const b of filteredBk.value) {
    if (!b.date) continue
    const mo = b.date.slice(0, 7)
    if (!map[mo]) map[mo] = { bk: 0, pax: 0, byMkt: {} }
    map[mo].bk++
    map[mo].pax += b.pax || 0
    const mid = b.market || '__none__'
    map[mo].byMkt[mid] = (map[mo].byMkt[mid] || 0) + (b.pax || 0)
  }
  return Object.entries(map)
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, 12)
    .map(([month, v]) => ({
      month,
      label: new Date(month + '-01').toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      ...v,
    }))
})
</script>

<style scoped>
.md-select {
  padding: 6px 10px; border: 1px solid var(--border); border-radius: var(--r-sm);
  font-size: 12px; background: var(--white); outline: none;
}
.md-kpi-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 16px; }
.md-layout  { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }

.md-breakdown { padding: 14px; }
.md-route-table { padding: 14px; }
.md-trend { padding: 14px; }

.md-mkt-row { margin-bottom: 12px; }
.md-mkt-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; }
.md-mkt-name { display: flex; align-items: center; gap: 7px; font-size: 12px; font-weight: 600; }
.md-mkt-dot  { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.md-mkt-nums { display: flex; gap: 10px; font-size: 11px; align-items: center; }
.md-mkt-pax  { color: var(--ink-mid); font-weight: 600; }
.md-mkt-bk   { color: var(--ink-soft); }
.md-mkt-pct  { font-weight: 700; min-width: 32px; text-align: right; }
.md-bar-track { height: 6px; background: var(--border); border-radius: 3px; overflow: hidden; }
.md-bar-fill  { height: 100%; border-radius: 3px; transition: width .3s; }

.md-route-cell { display: flex; align-items: center; gap: 6px; }
.md-table { font-size: 12px; width: 100%; }
.md-table th { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: var(--ink-soft); padding: 4px 8px 8px; text-align: left; }
.md-table td { padding: 6px 8px; border-top: 1px solid var(--border); }
.md-table .num { text-align: right; font-weight: 600; }
.md-empty { font-size: 12px; color: var(--ink-soft); padding: 16px 0; }
</style>
