<template>
  <div>
    <div class="page-hd">
      <div>
        <h1>Fleet Cost</h1>
        <p>ค่าใช้จ่ายกองเรือ — เชื้อเพลิง, ซ่อมบำรุง, ลูกเรือ</p>
      </div>
      <div class="page-actions">
        <select v-model="filterMonth" class="fc-select">
          <option v-for="m in months" :key="m.value" :value="m.value">{{ m.label }}</option>
        </select>
      </div>
    </div>

    <div class="fc-kpi-row">
      <div class="kpi k-coral">
        <div class="kpi-lbl">Total Cost</div>
        <div class="kpi-val" style="color:var(--red);font-size:20px">฿{{ fmtTHB(totalCost) }}</div>
        <div class="kpi-sub">{{ filterMonthLabel }}</div>
      </div>
      <div class="kpi">
        <div class="kpi-lbl">Fuel</div>
        <div class="kpi-val" style="font-size:18px">฿{{ fmtTHB(byCat('fuel')) }}</div>
        <div class="kpi-sub">{{ pct('fuel') }}%</div>
      </div>
      <div class="kpi">
        <div class="kpi-lbl">Maintenance</div>
        <div class="kpi-val" style="font-size:18px">฿{{ fmtTHB(byCat('maintenance')) }}</div>
        <div class="kpi-sub">{{ pct('maintenance') }}%</div>
      </div>
      <div class="kpi">
        <div class="kpi-lbl">Crew</div>
        <div class="kpi-val" style="font-size:18px">฿{{ fmtTHB(byCat('crew')) }}</div>
        <div class="kpi-sub">{{ pct('crew') }}%</div>
      </div>
    </div>

    <!-- Category breakdown bars -->
    <div class="card fc-breakdown">
      <div class="card-title">Cost Breakdown by Category</div>
      <div v-for="cat in catRows" :key="cat.name" class="fc-bar-row">
        <div class="fc-bar-lbl">{{ cat.name }}</div>
        <div class="fc-bar-track">
          <div class="fc-bar-fill" :style="{ width: cat.pct + '%', background: cat.color }"></div>
        </div>
        <div class="fc-bar-val">฿{{ fmtTHB(cat.cost) }} <span class="fc-bar-pct">{{ cat.pct }}%</span></div>
      </div>
    </div>

    <!-- Records table -->
    <div class="card" style="padding:0;overflow:hidden;margin-top:14px">
      <div class="fc-table-hd">
        <span>Date</span><span>Boat</span><span>Category</span><span>Description</span><span>Amount</span><span>Note</span>
      </div>
      <div v-if="!monthCosts.length" class="fc-empty">ไม่มีข้อมูลค่าใช้จ่าย</div>
      <div v-for="c in monthCosts" :key="c.id" class="fc-row">
        <span class="fc-date">{{ c.date }}</span>
        <span class="fc-boat">{{ c.boat || '—' }}</span>
        <span><span class="pill pill-blue" style="font-size:9px">{{ c.category || '—' }}</span></span>
        <span class="fc-desc">{{ c.desc || c.title || '—' }}</span>
        <span class="fc-amt">฿{{ fmtTHB(c.amount || c.cost || 0) }}</span>
        <span class="fc-note">{{ c.note || '' }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useAppStore } from '../../store/app'
import { useAppData } from '../../composables/useAppData'

const store = useAppStore()
const { fmtTHB, TODAY } = useAppData()

const currentMonth = TODAY.slice(0, 7)
const filterMonth  = ref(currentMonth)
const costs        = computed(() => store.state?.fl_costs || store.state?.fleet_costs || [])

const months = computed(() => {
  const set = new Set(costs.value.map(c => c.date?.slice(0, 7)).filter(Boolean))
  set.add(currentMonth)
  return [...set].sort((a, b) => b.localeCompare(a)).slice(0, 18).map(v => ({
    value: v,
    label: new Date(v + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
  }))
})
const filterMonthLabel = computed(() => months.value.find(m => m.value === filterMonth.value)?.label || filterMonth.value)

const monthCosts = computed(() =>
  [...costs.value.filter(c => (c.date || '').startsWith(filterMonth.value))]
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
)
const totalCost = computed(() => monthCosts.value.reduce((s, c) => s + (c.amount || c.cost || 0), 0))

function byCat(cat) { return monthCosts.value.filter(c => c.category === cat).reduce((s, c) => s + (c.amount || c.cost || 0), 0) }
function pct(cat)   { return totalCost.value > 0 ? Math.round(byCat(cat) / totalCost.value * 100) : 0 }

const CAT_COLORS = { fuel: '#185FA5', maintenance: '#e53e3e', crew: '#0F6E56', other: '#7f8c8d' }
const catRows = computed(() => {
  const map = {}
  for (const c of monthCosts.value) {
    const cat = c.category || 'other'
    if (!map[cat]) map[cat] = { name: cat, cost: 0, color: CAT_COLORS[cat] || '#aaa' }
    map[cat].cost += c.amount || c.cost || 0
  }
  const rows = Object.values(map).sort((a, b) => b.cost - a.cost)
  const max = rows[0]?.cost || 1
  return rows.map(r => ({ ...r, pct: Math.round(r.cost / totalCost.value * 100) }))
})
</script>

<style scoped>
.fc-select { padding: 6px 10px; border: 1px solid var(--border); border-radius: var(--r-sm); font-size: 12px; background: var(--white); outline: none; }
.fc-kpi-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 14px; }
.fc-breakdown { padding: 14px; margin-bottom: 14px; }
.fc-bar-row { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
.fc-bar-lbl { font-size: 11px; font-weight: 600; text-transform: capitalize; width: 100px; }
.fc-bar-track { flex: 1; height: 8px; background: var(--border); border-radius: 4px; overflow: hidden; }
.fc-bar-fill  { height: 100%; border-radius: 4px; }
.fc-bar-val   { font-size: 11px; font-weight: 700; min-width: 110px; text-align: right; }
.fc-bar-pct   { font-size: 10px; color: var(--ink-soft); font-weight: 400; }
.fc-table-hd {
  display: grid; grid-template-columns: 85px 100px 100px 1fr 100px 1fr;
  gap: 8px; padding: 7px 14px;
  background: var(--sand); border-bottom: 1px solid var(--border);
  font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: var(--ink-soft);
}
.fc-row {
  display: grid; grid-template-columns: 85px 100px 100px 1fr 100px 1fr;
  gap: 8px; padding: 8px 14px; align-items: center; font-size: 11px;
  border-bottom: 1px solid var(--border);
}
.fc-row:hover { background: var(--sand); }
.fc-row:last-child { border-bottom: none; }
.fc-date { font-size: 10px; color: var(--ink-soft); }
.fc-boat { font-weight: 600; }
.fc-desc { color: var(--ink-mid); }
.fc-amt  { font-weight: 700; text-align: right; color: var(--red); }
.fc-note { color: var(--ink-soft); font-size: 10px; }
.fc-empty { padding: 40px; text-align: center; color: var(--ink-soft); font-size: 12px; }
</style>
