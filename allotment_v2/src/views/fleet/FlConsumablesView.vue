<template>
  <div>
    <div class="page-hd">
      <div>
        <h1>Consumables</h1>
        <p>วัสดุสิ้นเปลือง — น้ำมัน, น้ำดื่ม, อุปกรณ์ใช้แล้วทิ้ง</p>
      </div>
    </div>

    <div class="cs-kpi-row">
      <div class="kpi">
        <div class="kpi-lbl">Records</div>
        <div class="kpi-val">{{ records.length }}</div>
        <div class="kpi-sub">usage logs</div>
      </div>
      <div class="kpi k-coral">
        <div class="kpi-lbl">This Month Cost</div>
        <div class="kpi-val" style="color:var(--red);font-size:18px">฿{{ fmtTHB(monthCost) }}</div>
        <div class="kpi-sub">consumables</div>
      </div>
      <div class="kpi">
        <div class="kpi-lbl">Types</div>
        <div class="kpi-val">{{ types.length }}</div>
        <div class="kpi-sub">categories</div>
      </div>
    </div>

    <!-- Type filter -->
    <div class="cs-filters">
      <button class="pill cs-pill" :class="{ active: !filterType }" @click="filterType = ''">All</button>
      <button v-for="t in types" :key="t" class="pill cs-pill" :class="{ active: filterType === t }" @click="filterType = filterType === t ? '' : t">{{ t }}</button>
    </div>

    <div class="card" style="padding:0;overflow:hidden">
      <div class="cs-table-hd">
        <span>Date</span><span>Boat</span><span>Item</span><span>Qty</span><span>Unit</span><span>Cost</span><span>Note</span>
      </div>
      <div v-if="!filtered.length" class="cs-empty">ไม่มีข้อมูล</div>
      <div v-for="r in filtered" :key="r.id" class="cs-row">
        <span class="cs-date">{{ r.date }}</span>
        <span class="cs-boat">{{ r.boat || '—' }}</span>
        <span class="cs-item">{{ r.item || r.name || '—' }}</span>
        <span class="cs-qty">{{ r.qty || '—' }}</span>
        <span>{{ r.unit || '—' }}</span>
        <span class="cs-cost">฿{{ fmtTHB(r.cost || 0) }}</span>
        <span class="cs-note">{{ r.note || '' }}</span>
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

const filterType = ref('')
const records    = computed(() => store.state?.consumables || store.state?.fl_consumables || [])
const types      = computed(() => [...new Set(records.value.map(r => r.type || r.category).filter(Boolean))].sort())
const currentMonth = TODAY.slice(0, 7)
const monthCost  = computed(() => records.value.filter(r => (r.date || '').startsWith(currentMonth)).reduce((s, r) => s + (r.cost || 0), 0))

const filtered = computed(() => {
  const list = filterType.value ? records.value.filter(r => (r.type || r.category) === filterType.value) : records.value
  return [...list].sort((a, b) => (b.date || '').localeCompare(a.date || ''))
})
</script>

<style scoped>
.cs-kpi-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 14px; }
.cs-filters { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
.cs-pill { cursor: pointer; font-size: 10px; border: 1px solid var(--border); background: var(--white); color: var(--ink-mid); }
.cs-pill:hover { border-color: var(--ocean-mid); }
.cs-pill.active { background: var(--ocean-50); border-color: var(--ocean-mid); color: var(--ocean); }
.cs-table-hd {
  display: grid; grid-template-columns: 85px 100px 1fr 60px 60px 90px 1fr;
  gap: 8px; padding: 7px 14px;
  background: var(--sand); border-bottom: 1px solid var(--border);
  font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: var(--ink-soft);
}
.cs-row {
  display: grid; grid-template-columns: 85px 100px 1fr 60px 60px 90px 1fr;
  gap: 8px; padding: 8px 14px; align-items: center; font-size: 11px;
  border-bottom: 1px solid var(--border);
}
.cs-row:hover { background: var(--sand); }
.cs-row:last-child { border-bottom: none; }
.cs-date { font-size: 10px; color: var(--ink-soft); }
.cs-boat { font-weight: 600; }
.cs-item { font-weight: 500; }
.cs-qty  { font-weight: 700; text-align: center; }
.cs-cost { font-weight: 700; text-align: right; }
.cs-note { color: var(--ink-soft); font-size: 10px; }
.cs-empty { padding: 40px; text-align: center; color: var(--ink-soft); font-size: 12px; }
</style>
