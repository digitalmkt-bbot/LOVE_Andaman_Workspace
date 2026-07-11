<template>
  <div>
    <div class="page-hd">
      <div>
        <h1>Fleet Projects</h1>
        <p>โปรเจกต์ซ่อมบำรุงและปรับปรุงเรือ</p>
      </div>
    </div>

    <div class="fp-kpi-row">
      <div class="kpi k-ocean">
        <div class="kpi-lbl">In Progress</div>
        <div class="kpi-val" style="color:var(--ocean-mid)">{{ inProgress }}</div>
        <div class="kpi-sub">projects</div>
      </div>
      <div class="kpi k-green">
        <div class="kpi-lbl">Completed</div>
        <div class="kpi-val" style="color:var(--green)">{{ completed }}</div>
        <div class="kpi-sub">this year</div>
      </div>
      <div class="kpi k-coral">
        <div class="kpi-lbl">Overdue</div>
        <div class="kpi-val" style="color:var(--red)">{{ overdue }}</div>
        <div class="kpi-sub">past deadline</div>
      </div>
      <div class="kpi">
        <div class="kpi-lbl">Total Cost</div>
        <div class="kpi-val" style="font-size:16px">฿{{ fmtTHB(totalCost) }}</div>
        <div class="kpi-sub">all projects</div>
      </div>
    </div>

    <!-- Status tabs -->
    <div class="fp-tabs">
      <button v-for="t in tabs" :key="t.key" class="fp-tab" :class="{ active: activeTab === t.key }" @click="activeTab = t.key">
        {{ t.label }} <span class="fp-tab-count">{{ t.count }}</span>
      </button>
    </div>

    <div class="fp-list">
      <div v-if="!filtered.length" class="fp-empty">ไม่มีโปรเจกต์</div>
      <div v-for="p in filtered" :key="p.id" class="fp-card card">
        <div class="fp-card-top">
          <div class="fp-title">{{ p.title || p.name }}</div>
          <span class="pill" :class="statusPill(p.status)">{{ p.status || 'planned' }}</span>
        </div>
        <div class="fp-meta-row">
          <span class="fp-lbl">Boat</span><span class="fp-val">{{ p.boat || '—' }}</span>
          <span class="fp-lbl">Budget</span><span class="fp-val">฿{{ fmtTHB(p.budget || 0) }}</span>
        </div>
        <div class="fp-meta-row">
          <span class="fp-lbl">Start</span><span class="fp-val">{{ fmtDate(p.start) }}</span>
          <span class="fp-lbl">Due</span><span class="fp-val" :class="{ overdue: p.due < TODAY && p.status !== 'done' }">{{ fmtDate(p.due) }}</span>
        </div>
        <div v-if="p.progress !== undefined" class="fp-progress-wrap">
          <div class="fp-progress-bar">
            <div class="fp-progress-fill" :style="{ width: (p.progress || 0) + '%' }"></div>
          </div>
          <span class="fp-progress-pct">{{ p.progress || 0 }}%</span>
        </div>
        <div v-if="p.note" class="fp-note">{{ p.note }}</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useAppStore } from '../../store/app'
import { useAppData } from '../../composables/useAppData'

const store = useAppStore()
const { fmtDate, fmtTHB, TODAY } = useAppData()

const activeTab = ref('all')
const projects  = computed(() => store.state?.fl_projects || store.state?.projects || [])

const inProgress = computed(() => projects.value.filter(p => p.status === 'in_progress' || p.status === 'active').length)
const completed  = computed(() => projects.value.filter(p => p.status === 'done' || p.status === 'completed').length)
const overdue    = computed(() => projects.value.filter(p => p.due < TODAY && p.status !== 'done').length)
const totalCost  = computed(() => projects.value.reduce((s, p) => s + (p.budget || p.cost || 0), 0))

const tabs = computed(() => [
  { key: 'all',         label: 'All',         count: projects.value.length },
  { key: 'in_progress', label: 'In Progress', count: inProgress.value },
  { key: 'planned',     label: 'Planned',     count: projects.value.filter(p => p.status === 'planned').length },
  { key: 'done',        label: 'Done',        count: completed.value },
])

const filtered = computed(() => {
  if (activeTab.value === 'all') return projects.value
  if (activeTab.value === 'in_progress') return projects.value.filter(p => p.status === 'in_progress' || p.status === 'active')
  if (activeTab.value === 'done') return projects.value.filter(p => p.status === 'done' || p.status === 'completed')
  return projects.value.filter(p => p.status === activeTab.value)
})

function statusPill(s) {
  if (s === 'done' || s === 'completed') return 'pill-green'
  if (s === 'in_progress' || s === 'active') return 'pill-blue'
  if (s === 'cancelled') return 'pill-red'
  return 'pill-gray'
}
</script>

<style scoped>
.fp-kpi-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 14px; }
.fp-tabs { display: flex; gap: 0; margin-bottom: 14px; border-bottom: 1px solid var(--border); }
.fp-tab {
  padding: 8px 16px; font-size: 12px; font-weight: 500; cursor: pointer;
  border: none; background: none; color: var(--ink-soft); border-bottom: 2px solid transparent; margin-bottom: -1px;
}
.fp-tab:hover { color: var(--ink); }
.fp-tab.active { color: var(--ocean-mid); border-bottom-color: var(--ocean-mid); font-weight: 600; }
.fp-tab-count { font-size: 10px; background: var(--border); border-radius: 10px; padding: 1px 6px; margin-left: 4px; }
.fp-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 12px; }
.fp-card { padding: 14px; display: flex; flex-direction: column; gap: 8px; }
.fp-card-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
.fp-title { font-size: 13px; font-weight: 700; }
.fp-meta-row { display: flex; gap: 12px; font-size: 11px; align-items: center; }
.fp-lbl { color: var(--ink-soft); width: 36px; font-size: 9px; text-transform: uppercase; font-weight: 700; }
.fp-val { font-weight: 500; }
.fp-val.overdue { color: var(--red); font-weight: 700; }
.fp-progress-wrap { display: flex; align-items: center; gap: 8px; }
.fp-progress-bar  { flex: 1; height: 6px; background: var(--border); border-radius: 3px; overflow: hidden; }
.fp-progress-fill { height: 100%; background: var(--ocean-mid); border-radius: 3px; }
.fp-progress-pct  { font-size: 10px; font-weight: 700; color: var(--ocean-mid); min-width: 30px; text-align: right; }
.fp-note { font-size: 10px; color: var(--ink-soft); }
.fp-empty { grid-column: 1/-1; text-align: center; color: var(--ink-soft); font-size: 12px; padding: 40px; }
</style>
