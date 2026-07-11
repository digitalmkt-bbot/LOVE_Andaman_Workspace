<template>
  <div>
    <div class="page-hd">
      <div>
        <h1>Pickup Map</h1>
        <p>แผนที่จุดรับ — จัดกลุ่มตามโซนและเส้นทางรถ</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-ghost btn-sm" @click="prevDay">← ก่อนหน้า</button>
        <button class="btn btn-ghost btn-sm" @click="goToday">วันนี้</button>
        <button class="btn btn-ghost btn-sm" @click="nextDay">ถัดไป →</button>
      </div>
    </div>

    <div class="pm-date-bar">
      <span class="pm-date-lbl">{{ dateLabelFull }}</span>
    </div>

    <div class="pm-kpi-row">
      <div class="kpi">
        <div class="kpi-lbl">Pickups Today</div>
        <div class="kpi-val">{{ dayPickups.length }}</div>
        <div class="kpi-sub">stops</div>
      </div>
      <div class="kpi">
        <div class="kpi-lbl">Total Pax</div>
        <div class="kpi-val">{{ totalPax }}</div>
        <div class="kpi-sub">to collect</div>
      </div>
      <div class="kpi">
        <div class="kpi-lbl">Zones</div>
        <div class="kpi-val">{{ zones.length }}</div>
        <div class="kpi-sub">areas</div>
      </div>
    </div>

    <div v-if="!dayPickups.length" class="pm-empty card">ไม่มี pickup วันนี้</div>

    <template v-for="zone in byZone" :key="zone.name">
      <div class="pm-zone-hd">
        <span class="pm-zone-name">📍 {{ zone.name }}</span>
        <span class="pill pill-blue" style="font-size:9px">{{ zone.items.length }} stops · {{ zone.pax }} pax</span>
      </div>
      <div class="card pm-zone-card">
        <div class="pm-table-hd">
          <span>Time</span><span>Location</span><span>Pax</span><span>Booking Ref</span><span>Route</span><span>Van</span>
        </div>
        <div v-for="p in zone.items" :key="p.id" class="pm-row">
          <span class="pm-time">{{ p.time || '—' }}</span>
          <span class="pm-loc">{{ p.location || p.hotel || '—' }}</span>
          <span class="pm-pax">{{ p.pax || '—' }}</span>
          <span class="pm-ref">{{ p.ref || p.bookingRef || '—' }}</span>
          <div class="pm-route">
            <span v-if="getRoute(p.route)" class="pm-dot" :style="{ background: getRoute(p.route).color }"></span>
            {{ getRoute(p.route)?.name || p.route || '—' }}
          </div>
          <span :class="{ 'pm-no-van': !p.van }">{{ p.van || 'Unassigned' }}</span>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useAppStore } from '../../store/app'
import { useAppData } from '../../composables/useAppData'

const store = useAppStore()
const { getRoute, TODAY } = useAppData()

const dateObj = ref(new Date())
const dateStr = computed(() => dateObj.value.toISOString().slice(0, 10))
const dateLabelFull = computed(() =>
  dateObj.value.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
)
function prevDay() { dateObj.value = new Date(dateObj.value.getTime() - 86400000) }
function nextDay() { dateObj.value = new Date(dateObj.value.getTime() + 86400000) }
function goToday()  { dateObj.value = new Date() }

const allPickups  = computed(() => store.state?.pickups || store.state?.pickup_jobs || [])
const dayPickups  = computed(() => allPickups.value.filter(p => p.date === dateStr.value).sort((a, b) => (a.time || '').localeCompare(b.time || '')))
const totalPax    = computed(() => dayPickups.value.reduce((s, p) => s + (p.pax || 0), 0))
const zones       = computed(() => [...new Set(dayPickups.value.map(p => p.zone || 'Other').filter(Boolean))])

const byZone = computed(() => {
  const map = {}
  for (const p of dayPickups.value) {
    const z = p.zone || 'Other'
    if (!map[z]) map[z] = { name: z, items: [], pax: 0 }
    map[z].items.push(p)
    map[z].pax += p.pax || 0
  }
  return Object.values(map).sort((a, b) => a.name.localeCompare(b.name))
})
</script>

<style scoped>
.pm-date-bar { margin-bottom: 14px; }
.pm-date-lbl { font-size: 15px; font-weight: 600; }
.pm-kpi-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 14px; }
.pm-zone-hd { display: flex; align-items: center; gap: 10px; margin: 14px 0 6px; }
.pm-zone-name { font-size: 13px; font-weight: 700; }
.pm-zone-card { padding: 0; overflow: hidden; }
.pm-table-hd {
  display: grid; grid-template-columns: 70px 1fr 50px 100px 1fr 110px;
  gap: 8px; padding: 7px 14px;
  background: var(--sand); border-bottom: 1px solid var(--border);
  font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: var(--ink-soft);
}
.pm-row {
  display: grid; grid-template-columns: 70px 1fr 50px 100px 1fr 110px;
  gap: 8px; padding: 8px 14px; align-items: center; font-size: 11px;
  border-bottom: 1px solid var(--border);
}
.pm-row:hover { background: var(--sand); }
.pm-row:last-child { border-bottom: none; }
.pm-time { font-family: 'DM Mono', monospace; font-weight: 700; }
.pm-loc  { font-weight: 500; }
.pm-pax  { font-weight: 700; text-align: center; }
.pm-ref  { font-family: 'DM Mono', monospace; font-size: 10px; color: var(--ink-soft); }
.pm-route { display: flex; align-items: center; gap: 5px; }
.pm-dot   { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
.pm-no-van { color: var(--red); font-weight: 500; }
.pm-empty { padding: 40px; text-align: center; color: var(--ink-soft); font-size: 12px; }
</style>
