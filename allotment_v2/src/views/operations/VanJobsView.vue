<template>
  <div>
    <div class="page-hd">
      <div>
        <h1>ใบงานรถ (Van Jobs)</h1>
        <p>การจัดรถรับ-ส่งรายวัน</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-ghost btn-sm" @click="prevDay">← ก่อนหน้า</button>
        <button class="btn btn-ghost btn-sm" @click="goToday">วันนี้</button>
        <button class="btn btn-ghost btn-sm" @click="nextDay">ถัดไป →</button>
      </div>
    </div>

    <div class="vj-date-bar">
      <span class="vj-date-lbl">{{ dateLabelFull }}</span>
      <span v-if="dateStr === TODAY" class="pill pill-green">Today</span>
    </div>

    <!-- KPI -->
    <div class="vj-kpi-row">
      <div class="kpi">
        <div class="kpi-lbl">Van Jobs</div>
        <div class="kpi-val">{{ dayJobs.length }}</div>
        <div class="kpi-sub">today</div>
      </div>
      <div class="kpi k-green">
        <div class="kpi-lbl">Assigned</div>
        <div class="kpi-val" style="color:var(--green)">{{ assignedCount }}</div>
        <div class="kpi-sub">van assigned</div>
      </div>
      <div class="kpi k-coral">
        <div class="kpi-lbl">Unassigned</div>
        <div class="kpi-val" style="color:var(--red)">{{ dayJobs.length - assignedCount }}</div>
        <div class="kpi-sub">need assignment</div>
      </div>
      <div class="kpi">
        <div class="kpi-lbl">Pax</div>
        <div class="kpi-val">{{ totalPax }}</div>
        <div class="kpi-sub">to pick up</div>
      </div>
    </div>

    <!-- Jobs grouped by time slot -->
    <div v-if="!dayJobs.length" class="vj-empty card">ไม่มีใบงานวันนี้</div>

    <template v-for="grp in byTime" :key="grp.time">
      <div class="vj-time-hd">
        <span class="vj-time-badge">{{ grp.time }}</span>
        <span style="font-size:11px;color:var(--ink-soft)">{{ grp.items.length }} jobs · {{ grp.pax }} pax</span>
      </div>

      <div class="card vj-card">
        <div class="vj-table-hd">
          <span>Ref / Booking</span>
          <span>Pax</span>
          <span>Pickup</span>
          <span>Route</span>
          <span>Agent</span>
          <span>Van</span>
          <span>Status</span>
        </div>
        <div v-for="j in grp.items" :key="j.id" class="vj-row" :class="{ 'vj-done': j.status === 'done' }">
          <span class="vj-ref">{{ j.ref || j.bookingRef || j.id }}</span>
          <span class="vj-pax">{{ j.pax || '—' }}</span>
          <span class="vj-pickup">{{ j.pickup || j.hotel || '—' }}</span>
          <div class="vj-route">
            <span v-if="getRoute(j.route)" class="vj-dot" :style="{ background: getRoute(j.route).color }"></span>
            {{ getRoute(j.route)?.name || j.route || '—' }}
          </div>
          <span class="vj-agent">{{ j.agent || '—' }}</span>
          <span class="vj-van" :class="{ 'no-van': !j.van }">{{ j.van || '—' }}</span>
          <span>
            <span class="pill" :class="jobStatusPill(j.status)">{{ j.status || 'pending' }}</span>
          </span>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useAppData } from '../../composables/useAppData'
import { useAppStore } from '../../store/app'

const store = useAppStore()
const { getRoute, fmtDate, TODAY } = useAppData()

const dateObj = ref(new Date())
const dateStr = computed(() => dateObj.value.toISOString().slice(0, 10))
const dateLabelFull = computed(() =>
  dateObj.value.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
)
function prevDay() { dateObj.value = new Date(dateObj.value.getTime() - 86400000) }
function nextDay() { dateObj.value = new Date(dateObj.value.getTime() + 86400000) }
function goToday()  { dateObj.value = new Date() }

const vanJobs = computed(() => store.state?.van_jobs || store.state?.vanJobs || [])

const dayJobs = computed(() =>
  vanJobs.value.filter(j => j.date === dateStr.value)
    .sort((a, b) => (a.time || '').localeCompare(b.time || ''))
)

const assignedCount = computed(() => dayJobs.value.filter(j => j.van).length)
const totalPax      = computed(() => dayJobs.value.reduce((s, j) => s + (j.pax || 0), 0))

const byTime = computed(() => {
  const map = {}
  for (const j of dayJobs.value) {
    const t = j.time || 'No Time'
    if (!map[t]) map[t] = { time: t, items: [], pax: 0 }
    map[t].items.push(j)
    map[t].pax += j.pax || 0
  }
  return Object.values(map).sort((a, b) => a.time.localeCompare(b.time))
})

function jobStatusPill(s) {
  if (!s || s === 'pending') return 'pill-amber'
  if (s === 'done')          return 'pill-green'
  if (s === 'cancelled')     return 'pill-red'
  return 'pill-gray'
}
</script>

<style scoped>
.vj-date-bar { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; }
.vj-date-lbl { font-size: 15px; font-weight: 600; }
.vj-kpi-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 16px; }

.vj-time-hd {
  display: flex; align-items: center; gap: 10px;
  margin: 12px 0 6px;
}
.vj-time-badge {
  font-family: 'DM Mono', monospace; font-size: 12px; font-weight: 700;
  background: var(--ink); color: #fff; padding: 3px 10px; border-radius: 4px;
}

.vj-card { padding: 0; overflow: hidden; }
.vj-table-hd {
  display: grid;
  grid-template-columns: 100px 45px 160px 1fr 110px 100px 90px;
  gap: 8px; padding: 7px 14px;
  background: var(--sand); border-bottom: 1px solid var(--border);
  font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: var(--ink-soft);
}
.vj-row {
  display: grid;
  grid-template-columns: 100px 45px 160px 1fr 110px 100px 90px;
  gap: 8px; padding: 9px 14px; align-items: center; font-size: 11px;
  border-bottom: 1px solid var(--border); transition: background .1s;
}
.vj-row:last-child { border-bottom: none; }
.vj-row:hover { background: var(--sand); }
.vj-row.vj-done { opacity: .6; background: #f6fdf9; }

.vj-ref    { font-family: 'DM Mono', monospace; font-size: 10px; font-weight: 600; }
.vj-pax    { font-weight: 700; text-align: center; }
.vj-pickup { font-size: 11px; color: var(--ink-mid); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.vj-route  { display: flex; align-items: center; gap: 5px; font-weight: 500; }
.vj-dot    { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
.vj-agent  { color: var(--ink-soft); }
.vj-van    { font-weight: 600; color: var(--ocean-mid); }
.no-van    { color: var(--red); font-weight: 400; }

.vj-empty { padding: 40px; text-align: center; color: var(--ink-soft); font-size: 12px; }
</style>
