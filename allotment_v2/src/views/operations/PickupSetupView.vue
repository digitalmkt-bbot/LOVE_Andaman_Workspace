<template>
  <div>
    <div class="page-hd">
      <div>
        <h1>Pickup Setup</h1>
        <p>จัดการจุดรับผู้โดยสาร — โรงแรม, จุดนัดพบ</p>
      </div>
    </div>

    <div class="ps-kpi-row">
      <div class="kpi">
        <div class="kpi-lbl">Pickup Points</div>
        <div class="kpi-val">{{ points.length }}</div>
        <div class="kpi-sub">locations</div>
      </div>
      <div class="kpi k-green">
        <div class="kpi-lbl">Active</div>
        <div class="kpi-val" style="color:var(--green)">{{ points.filter(p => p.active !== false).length }}</div>
        <div class="kpi-sub">in use</div>
      </div>
      <div class="kpi">
        <div class="kpi-lbl">Areas</div>
        <div class="kpi-val">{{ areas.length }}</div>
        <div class="kpi-sub">zones</div>
      </div>
    </div>

    <!-- Area filter -->
    <div class="ps-filters">
      <button class="pill ps-pill" :class="{ active: !filterArea }" @click="filterArea = ''">All</button>
      <button v-for="a in areas" :key="a" class="pill ps-pill" :class="{ active: filterArea === a }" @click="filterArea = filterArea === a ? '' : a">{{ a }}</button>
    </div>

    <div class="card" style="padding:0;overflow:hidden">
      <div class="ps-table-hd">
        <span>Name</span><span>Area / Zone</span><span>Address</span><span>Time Slot</span><span>Status</span><span>Note</span>
      </div>
      <div v-if="!filtered.length" class="ps-empty">ยังไม่มีจุดรับ</div>
      <div v-for="p in filtered" :key="p.id" class="ps-row" :class="{ 'ps-inactive': p.active === false }">
        <span class="ps-name">{{ p.name }}</span>
        <span><span class="pill pill-blue" style="font-size:9px">{{ p.area || '—' }}</span></span>
        <span class="ps-addr">{{ p.address || '—' }}</span>
        <span class="ps-time">{{ p.time || '—' }}</span>
        <span><span class="pill" :class="p.active !== false ? 'pill-green' : 'pill-gray'">{{ p.active !== false ? 'Active' : 'Off' }}</span></span>
        <span class="ps-note">{{ p.note || '' }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useAppStore } from '../../store/app'

const store = useAppStore()
const filterArea = ref('')

const points = computed(() => store.state?.pickup_points || store.state?.pickupPoints || [])
const areas   = computed(() => [...new Set(points.value.map(p => p.area).filter(Boolean))].sort())
const filtered = computed(() => {
  if (!filterArea.value) return points.value
  return points.value.filter(p => p.area === filterArea.value)
})
</script>

<style scoped>
.ps-kpi-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 14px; }
.ps-filters { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
.ps-pill { cursor: pointer; font-size: 10px; font-weight: 500; border: 1px solid var(--border); background: var(--white); color: var(--ink-mid); }
.ps-pill:hover { border-color: var(--ocean-mid); }
.ps-pill.active { background: var(--ocean-50); border-color: var(--ocean-mid); color: var(--ocean); }
.ps-table-hd {
  display: grid; grid-template-columns: 180px 110px 1fr 90px 80px 1fr;
  gap: 8px; padding: 7px 14px;
  background: var(--sand); border-bottom: 1px solid var(--border);
  font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: var(--ink-soft);
}
.ps-row {
  display: grid; grid-template-columns: 180px 110px 1fr 90px 80px 1fr;
  gap: 8px; padding: 9px 14px; align-items: center; font-size: 11px;
  border-bottom: 1px solid var(--border);
}
.ps-row:hover { background: var(--sand); }
.ps-row:last-child { border-bottom: none; }
.ps-inactive { opacity: .55; }
.ps-name { font-weight: 600; }
.ps-addr { color: var(--ink-soft); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ps-time { font-family: 'DM Mono', monospace; font-size: 11px; font-weight: 600; }
.ps-note { color: var(--ink-soft); font-size: 10px; }
.ps-empty { padding: 40px; text-align: center; color: var(--ink-soft); font-size: 12px; }
</style>
