<template>
  <div>
    <div class="page-hd">
      <div>
        <h1>Fuel</h1>
        <p>บันทึกการเติมน้ำมันและค่าใช้จ่ายเชื้อเพลิง</p>
      </div>
      <div class="page-actions">
        <select v-model="filterMonth" class="fu-select">
          <option v-for="m in months" :key="m.value" :value="m.value">{{ m.label }}</option>
        </select>
      </div>
    </div>

    <div class="fu-kpi-row">
      <div class="kpi k-coral">
        <div class="kpi-lbl">Total Cost</div>
        <div class="kpi-val" style="color:var(--red);font-size:20px">฿{{ fmtTHB(totalCost) }}</div>
        <div class="kpi-sub">{{ filterMonthLabel }}</div>
      </div>
      <div class="kpi k-ocean">
        <div class="kpi-lbl">Total Litres</div>
        <div class="kpi-val" style="color:var(--ocean-mid)">{{ totalLitres.toLocaleString() }}</div>
        <div class="kpi-sub">L</div>
      </div>
      <div class="kpi">
        <div class="kpi-lbl">Avg Price/L</div>
        <div class="kpi-val">฿{{ avgPricePerL }}</div>
        <div class="kpi-sub">per litre</div>
      </div>
      <div class="kpi">
        <div class="kpi-lbl">Fill-ups</div>
        <div class="kpi-val">{{ monthRecords.length }}</div>
        <div class="kpi-sub">this month</div>
      </div>
    </div>

    <!-- Per-boat breakdown bars -->
    <div class="card fu-breakdown">
      <div class="card-title">By Boat</div>
      <div v-if="!boatRows.length" class="fu-empty">ไม่มีข้อมูล</div>
      <div v-for="row in boatRows" :key="row.boat" class="fu-bar-row">
        <div class="fu-bar-lbl">{{ row.boat }}</div>
        <div class="fu-bar-track">
          <div class="fu-bar-fill" :style="{ width: row.pct + '%' }"></div>
        </div>
        <div class="fu-bar-val">฿{{ fmtTHB(row.cost) }} · {{ row.litres }}L</div>
      </div>
    </div>

    <!-- Records -->
    <div class="card" style="padding:0;overflow:hidden;margin-top:14px">
      <div class="fu-table-hd">
        <span>Date</span><span>Boat</span><span>Litres</span><span>Price/L</span><span>Total</span><span>Station</span><span>Note</span>
      </div>
      <div v-if="!monthRecords.length" class="fu-empty">ไม่มีข้อมูลการเติมน้ำมัน</div>
      <div v-for="r in monthRecords" :key="r.id" class="fu-row">
        <span class="fu-date">{{ r.date }}</span>
        <span class="fu-boat">{{ r.boat || '—' }}</span>
        <span class="fu-litres">{{ r.litres || '—' }}</span>
        <span>฿{{ r.pricePerL || '—' }}</span>
        <span class="fu-total">฿{{ fmtTHB(r.cost || (r.litres || 0) * (r.pricePerL || 0)) }}</span>
        <span>{{ r.station || '—' }}</span>
        <span class="fu-note">{{ r.note || '' }}</span>
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
const fuelRecords  = computed(() => store.state?.fuel || store.state?.fl_fuel || [])

const months = computed(() => {
  const set = new Set(fuelRecords.value.map(r => r.date?.slice(0, 7)).filter(Boolean))
  set.add(currentMonth)
  return [...set].sort((a, b) => b.localeCompare(a)).slice(0, 18).map(v => ({
    value: v,
    label: new Date(v + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
  }))
})
const filterMonthLabel = computed(() => months.value.find(m => m.value === filterMonth.value)?.label || filterMonth.value)

const monthRecords = computed(() =>
  [...fuelRecords.value.filter(r => (r.date || '').startsWith(filterMonth.value))]
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
)

const totalCost   = computed(() => monthRecords.value.reduce((s, r) => s + (r.cost || (r.litres || 0) * (r.pricePerL || 0)), 0))
const totalLitres = computed(() => monthRecords.value.reduce((s, r) => s + (r.litres || 0), 0))
const avgPricePerL = computed(() => totalLitres.value > 0 ? (totalCost.value / totalLitres.value).toFixed(1) : '—')

const boatRows = computed(() => {
  const map = {}
  for (const r of monthRecords.value) {
    const b = r.boat || '—'
    if (!map[b]) map[b] = { boat: b, cost: 0, litres: 0 }
    map[b].cost   += r.cost || (r.litres || 0) * (r.pricePerL || 0)
    map[b].litres += r.litres || 0
  }
  const rows = Object.values(map).sort((a, b) => b.cost - a.cost)
  const max = rows[0]?.cost || 1
  return rows.map(r => ({ ...r, pct: Math.round(r.cost / max * 100) }))
})
</script>

<style scoped>
.fu-select { padding: 6px 10px; border: 1px solid var(--border); border-radius: var(--r-sm); font-size: 12px; background: var(--white); outline: none; }
.fu-kpi-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 14px; }
.fu-breakdown { padding: 14px; }
.fu-bar-row { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
.fu-bar-lbl { font-size: 11px; font-weight: 600; width: 110px; flex-shrink: 0; }
.fu-bar-track { flex: 1; height: 8px; background: var(--border); border-radius: 4px; overflow: hidden; }
.fu-bar-fill  { height: 100%; background: var(--ocean-mid); border-radius: 4px; }
.fu-bar-val   { font-size: 11px; font-weight: 700; min-width: 120px; text-align: right; }
.fu-table-hd {
  display: grid; grid-template-columns: 85px 100px 70px 80px 90px 130px 1fr;
  gap: 8px; padding: 7px 14px;
  background: var(--sand); border-bottom: 1px solid var(--border);
  font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: var(--ink-soft);
}
.fu-row {
  display: grid; grid-template-columns: 85px 100px 70px 80px 90px 130px 1fr;
  gap: 8px; padding: 8px 14px; align-items: center; font-size: 11px;
  border-bottom: 1px solid var(--border);
}
.fu-row:hover { background: var(--sand); }
.fu-row:last-child { border-bottom: none; }
.fu-date   { font-size: 10px; color: var(--ink-soft); }
.fu-boat   { font-weight: 600; }
.fu-litres { font-weight: 700; text-align: center; }
.fu-total  { font-weight: 700; color: var(--red); }
.fu-note   { color: var(--ink-soft); font-size: 10px; }
.fu-empty  { padding: 40px; text-align: center; color: var(--ink-soft); font-size: 12px; }
</style>
