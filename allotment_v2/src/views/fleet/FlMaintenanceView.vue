<template>
  <div>
    <div class="page-hd">
      <div>
        <h1>Maintenance</h1>
        <p>แผนซ่อมบำรุงและประวัติการซ่อม</p>
      </div>
    </div>

    <div class="mn-kpi-row">
      <div class="kpi k-coral">
        <div class="kpi-lbl">Pending</div>
        <div class="kpi-val" style="color:var(--red)">{{ pending }}</div>
        <div class="kpi-sub">awaiting</div>
      </div>
      <div class="kpi k-ocean">
        <div class="kpi-lbl">In Progress</div>
        <div class="kpi-val" style="color:var(--ocean-mid)">{{ inProgress }}</div>
        <div class="kpi-sub">active</div>
      </div>
      <div class="kpi k-green">
        <div class="kpi-lbl">Done</div>
        <div class="kpi-val" style="color:var(--green)">{{ done }}</div>
        <div class="kpi-sub">completed</div>
      </div>
      <div class="kpi">
        <div class="kpi-lbl">Total Cost</div>
        <div class="kpi-val" style="font-size:16px">฿{{ fmtTHB(totalCost) }}</div>
        <div class="kpi-sub">maintenance</div>
      </div>
    </div>

    <!-- Boat filter -->
    <div class="mn-filters">
      <button class="pill mn-pill" :class="{ active: !filterBoat }" @click="filterBoat = ''">All Boats</button>
      <button v-for="b in boatNames" :key="b" class="pill mn-pill" :class="{ active: filterBoat === b }" @click="filterBoat = filterBoat === b ? '' : b">{{ b }}</button>
    </div>

    <div class="card" style="padding:0;overflow:hidden">
      <div class="mn-table-hd">
        <span>Date</span><span>Boat</span><span>Type</span><span>Description</span><span>Cost</span><span>Vendor</span><span>Status</span>
      </div>
      <div v-if="!filtered.length" class="mn-empty">ไม่มีประวัติการซ่อมบำรุง</div>
      <div v-for="m in filtered" :key="m.id" class="mn-row">
        <span class="mn-date">{{ m.date }}</span>
        <span class="mn-boat">{{ m.boat || '—' }}</span>
        <span><span class="pill pill-blue" style="font-size:9px">{{ m.type || 'general' }}</span></span>
        <span class="mn-desc">{{ m.desc || m.title || '—' }}</span>
        <span class="mn-cost">฿{{ fmtTHB(m.cost || 0) }}</span>
        <span>{{ m.vendor || '—' }}</span>
        <span><span class="pill" :class="mnPill(m.status)">{{ m.status || 'pending' }}</span></span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useAppStore } from '../../store/app'
import { useAppData } from '../../composables/useAppData'

const store = useAppStore()
const { fmtTHB } = useAppData()

const filterBoat = ref('')
const records = computed(() => store.state?.maintenance || store.state?.fl_maintenance || [])

const pending    = computed(() => records.value.filter(m => m.status === 'pending').length)
const inProgress = computed(() => records.value.filter(m => m.status === 'in_progress').length)
const done       = computed(() => records.value.filter(m => m.status === 'done').length)
const totalCost  = computed(() => records.value.reduce((s, m) => s + (m.cost || 0), 0))
const boatNames  = computed(() => [...new Set(records.value.map(m => m.boat).filter(Boolean))].sort())

const filtered = computed(() => {
  const list = filterBoat.value ? records.value.filter(m => m.boat === filterBoat.value) : records.value
  return [...list].sort((a, b) => (b.date || '').localeCompare(a.date || ''))
})

function mnPill(s) {
  if (s === 'done') return 'pill-green'
  if (s === 'in_progress') return 'pill-blue'
  if (s === 'cancelled') return 'pill-red'
  return 'pill-amber'
}
</script>

<style scoped>
.mn-kpi-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 14px; }
.mn-filters { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
.mn-pill { cursor: pointer; font-size: 10px; border: 1px solid var(--border); background: var(--white); color: var(--ink-mid); }
.mn-pill:hover { border-color: var(--ocean-mid); }
.mn-pill.active { background: var(--ocean-50); border-color: var(--ocean-mid); color: var(--ocean); }
.mn-table-hd {
  display: grid; grid-template-columns: 85px 110px 100px 1fr 90px 120px 90px;
  gap: 8px; padding: 7px 14px;
  background: var(--sand); border-bottom: 1px solid var(--border);
  font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: var(--ink-soft);
}
.mn-row {
  display: grid; grid-template-columns: 85px 110px 100px 1fr 90px 120px 90px;
  gap: 8px; padding: 9px 14px; align-items: center; font-size: 11px;
  border-bottom: 1px solid var(--border);
}
.mn-row:hover { background: var(--sand); }
.mn-row:last-child { border-bottom: none; }
.mn-date { font-size: 10px; color: var(--ink-soft); }
.mn-boat { font-weight: 600; }
.mn-desc { color: var(--ink-mid); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mn-cost { font-weight: 700; text-align: right; }
.mn-empty { padding: 40px; text-align: center; color: var(--ink-soft); font-size: 12px; }
</style>
