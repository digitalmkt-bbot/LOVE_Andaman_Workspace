<template>
  <div>
    <div class="page-hd">
      <div>
        <h1>Accounting</h1>
        <p>รายรับ-รายจ่าย และสรุปการเงิน</p>
      </div>
      <div class="page-actions">
        <select v-model="filterMonth" class="ac-select">
          <option v-for="m in availableMonths" :key="m.value" :value="m.value">{{ m.label }}</option>
        </select>
      </div>
    </div>

    <!-- KPI -->
    <div class="ac-kpi-row">
      <div class="kpi k-green">
        <div class="kpi-lbl">Revenue</div>
        <div class="kpi-val" style="color:var(--green);font-size:20px">฿{{ fmtTHB(monthRevenue) }}</div>
        <div class="kpi-sub">{{ monthBookings }} bookings</div>
      </div>
      <div class="kpi k-coral">
        <div class="kpi-lbl">Cost</div>
        <div class="kpi-val" style="color:var(--red);font-size:20px">฿{{ fmtTHB(monthCost) }}</div>
        <div class="kpi-sub">total expense</div>
      </div>
      <div class="kpi">
        <div class="kpi-lbl">Gross Profit</div>
        <div class="kpi-val" :style="{ color: monthProfit >= 0 ? 'var(--green)' : 'var(--red)', fontSize: '20px' }">
          ฿{{ fmtTHB(monthProfit) }}
        </div>
        <div class="kpi-sub">{{ monthMargin }}% margin</div>
      </div>
      <div class="kpi k-ocean">
        <div class="kpi-lbl">Avg / Pax</div>
        <div class="kpi-val" style="color:var(--ocean-mid);font-size:20px">฿{{ fmtTHB(avgPerPax) }}</div>
        <div class="kpi-sub">{{ monthPax }} pax</div>
      </div>
    </div>

    <div class="ac-layout">
      <!-- Revenue by route -->
      <div class="card ac-card">
        <div class="card-title">Revenue by Route</div>
        <div v-if="!routeRevRows.length" class="ac-empty">ไม่มีข้อมูล</div>
        <div v-for="row in routeRevRows" :key="row.id" class="ac-bar-row">
          <div class="ac-bar-lbl">
            <span class="ac-dot" :style="{ background: row.color }"></span>
            {{ row.name }}
          </div>
          <div class="ac-bar-track">
            <div class="ac-bar-fill" :style="{ width: row.pct + '%', background: row.color + 'cc' }"></div>
          </div>
          <div class="ac-bar-val">฿{{ fmtTHB(row.rev) }}</div>
        </div>
      </div>

      <!-- Revenue by market -->
      <div class="card ac-card">
        <div class="card-title">Revenue by Market</div>
        <div v-if="!mktRevRows.length" class="ac-empty">ไม่มีข้อมูล</div>
        <div v-for="row in mktRevRows" :key="row.id" class="ac-bar-row">
          <div class="ac-bar-lbl">
            <span class="ac-dot" :style="{ background: row.color }"></span>
            {{ row.name }}
          </div>
          <div class="ac-bar-track">
            <div class="ac-bar-fill" :style="{ width: row.pct + '%', background: row.color }"></div>
          </div>
          <div class="ac-bar-val">฿{{ fmtTHB(row.rev) }}</div>
        </div>
      </div>
    </div>

    <!-- Sales table -->
    <div class="card ac-sales-card">
      <div class="card-title">Bookings — {{ filterMonthLabel }}</div>
      <div class="ac-table-wrap">
        <div class="ac-table-hd">
          <span>Date</span>
          <span>Ref</span>
          <span>Route</span>
          <span>Agent</span>
          <span>Pax</span>
          <span>Market</span>
          <span>Revenue</span>
          <span>Cost</span>
          <span>Profit</span>
        </div>
        <div v-if="!monthBk.length" class="ac-empty" style="padding:24px">ไม่มีข้อมูล</div>
        <div v-for="b in monthBk" :key="b.id" class="ac-table-row">
          <span class="ac-date">{{ b.date }}</span>
          <span class="ac-ref">{{ b.ref || b.id }}</span>
          <div class="ac-route">
            <span v-if="getRoute(b.route)" class="ac-dot" :style="{ background: getRoute(b.route).color }"></span>
            {{ getRoute(b.route)?.name || b.route || '—' }}
          </div>
          <span>{{ b.agent || '—' }}</span>
          <span class="ac-num">{{ b.pax || '—' }}</span>
          <span>
            <span v-if="b.market" class="pill ac-mkt" :style="mktStyle(b.market)">{{ getMarket(b.market)?.name || b.market }}</span>
          </span>
          <span class="ac-num green">฿{{ fmtTHB(b.revenue || 0) }}</span>
          <span class="ac-num red">฿{{ fmtTHB(b.cost || 0) }}</span>
          <span class="ac-num" :class="(b.revenue||0)-(b.cost||0) >= 0 ? 'green' : 'red'">
            ฿{{ fmtTHB((b.revenue||0)-(b.cost||0)) }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useAppData } from '../../composables/useAppData'

const { bookings, routes, markets, getRoute, getMarket, fmtTHB, TODAY } = useAppData()

const currentMonth = TODAY.slice(0, 7)

const availableMonths = computed(() => {
  const set = new Set(bookings.value.map(b => b.date?.slice(0, 7)).filter(Boolean))
  set.add(currentMonth)
  return [...set].sort((a, b) => b.localeCompare(a)).slice(0, 18).map(v => ({
    value: v,
    label: new Date(v + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
  }))
})

const filterMonth = ref(currentMonth)
const filterMonthLabel = computed(() =>
  availableMonths.value.find(m => m.value === filterMonth.value)?.label || filterMonth.value
)

const monthBk = computed(() =>
  bookings.value.filter(b => b.date?.startsWith(filterMonth.value))
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
)

const monthBookings = computed(() => monthBk.value.length)
const monthPax      = computed(() => monthBk.value.reduce((s, b) => s + (b.pax || 0), 0))
const monthRevenue  = computed(() => monthBk.value.reduce((s, b) => s + (b.revenue || 0), 0))
const monthCost     = computed(() => monthBk.value.reduce((s, b) => s + (b.cost || 0), 0))
const monthProfit   = computed(() => monthRevenue.value - monthCost.value)
const monthMargin   = computed(() => monthRevenue.value > 0 ? Math.round(monthProfit.value / monthRevenue.value * 100) : 0)
const avgPerPax     = computed(() => monthPax.value > 0 ? Math.round(monthRevenue.value / monthPax.value) : 0)

function buildBarRows(keyFn, nameFn, colorFn) {
  const map = {}
  for (const b of monthBk.value) {
    const k = keyFn(b) || '__none__'
    if (!map[k]) map[k] = { id: k, name: nameFn(k), color: colorFn(k), rev: 0 }
    map[k].rev += b.revenue || 0
  }
  const rows = Object.values(map).sort((a, b) => b.rev - a.rev)
  const maxRev = rows[0]?.rev || 1
  return rows.map(r => ({ ...r, pct: Math.round(r.rev / maxRev * 100) }))
}

const routeRevRows = computed(() => buildBarRows(
  b => b.route,
  id => getRoute(id)?.name || id,
  id => getRoute(id)?.color || '#aaa'
))
const mktRevRows = computed(() => buildBarRows(
  b => b.market,
  id => getMarket(id)?.name || id,
  id => getMarket(id)?.color || '#aaa'
))

function mktStyle(mid) {
  const m = getMarket(mid)
  if (!m) return {}
  return { background: m.color + '22', color: m.color, borderColor: m.color + '55' }
}
</script>

<style scoped>
.ac-select {
  padding: 6px 10px; border: 1px solid var(--border); border-radius: var(--r-sm);
  font-size: 12px; background: var(--white); outline: none;
}
.ac-kpi-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 16px; }
.ac-layout  { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 14px; }
.ac-card { padding: 14px; }
.ac-sales-card { padding: 0; overflow: hidden; }

.ac-bar-row { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
.ac-bar-lbl { display: flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 500; width: 140px; flex-shrink: 0; }
.ac-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.ac-bar-track { flex: 1; height: 8px; background: var(--border); border-radius: 4px; overflow: hidden; }
.ac-bar-fill  { height: 100%; border-radius: 4px; }
.ac-bar-val { font-size: 11px; font-weight: 700; min-width: 80px; text-align: right; }

.ac-table-hd {
  display: grid;
  grid-template-columns: 85px 90px 1fr 110px 44px 110px 90px 90px 90px;
  gap: 8px; padding: 8px 14px;
  background: var(--sand); border-bottom: 1px solid var(--border);
  font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: var(--ink-soft);
}
.ac-table-row {
  display: grid;
  grid-template-columns: 85px 90px 1fr 110px 44px 110px 90px 90px 90px;
  gap: 8px; padding: 8px 14px; align-items: center; font-size: 11px;
  border-bottom: 1px solid var(--border);
}
.ac-table-row:last-child { border-bottom: none; }
.ac-table-row:hover { background: var(--sand); }

.ac-date { font-size: 10px; color: var(--ink-soft); }
.ac-ref  { font-family: 'DM Mono', monospace; font-size: 10px; font-weight: 600; }
.ac-route { display: flex; align-items: center; gap: 5px; font-weight: 500; }
.ac-num  { text-align: right; font-weight: 600; }
.ac-mkt  { font-size: 9px; font-weight: 600; border: 1px solid transparent; }
.green   { color: var(--green); }
.red     { color: var(--red); }
.ac-empty { font-size: 12px; color: var(--ink-soft); }
</style>
