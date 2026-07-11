<template>
  <div>
    <div class="page-hd">
      <div>
        <h1>Incidents</h1>
        <p>รายงานเหตุการณ์และอุบัติเหตุ</p>
      </div>
    </div>

    <div class="inc-kpi-row">
      <div class="kpi k-coral">
        <div class="kpi-lbl">Open</div>
        <div class="kpi-val" style="color:var(--red)">{{ openCount }}</div>
        <div class="kpi-sub">unresolved</div>
      </div>
      <div class="kpi k-green">
        <div class="kpi-lbl">Resolved</div>
        <div class="kpi-val" style="color:var(--green)">{{ resolvedCount }}</div>
        <div class="kpi-sub">closed</div>
      </div>
      <div class="kpi">
        <div class="kpi-lbl">Total</div>
        <div class="kpi-val">{{ incidents.length }}</div>
        <div class="kpi-sub">incidents</div>
      </div>
      <div class="kpi">
        <div class="kpi-lbl">This Month</div>
        <div class="kpi-val">{{ thisMonth }}</div>
        <div class="kpi-sub">incidents</div>
      </div>
    </div>

    <!-- Severity filter -->
    <div class="inc-filters">
      <button class="pill inc-pill" :class="{ active: !filterSev }" @click="filterSev = ''">All</button>
      <button v-for="s in ['critical','high','medium','low']" :key="s" class="pill inc-pill" :class="{ active: filterSev === s }" @click="filterSev = filterSev === s ? '' : s" :style="filterSev === s ? { background: sevColor(s), color: '#fff', borderColor: sevColor(s) } : {}">{{ s }}</button>
    </div>

    <div class="card" style="padding:0;overflow:hidden">
      <div class="inc-table-hd">
        <span>Date</span><span>Boat</span><span>Severity</span><span>Type</span><span>Summary</span><span>Status</span><span>Reported By</span>
      </div>
      <div v-if="!filtered.length" class="inc-empty">ไม่มีรายงานเหตุการณ์</div>
      <div v-for="inc in filtered" :key="inc.id" class="inc-row" :class="{ 'inc-open': inc.status !== 'resolved' }">
        <span class="inc-date">{{ inc.date }}</span>
        <span class="inc-boat">{{ inc.boat || '—' }}</span>
        <span><span class="pill" :style="{ background: sevColor(inc.severity) + '22', color: sevColor(inc.severity), borderColor: sevColor(inc.severity) + '55', border: '1px solid' }">{{ inc.severity || 'low' }}</span></span>
        <span>{{ inc.type || '—' }}</span>
        <span class="inc-summary">{{ inc.summary || inc.desc || '—' }}</span>
        <span><span class="pill" :class="inc.status === 'resolved' ? 'pill-green' : 'pill-red'">{{ inc.status || 'open' }}</span></span>
        <span class="inc-by">{{ inc.reportedBy || '—' }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useAppStore } from '../../store/app'
import { useAppData } from '../../composables/useAppData'

const store = useAppStore()
const { TODAY } = useAppData()

const filterSev = ref('')
const incidents = computed(() => store.state?.incidents || store.state?.fl_incidents || [])
const currentMonth = TODAY.slice(0, 7)

const openCount     = computed(() => incidents.value.filter(i => i.status !== 'resolved').length)
const resolvedCount = computed(() => incidents.value.filter(i => i.status === 'resolved').length)
const thisMonth     = computed(() => incidents.value.filter(i => (i.date || '').startsWith(currentMonth)).length)

const filtered = computed(() => {
  if (!filterSev.value) return incidents.value
  return incidents.value.filter(i => i.severity === filterSev.value)
})

const SEV_COLORS = { critical: '#c0392b', high: '#e67e22', medium: '#d48a14', low: '#27ae60' }
function sevColor(s) { return SEV_COLORS[s] || '#7f8c8d' }
</script>

<style scoped>
.inc-kpi-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 14px; }
.inc-filters { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
.inc-pill { cursor: pointer; font-size: 10px; font-weight: 600; border: 1px solid var(--border); background: var(--white); color: var(--ink-mid); text-transform: capitalize; }
.inc-pill:hover { border-color: var(--ocean-mid); }
.inc-pill.active { color: #fff; }
.inc-table-hd {
  display: grid; grid-template-columns: 85px 110px 90px 100px 1fr 90px 110px;
  gap: 8px; padding: 7px 14px;
  background: var(--sand); border-bottom: 1px solid var(--border);
  font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: var(--ink-soft);
}
.inc-row {
  display: grid; grid-template-columns: 85px 110px 90px 100px 1fr 90px 110px;
  gap: 8px; padding: 9px 14px; align-items: center; font-size: 11px;
  border-bottom: 1px solid var(--border);
}
.inc-row:hover { background: var(--sand); }
.inc-row:last-child { border-bottom: none; }
.inc-row.inc-open { background: #fffbf0; }
.inc-date { font-size: 10px; color: var(--ink-soft); }
.inc-boat { font-weight: 600; }
.inc-summary { color: var(--ink-mid); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.inc-by { font-size: 10px; color: var(--ink-soft); }
.inc-empty { padding: 40px; text-align: center; color: var(--ink-soft); font-size: 12px; }
</style>
