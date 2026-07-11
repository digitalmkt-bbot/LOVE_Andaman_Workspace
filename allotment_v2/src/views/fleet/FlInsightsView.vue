<template>
  <div>
    <div class="page-hd">
      <div>
        <h1>Fleet Insights</h1>
        <p>วิเคราะห์ประสิทธิภาพกองเรือ — utilization, cost per trip</p>
      </div>
    </div>

    <div class="fi-kpi-row">
      <div class="kpi k-green">
        <div class="kpi-lbl">Avg Utilization</div>
        <div class="kpi-val" style="color:var(--green)">{{ avgUtil }}%</div>
        <div class="kpi-sub">last 30 days</div>
      </div>
      <div class="kpi k-ocean">
        <div class="kpi-lbl">Avg Fill Rate</div>
        <div class="kpi-val" style="color:var(--ocean-mid)">{{ avgFill }}%</div>
        <div class="kpi-sub">last 30 days</div>
      </div>
      <div class="kpi">
        <div class="kpi-lbl">Total Trips (30d)</div>
        <div class="kpi-val">{{ totalTrips30 }}</div>
        <div class="kpi-sub">departures</div>
      </div>
      <div class="kpi">
        <div class="kpi-lbl">Total Pax (30d)</div>
        <div class="kpi-val">{{ totalPax30 }}</div>
        <div class="kpi-sub">passengers</div>
      </div>
    </div>

    <!-- Per-boat utilization -->
    <div class="card fi-boat-util">
      <div class="card-title">Boat Utilization — last 30 days</div>
      <div v-for="b in boatStats" :key="b.id" class="fi-boat-row">
        <div class="fi-boat-name">{{ b.name }}</div>
        <div class="fi-util-bar-wrap">
          <div class="fi-util-bar" :style="{ width: b.util + '%', background: utilColor(b.util) }"></div>
        </div>
        <span class="fi-util-pct" :style="{ color: utilColor(b.util) }">{{ b.util }}%</span>
        <span class="fi-boat-trips">{{ b.trips }} trips</span>
        <span class="fi-boat-pax">{{ b.pax }} pax</span>
        <span class="fi-boat-fill" :style="{ color: utilColor(b.fill) }">{{ b.fill }}% fill</span>
      </div>
    </div>

    <!-- Monthly summary table -->
    <div class="card fi-monthly" style="margin-top:14px">
      <div class="card-title">Monthly Summary</div>
      <table class="fi-table">
        <thead><tr><th>Month</th><th>Trips</th><th>Pax</th><th>Seats</th><th>Fill%</th><th>Boats Used</th></tr></thead>
        <tbody>
          <tr v-for="row in monthlySummary" :key="row.month">
            <td style="font-weight:600">{{ row.label }}</td>
            <td class="num">{{ row.trips }}</td>
            <td class="num">{{ row.pax }}</td>
            <td class="num">{{ row.seats }}</td>
            <td class="num" :style="{ color: utilColor(row.fill) }">{{ row.fill }}%</td>
            <td class="num">{{ row.boats }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useAppData } from '../../composables/useAppData'

const { boats, trips, getBoat, TODAY } = useAppData()

const last30 = computed(() => {
  const days = []
  for (let i = 29; i >= 0; i--) {
    const d = new Date(new Date(TODAY).getTime() - i * 86400000)
    days.push(d.toISOString().slice(0, 10))
  }
  return days
})

const boatStats = computed(() => {
  return boats.value.map(b => {
    let tripCount = 0, totalBooked = 0, totalCap = 0
    for (const ds of last30.value) {
      const op = (trips.value[ds] || {})[b.id]
      if (op && !Array.isArray(op)) {
        tripCount++
        totalBooked += op.booked || 0
        totalCap    += b.cap || 0
      }
    }
    return {
      id:    b.id,
      name:  b.name,
      trips: tripCount,
      pax:   totalBooked,
      util:  Math.round(tripCount / 30 * 100),
      fill:  totalCap > 0 ? Math.round(totalBooked / totalCap * 100) : 0,
    }
  }).sort((a, b) => b.util - a.util)
})

const avgUtil  = computed(() => boatStats.value.length ? Math.round(boatStats.value.reduce((s, b) => s + b.util, 0) / boatStats.value.length) : 0)
const avgFill  = computed(() => boatStats.value.length ? Math.round(boatStats.value.reduce((s, b) => s + b.fill, 0) / boatStats.value.length) : 0)
const totalTrips30 = computed(() => boatStats.value.reduce((s, b) => s + b.trips, 0))
const totalPax30   = computed(() => boatStats.value.reduce((s, b) => s + b.pax, 0))

const monthlySummary = computed(() => {
  const map = {}
  for (const [ds, ops] of Object.entries(trips.value)) {
    const mo = ds.slice(0, 7)
    if (!map[mo]) map[mo] = { month: mo, trips: 0, pax: 0, seats: 0, boats: new Set() }
    for (const [bid, op] of Object.entries(ops)) {
      if (Array.isArray(op)) continue
      const b = getBoat(bid)
      map[mo].trips++
      map[mo].pax   += op.booked || 0
      map[mo].seats += b?.cap   || 0
      map[mo].boats.add(bid)
    }
  }
  return Object.values(map)
    .sort((a, b) => b.month.localeCompare(a.month))
    .slice(0, 12)
    .map(r => ({
      ...r,
      boats: r.boats.size,
      fill:  r.seats > 0 ? Math.round(r.pax / r.seats * 100) : 0,
      label: new Date(r.month + '-01').toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
    }))
})

function utilColor(p) { return p >= 70 ? 'var(--green)' : p >= 40 ? 'var(--amber)' : 'var(--red)' }
</script>

<style scoped>
.fi-kpi-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 16px; }
.fi-boat-util { padding: 14px; }
.fi-boat-row { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
.fi-boat-name { font-size: 11px; font-weight: 600; width: 110px; flex-shrink: 0; }
.fi-util-bar-wrap { flex: 1; height: 8px; background: var(--border); border-radius: 4px; overflow: hidden; }
.fi-util-bar { height: 100%; border-radius: 4px; }
.fi-util-pct  { font-size: 11px; font-weight: 700; min-width: 36px; }
.fi-boat-trips { font-size: 10px; color: var(--ink-soft); min-width: 50px; }
.fi-boat-pax   { font-size: 10px; color: var(--ink-soft); min-width: 50px; }
.fi-boat-fill  { font-size: 10px; font-weight: 600; min-width: 60px; }
.fi-monthly { padding: 14px; }
.fi-table { font-size: 12px; width: 100%; }
.fi-table th { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: var(--ink-soft); padding: 4px 8px 8px; }
.fi-table td { padding: 7px 8px; border-top: 1px solid var(--border); }
.num { text-align: right; font-weight: 600; }
</style>
