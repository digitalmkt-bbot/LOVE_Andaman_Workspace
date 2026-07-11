<template>
  <div>
    <div class="page-hd">
      <div>
        <h1>Vehicles</h1>
        <p>รายการยานพาหนะ — รถตู้, รถบัส, และพาหนะสนับสนุน</p>
      </div>
    </div>

    <div class="veh-kpi-row">
      <div class="kpi k-green">
        <div class="kpi-lbl">Available</div>
        <div class="kpi-val" style="color:var(--green)">{{ available }}</div>
        <div class="kpi-sub">ready</div>
      </div>
      <div class="kpi k-coral">
        <div class="kpi-lbl">In Service</div>
        <div class="kpi-val" style="color:var(--ocean-mid)">{{ inService }}</div>
        <div class="kpi-sub">deployed today</div>
      </div>
      <div class="kpi">
        <div class="kpi-lbl">Maintenance</div>
        <div class="kpi-val" style="color:var(--red)">{{ inMaint }}</div>
        <div class="kpi-sub">out of service</div>
      </div>
      <div class="kpi">
        <div class="kpi-lbl">Total Fleet</div>
        <div class="kpi-val">{{ vehicles.length }}</div>
        <div class="kpi-sub">vehicles</div>
      </div>
    </div>

    <div class="veh-grid">
      <div v-for="v in vehicles" :key="v.id" class="veh-card" :class="`veh-${statusKey(v)}`">
        <div class="veh-card-top">
          <div class="veh-type-icon">{{ typeIcon(v.type) }}</div>
          <div class="veh-info">
            <div class="veh-name">{{ v.name || v.plate }}</div>
            <div class="veh-plate">{{ v.plate || '—' }}</div>
          </div>
          <span class="pill" :class="statusPill(v)">{{ v.status || 'available' }}</span>
        </div>
        <div class="veh-meta">
          <div class="veh-meta-row"><span class="veh-lbl">Type</span><span>{{ v.type || '—' }}</span></div>
          <div class="veh-meta-row"><span class="veh-lbl">Cap</span><span>{{ v.cap || '—' }} seats</span></div>
          <div v-if="v.driver" class="veh-meta-row"><span class="veh-lbl">Driver</span><span>{{ v.driver }}</span></div>
          <div v-if="v.note" class="veh-meta-row"><span class="veh-lbl">Note</span><span style="color:var(--ink-soft)">{{ v.note }}</span></div>
        </div>
      </div>
      <div v-if="!vehicles.length" class="veh-empty">ยังไม่มีข้อมูลยานพาหนะ</div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useAppStore } from '../../store/app'
import { useAppData } from '../../composables/useAppData'

const store = useAppStore()
const { TODAY } = useAppData()

const vehicles = computed(() => store.state?.vehicles || store.state?.vans || [])

function statusKey(v) {
  const s = v.status || 'available'
  if (s === 'available') return 'ok'
  if (s === 'maintenance' || s === 'repair') return 'out'
  return 'busy'
}
function statusPill(v) {
  const k = statusKey(v)
  return k === 'ok' ? 'pill-green' : k === 'out' ? 'pill-red' : 'pill-amber'
}
function typeIcon(t) {
  if (!t) return '🚐'
  if (t.toLowerCase().includes('bus'))  return '🚌'
  if (t.toLowerCase().includes('car'))  return '🚗'
  return '🚐'
}

const available  = computed(() => vehicles.value.filter(v => statusKey(v) === 'ok').length)
const inService  = computed(() => vehicles.value.filter(v => statusKey(v) === 'busy').length)
const inMaint    = computed(() => vehicles.value.filter(v => statusKey(v) === 'out').length)
</script>

<style scoped>
.veh-kpi-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 16px; }
.veh-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px;
}
.veh-card {
  background: var(--white); border: 1px solid var(--border); border-radius: var(--r);
  padding: 14px; border-top: 3px solid var(--border);
}
.veh-ok   { border-top-color: var(--green); }
.veh-out  { border-top-color: var(--red); opacity: .8; }
.veh-busy { border-top-color: var(--amber); }
.veh-card-top { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
.veh-type-icon { font-size: 22px; }
.veh-info { flex: 1; }
.veh-name  { font-size: 13px; font-weight: 700; }
.veh-plate { font-size: 10px; font-family: 'DM Mono', monospace; color: var(--ink-soft); }
.veh-meta  { display: flex; flex-direction: column; gap: 3px; }
.veh-meta-row { display: flex; gap: 8px; font-size: 11px; }
.veh-lbl { color: var(--ink-soft); width: 50px; }
.veh-empty { grid-column: 1/-1; text-align: center; color: var(--ink-soft); font-size: 12px; padding: 40px; }
</style>
