<template>
  <div>
    <div class="page-hd">
      <div>
        <h1>FOC Detail</h1>
        <p>Free of Charge — รายละเอียด seat ฟรีตาม agent agreement</p>
      </div>
    </div>

    <div class="foc-kpi-row">
      <div class="kpi">
        <div class="kpi-lbl">FOC Records</div>
        <div class="kpi-val">{{ focs.length }}</div>
        <div class="kpi-sub">entries</div>
      </div>
      <div class="kpi k-coral">
        <div class="kpi-lbl">Total FOC Pax</div>
        <div class="kpi-val" style="color:var(--red)">{{ totalFocPax }}</div>
        <div class="kpi-sub">complimentary seats</div>
      </div>
      <div class="kpi k-ocean">
        <div class="kpi-lbl">Agents with FOC</div>
        <div class="kpi-val" style="color:var(--ocean-mid)">{{ agentsWithFoc }}</div>
        <div class="kpi-sub">agreements</div>
      </div>
      <div class="kpi">
        <div class="kpi-lbl">FOC Value</div>
        <div class="kpi-val">฿{{ fmtTHB(totalFocValue) }}</div>
        <div class="kpi-sub">est. cost</div>
      </div>
    </div>

    <!-- Agent filter -->
    <div class="foc-filters">
      <button class="pill foc-pill" :class="{ active: !filterAgent }" @click="filterAgent = ''">All Agents</button>
      <button v-for="a in focAgents" :key="a" class="pill foc-pill" :class="{ active: filterAgent === a }" @click="filterAgent = filterAgent === a ? '' : a">{{ a }}</button>
    </div>

    <div class="card" style="padding:0;overflow:hidden">
      <div class="foc-table-hd">
        <span>Agent</span><span>Route</span><span>Date</span><span>FOC Pax</span><span>Rate Type</span><span>Est. Value</span><span>Note</span>
      </div>
      <div v-if="!filtered.length" class="foc-empty">ไม่มีข้อมูล FOC</div>
      <div v-for="f in filtered" :key="f.id" class="foc-row">
        <span class="foc-agent">{{ f.agent || '—' }}</span>
        <div class="foc-route">
          <span v-if="getRoute(f.route)" class="foc-dot" :style="{ background: getRoute(f.route).color }"></span>
          {{ getRoute(f.route)?.name || f.route || '—' }}
        </div>
        <span class="foc-date">{{ fmtDate(f.date) }}</span>
        <span class="foc-pax">{{ f.pax || 0 }}</span>
        <span>{{ f.rateType || '—' }}</span>
        <span class="foc-val">฿{{ fmtTHB(f.value || 0) }}</span>
        <span class="foc-note">{{ f.note || '' }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useAppStore } from '../../store/app'
import { useAppData } from '../../composables/useAppData'

const store = useAppStore()
const { getRoute, fmtDate, fmtTHB } = useAppData()

const filterAgent = ref('')
const focs = computed(() => store.state?.foc || store.state?.sb_foc || [])
const focAgents = computed(() => [...new Set(focs.value.map(f => f.agent).filter(Boolean))].sort())

const totalFocPax   = computed(() => focs.value.reduce((s, f) => s + (f.pax || 0), 0))
const totalFocValue = computed(() => focs.value.reduce((s, f) => s + (f.value || 0), 0))
const agentsWithFoc = computed(() => new Set(focs.value.map(f => f.agent).filter(Boolean)).size)

const filtered = computed(() => {
  if (!filterAgent.value) return focs.value
  return focs.value.filter(f => f.agent === filterAgent.value)
})
</script>

<style scoped>
.foc-kpi-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 14px; }
.foc-filters { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
.foc-pill { cursor: pointer; font-size: 10px; font-weight: 500; border: 1px solid var(--border); background: var(--white); color: var(--ink-mid); }
.foc-pill:hover { border-color: var(--ocean-mid); }
.foc-pill.active { background: var(--ocean-50); border-color: var(--ocean-mid); color: var(--ocean); }
.foc-table-hd {
  display: grid; grid-template-columns: 130px 1fr 90px 70px 110px 100px 1fr;
  gap: 8px; padding: 7px 14px;
  background: var(--sand); border-bottom: 1px solid var(--border);
  font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: var(--ink-soft);
}
.foc-row {
  display: grid; grid-template-columns: 130px 1fr 90px 70px 110px 100px 1fr;
  gap: 8px; padding: 9px 14px; align-items: center; font-size: 11px;
  border-bottom: 1px solid var(--border);
}
.foc-row:hover { background: var(--sand); }
.foc-row:last-child { border-bottom: none; }
.foc-agent { font-weight: 600; }
.foc-route { display: flex; align-items: center; gap: 5px; }
.foc-dot   { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
.foc-date  { font-size: 10px; color: var(--ink-soft); }
.foc-pax   { font-weight: 700; color: var(--red); text-align: center; }
.foc-val   { font-weight: 600; }
.foc-note  { color: var(--ink-soft); font-size: 10px; }
.foc-empty { padding: 40px; text-align: center; color: var(--ink-soft); font-size: 12px; }
</style>
