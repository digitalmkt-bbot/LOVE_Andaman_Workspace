<template>
  <div>
    <div class="page-hd">
      <div>
        <h1>Booking Flow</h1>
        <p>ขั้นตอนและสถานะ booking pipeline</p>
      </div>
    </div>

    <div class="bf-kpi-row">
      <div v-for="stage in stages" :key="stage.key" class="kpi" :class="stage.kpiClass">
        <div class="kpi-lbl">{{ stage.label }}</div>
        <div class="kpi-val" :style="{ color: stage.color }">{{ stageCount(stage.key) }}</div>
        <div class="kpi-sub">bookings</div>
      </div>
    </div>

    <!-- Pipeline columns -->
    <div class="bf-board">
      <div v-for="stage in stages" :key="stage.key" class="bf-col">
        <div class="bf-col-hd" :style="{ borderTopColor: stage.color }">
          <span class="bf-col-title">{{ stage.label }}</span>
          <span class="bf-col-count" :style="{ background: stage.color }">{{ stageCount(stage.key) }}</span>
        </div>
        <div v-if="!stageBookings(stage.key).length" class="bf-empty-col">—</div>
        <div v-for="b in stageBookings(stage.key).slice(0, 20)" :key="b.id" class="bf-card">
          <div class="bf-card-top">
            <span class="bf-ref">{{ b.ref || b.id }}</span>
            <span class="bf-date">{{ b.date }}</span>
          </div>
          <div class="bf-card-route">
            <span v-if="getRoute(b.route)" class="bf-rdot" :style="{ background: getRoute(b.route).color }"></span>
            {{ getRoute(b.route)?.name || b.route || '—' }}
          </div>
          <div class="bf-card-meta">
            <span>{{ b.agent || '—' }}</span>
            <span class="bf-pax">{{ b.pax || 0 }} pax</span>
          </div>
        </div>
        <div v-if="stageBookings(stage.key).length > 20" class="bf-more">+{{ stageBookings(stage.key).length - 20 }} more</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useAppData } from '../../composables/useAppData'

const { bookings, getRoute } = useAppData()

const stages = [
  { key: 'pending',   label: 'Pending',   color: '#d48a14', kpiClass: '' },
  { key: 'confirmed', label: 'Confirmed', color: '#16a34a', kpiClass: 'k-green' },
  { key: 'reconfirmed', label: 'Reconfirmed', color: '#185FA5', kpiClass: 'k-ocean' },
  { key: 'done',      label: 'Done',      color: '#6c5ce7', kpiClass: '' },
  { key: 'cancelled', label: 'Cancelled', color: '#e53e3e', kpiClass: 'k-coral' },
]

function stageBookings(key) {
  if (key === 'confirmed') return bookings.value.filter(b => (!b.status || b.status === 'confirmed') && !b.reconfirmed && b.status !== 'cancelled')
  if (key === 'reconfirmed') return bookings.value.filter(b => b.reconfirmed && b.status !== 'cancelled' && b.status !== 'done')
  return bookings.value.filter(b => b.status === key)
}
function stageCount(key) { return stageBookings(key).length }
</script>

<style scoped>
.bf-kpi-row { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-bottom: 16px; }
.bf-board   { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; align-items: start; }
.bf-col { background: var(--sand); border-radius: var(--r); overflow: hidden; }
.bf-col-hd {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 12px; border-top: 3px solid var(--border);
  background: var(--white); border-bottom: 1px solid var(--border);
}
.bf-col-title { font-size: 11px; font-weight: 700; }
.bf-col-count { font-size: 10px; font-weight: 700; color: #fff; padding: 2px 7px; border-radius: 10px; }
.bf-empty-col { padding: 16px; text-align: center; font-size: 11px; color: var(--ink-soft); }
.bf-card {
  background: var(--white); margin: 6px; border-radius: var(--r-sm);
  border: 1px solid var(--border); padding: 8px 10px;
}
.bf-card-top  { display: flex; justify-content: space-between; margin-bottom: 4px; }
.bf-ref  { font-family: 'DM Mono', monospace; font-size: 10px; font-weight: 700; }
.bf-date { font-size: 9px; color: var(--ink-soft); }
.bf-card-route { display: flex; align-items: center; gap: 5px; font-size: 11px; font-weight: 500; margin-bottom: 4px; }
.bf-rdot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
.bf-card-meta { display: flex; justify-content: space-between; font-size: 10px; color: var(--ink-soft); }
.bf-pax { font-weight: 600; color: var(--ink-mid); }
.bf-more { padding: 6px 12px; font-size: 10px; color: var(--ink-soft); text-align: center; }
</style>
