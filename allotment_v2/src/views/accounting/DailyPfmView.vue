<template>
  <div>
    <div class="page-hd">
      <div>
        <h1>Daily PFM</h1>
        <p>สรุปผลการดำเนินงานรายวัน (Performance)</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-ghost btn-sm" @click="prevDay">← ก่อนหน้า</button>
        <button class="btn btn-ghost btn-sm" @click="goToday">วันนี้</button>
        <button class="btn btn-ghost btn-sm" @click="nextDay">ถัดไป →</button>
      </div>
    </div>

    <div class="pfm-date-bar">
      <span class="pfm-date-lbl">{{ dateLabelFull }}</span>
      <span v-if="dateStr === TODAY" class="pill pill-green">Today</span>
    </div>

    <!-- KPI row -->
    <div class="pfm-kpi-row">
      <div class="kpi k-green">
        <div class="kpi-lbl">Revenue</div>
        <div class="kpi-val" style="color:var(--green);font-size:20px">฿{{ fmtTHB(dayRevenue) }}</div>
        <div class="kpi-sub">{{ dayBk.length }} bookings</div>
      </div>
      <div class="kpi k-coral">
        <div class="kpi-lbl">Cost</div>
        <div class="kpi-val" style="color:var(--red);font-size:20px">฿{{ fmtTHB(dayCost) }}</div>
        <div class="kpi-sub">total expense</div>
      </div>
      <div class="kpi">
        <div class="kpi-lbl">Profit</div>
        <div class="kpi-val" :style="{ color: dayProfit >= 0 ? 'var(--green)' : 'var(--red)', fontSize: '20px' }">
          ฿{{ fmtTHB(dayProfit) }}
        </div>
        <div class="kpi-sub">{{ dayMargin }}% margin</div>
      </div>
      <div class="kpi k-ocean">
        <div class="kpi-lbl">Total Pax</div>
        <div class="kpi-val" style="color:var(--ocean-mid)">{{ dayPax }}</div>
        <div class="kpi-sub">฿{{ fmtTHB(avgPerPax) }} avg/pax</div>
      </div>
      <div class="kpi">
        <div class="kpi-lbl">Trips</div>
        <div class="kpi-val">{{ tripsToday }}</div>
        <div class="kpi-sub">{{ fillPct }}% fill rate</div>
      </div>
    </div>

    <!-- Route breakdown -->
    <div class="pfm-layout">
      <div class="card pfm-routes">
        <div class="card-title">Performance by Route</div>
        <div v-if="!routeRows.length" class="pfm-empty">ไม่มีข้อมูลวันนี้</div>
        <table v-else class="pfm-table">
          <thead>
            <tr>
              <th>Route</th>
              <th>Trips</th>
              <th>Pax</th>
              <th>Seats</th>
              <th>Fill%</th>
              <th>Revenue</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in routeRows" :key="row.id">
              <td>
                <div class="pfm-route-cell">
                  <span class="pfm-dot" :style="{ background: row.color }"></span>
                  {{ row.name }}
                </div>
              </td>
              <td class="num">{{ row.trips }}</td>
              <td class="num">{{ row.pax }}</td>
              <td class="num">{{ row.seats }}</td>
              <td class="num" :style="{ color: fillColor(row.fillPct) }">{{ row.fillPct }}%</td>
              <td class="num green">฿{{ fmtTHB(row.rev) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Market pax split -->
      <div class="card pfm-mkt">
        <div class="card-title">Pax by Market</div>
        <div v-if="!mktRows.length" class="pfm-empty">ไม่มีข้อมูล</div>
        <div v-for="row in mktRows" :key="row.id" class="pfm-mkt-row">
          <div class="pfm-mkt-lbl">
            <span class="pfm-dot" :style="{ background: row.color }"></span>
            {{ row.name }}
          </div>
          <div class="pfm-mkt-bar-wrap">
            <div class="pfm-mkt-bar" :style="{ width: row.pct + '%', background: row.color }"></div>
          </div>
          <span class="pfm-mkt-val">{{ row.pax }}</span>
        </div>
      </div>
    </div>

    <!-- All bookings today -->
    <div class="card pfm-bk-list">
      <div class="card-title">All Bookings ({{ dayBk.length }})</div>
      <div v-if="!dayBk.length" class="pfm-empty" style="padding:16px">ไม่มี booking วันนี้</div>
      <table v-else class="pfm-table pfm-bk-table">
        <thead>
          <tr><th>Ref</th><th>Route</th><th>Agent</th><th>Pax</th><th>Market</th><th>Revenue</th><th>Cost</th><th>Profit</th></tr>
        </thead>
        <tbody>
          <tr v-for="b in dayBk" :key="b.id">
            <td class="mono">{{ b.ref || b.id }}</td>
            <td>
              <div class="pfm-route-cell">
                <span v-if="getRoute(b.route)" class="pfm-dot" :style="{ background: getRoute(b.route).color }"></span>
                {{ getRoute(b.route)?.name || b.route || '—' }}
              </div>
            </td>
            <td>{{ b.agent || '—' }}</td>
            <td class="num">{{ b.pax || '—' }}</td>
            <td>
              <span v-if="b.market" class="pill pfm-mkt-pill" :style="mktStyle(b.market)">
                {{ getMarket(b.market)?.name || b.market }}
              </span>
            </td>
            <td class="num green">฿{{ fmtTHB(b.revenue||0) }}</td>
            <td class="num red">฿{{ fmtTHB(b.cost||0) }}</td>
            <td class="num" :class="(b.revenue||0)-(b.cost||0) >= 0 ? 'green' : 'red'">฿{{ fmtTHB((b.revenue||0)-(b.cost||0)) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useAppData } from '../../composables/useAppData'

const { bookings, trips, routes, markets, boats, getRoute, getMarket, getBoat, fmtTHB, buildDAGroups, TODAY } = useAppData()

const dateObj = ref(new Date())
const dateStr = computed(() => dateObj.value.toISOString().slice(0, 10))
const dateLabelFull = computed(() =>
  dateObj.value.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
)
function prevDay() { dateObj.value = new Date(dateObj.value.getTime() - 86400000) }
function nextDay() { dateObj.value = new Date(dateObj.value.getTime() + 86400000) }
function goToday()  { dateObj.value = new Date() }

const dayBk = computed(() =>
  bookings.value.filter(b => b.date === dateStr.value && b.status !== 'cancelled')
)

const dayRevenue = computed(() => dayBk.value.reduce((s, b) => s + (b.revenue || 0), 0))
const dayCost    = computed(() => dayBk.value.reduce((s, b) => s + (b.cost || 0), 0))
const dayProfit  = computed(() => dayRevenue.value - dayCost.value)
const dayMargin  = computed(() => dayRevenue.value > 0 ? Math.round(dayProfit.value / dayRevenue.value * 100) : 0)
const dayPax     = computed(() => dayBk.value.reduce((s, b) => s + (b.pax || 0), 0))
const avgPerPax  = computed(() => dayPax.value > 0 ? Math.round(dayRevenue.value / dayPax.value) : 0)

const groups     = computed(() => buildDAGroups(dateStr.value))
const allRows    = computed(() => [
  ...Object.values(groups.value.tublamu || {}),
  ...Object.values(groups.value.panwa   || {}),
])
const tripsToday = computed(() => allRows.value.length)
const totalSeats = computed(() => allRows.value.reduce((s, r) => s + r.allot, 0))
const totalBk    = computed(() => allRows.value.reduce((s, r) => s + r.booked, 0))
const fillPct    = computed(() => totalSeats.value > 0 ? Math.round(totalBk.value / totalSeats.value * 100) : 0)

const routeRows = computed(() => {
  const map = {}
  for (const b of dayBk.value) {
    const rid = b.route || '__none__'
    if (!map[rid]) map[rid] = { id: rid, name: getRoute(rid)?.name || rid, color: getRoute(rid)?.color || '#aaa', trips: 0, pax: 0, seats: 0, rev: 0 }
    map[rid].pax += b.pax || 0
    map[rid].rev += b.revenue || 0
  }
  for (const row of allRows.value) {
    const rid = row.r.id
    if (!map[rid]) map[rid] = { id: rid, name: row.r.name, color: row.r.color, trips: 0, pax: 0, seats: 0, rev: 0 }
    map[rid].trips++
    map[rid].seats += row.allot
  }
  return Object.values(map).sort((a, b) => b.rev - a.rev).map(r => ({
    ...r, fillPct: r.seats > 0 ? Math.round(r.pax / r.seats * 100) : 0
  }))
})

const mktRows = computed(() => {
  const map = {}
  for (const b of dayBk.value) {
    const mid = b.market || '__none__'
    if (!map[mid]) map[mid] = { id: mid, name: getMarket(mid)?.name || mid, color: getMarket(mid)?.color || '#aaa', pax: 0 }
    map[mid].pax += b.pax || 0
  }
  const rows = Object.values(map).sort((a, b) => b.pax - a.pax)
  const max = rows[0]?.pax || 1
  return rows.map(r => ({ ...r, pct: Math.round(r.pax / max * 100) }))
})

function fillColor(p) { return p >= 85 ? 'var(--red)' : p >= 65 ? 'var(--amber)' : 'var(--green)' }
function mktStyle(mid) {
  const m = getMarket(mid)
  return m ? { background: m.color + '22', color: m.color, borderColor: m.color + '55' } : {}
}
</script>

<style scoped>
.pfm-date-bar { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; }
.pfm-date-lbl { font-size: 15px; font-weight: 600; }
.pfm-kpi-row { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-bottom: 16px; }
.pfm-layout  { display: grid; grid-template-columns: 1fr 300px; gap: 14px; margin-bottom: 14px; }

.pfm-routes { padding: 14px; }
.pfm-mkt    { padding: 14px; }
.pfm-bk-list { padding: 14px; overflow-x: auto; }

.pfm-route-cell { display: flex; align-items: center; gap: 6px; }
.pfm-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }

.pfm-mkt-row { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.pfm-mkt-lbl { display: flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 500; width: 130px; flex-shrink: 0; }
.pfm-mkt-bar-wrap { flex: 1; height: 8px; background: var(--border); border-radius: 4px; overflow: hidden; }
.pfm-mkt-bar { height: 100%; border-radius: 4px; }
.pfm-mkt-val { font-size: 11px; font-weight: 700; min-width: 24px; text-align: right; }
.pfm-mkt-pill { font-size: 9px; font-weight: 600; border: 1px solid transparent; }

.pfm-table { font-size: 11px; width: 100%; }
.pfm-table th { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: var(--ink-soft); padding: 4px 8px 8px; text-align: left; }
.pfm-table td { padding: 7px 8px; border-top: 1px solid var(--border); }
.pfm-table tr:hover td { background: var(--sand); }
.pfm-bk-table { min-width: 700px; }
.num   { text-align: right; font-weight: 600; }
.green { color: var(--green); }
.red   { color: var(--red); }
.mono  { font-family: 'DM Mono', monospace; font-size: 10px; }
.pfm-empty { font-size: 12px; color: var(--ink-soft); }
</style>
