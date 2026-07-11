<template>
  <div>
    <div class="page-hd">
      <div>
        <h1>Daily Report</h1>
        <p>รายงานประจำวันของกองเรือ</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-ghost btn-sm" @click="prevDay">← ก่อนหน้า</button>
        <button class="btn btn-ghost btn-sm" @click="goToday">วันนี้</button>
        <button class="btn btn-ghost btn-sm" @click="nextDay">ถัดไป →</button>
      </div>
    </div>

    <div class="dr-date-bar">
      <span class="dr-date-lbl">{{ dateLabelFull }}</span>
      <span v-if="dateStr === TODAY" class="pill pill-green">Today</span>
    </div>

    <div class="dr-kpi-row">
      <div class="kpi k-green">
        <div class="kpi-lbl">Departures</div>
        <div class="kpi-val" style="color:var(--green)">{{ opRows.length }}</div>
        <div class="kpi-sub">trips</div>
      </div>
      <div class="kpi k-ocean">
        <div class="kpi-lbl">Total Pax</div>
        <div class="kpi-val" style="color:var(--ocean-mid)">{{ totalBooked }}</div>
        <div class="kpi-sub">/ {{ totalSeats }} seats · {{ fillPct }}%</div>
      </div>
      <div class="kpi">
        <div class="kpi-lbl">Reports Filed</div>
        <div class="kpi-val">{{ reports.length }}</div>
        <div class="kpi-sub">/ {{ opRows.length }} trips</div>
      </div>
      <div class="kpi k-coral">
        <div class="kpi-lbl">Issues</div>
        <div class="kpi-val" style="color:var(--red)">{{ issueCount }}</div>
        <div class="kpi-sub">flagged today</div>
      </div>
    </div>

    <!-- Trip report cards -->
    <div v-if="!opRows.length" class="dr-empty card">ไม่มีเที่ยวออกวันนี้</div>

    <div class="dr-grid">
      <div v-for="row in opRows" :key="row.bid" class="dr-card card">
        <div class="dr-card-top">
          <div class="dr-boat-name">{{ row.boatName }}</div>
          <span class="pill" :class="row.report ? 'pill-green' : 'pill-amber'">{{ row.report ? 'Filed' : 'Pending' }}</span>
        </div>
        <div class="dr-route" :style="{ color: row.routeColor }">{{ row.routeName }}</div>
        <div class="dr-stats">
          <span>{{ row.booked }} / {{ row.cap }} pax</span>
          <span class="pill" :class="row.type === 'early' ? 'pill-amber' : 'pill-blue'" style="font-size:9px">{{ row.type }}</span>
        </div>
        <template v-if="row.report">
          <div class="dr-field"><span class="dr-lbl">Dep.</span> {{ row.report.depTime || '—' }}</div>
          <div class="dr-field"><span class="dr-lbl">Arr.</span> {{ row.report.arrTime || '—' }}</div>
          <div v-if="row.report.note" class="dr-note">{{ row.report.note }}</div>
          <div v-if="row.report.issue" class="dr-issue">⚠ {{ row.report.issue }}</div>
        </template>
        <div v-else class="dr-no-report">ยังไม่มีรายงาน</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useAppStore } from '../../store/app'
import { useAppData } from '../../composables/useAppData'

const store = useAppStore()
const { trips, boats, getRoute, getBoat, TODAY } = useAppData()

const dateObj = ref(new Date())
const dateStr = computed(() => dateObj.value.toISOString().slice(0, 10))
const dateLabelFull = computed(() =>
  dateObj.value.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
)
function prevDay() { dateObj.value = new Date(dateObj.value.getTime() - 86400000) }
function nextDay() { dateObj.value = new Date(dateObj.value.getTime() + 86400000) }
function goToday()  { dateObj.value = new Date() }

const dayOps = computed(() => trips.value[dateStr.value] || {})
const dailyReports = computed(() => store.state?.daily_reports || {})

const opRows = computed(() =>
  Object.entries(dayOps.value)
    .filter(([, op]) => !Array.isArray(op))
    .map(([bid, op]) => {
      const b = getBoat(bid) || { id: bid, name: bid, cap: 0 }
      const r = getRoute(op.route)
      const reportKey = `${dateStr.value}__${bid}`
      return {
        bid, boatName: b.name, cap: b.cap || 0,
        routeName: r?.name || op.route || '—', routeColor: r?.color || '#aaa',
        type: op.type, booked: op.booked || 0,
        report: dailyReports.value[reportKey] || null,
      }
    })
)

const totalSeats  = computed(() => opRows.value.reduce((s, r) => s + r.cap, 0))
const totalBooked = computed(() => opRows.value.reduce((s, r) => s + r.booked, 0))
const fillPct     = computed(() => totalSeats.value > 0 ? Math.round(totalBooked.value / totalSeats.value * 100) : 0)
const reports     = computed(() => opRows.value.filter(r => r.report))
const issueCount  = computed(() => opRows.value.filter(r => r.report?.issue).length)
</script>

<style scoped>
.dr-date-bar { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; }
.dr-date-lbl { font-size: 15px; font-weight: 600; }
.dr-kpi-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 16px; }
.dr-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; }
.dr-card { padding: 14px; display: flex; flex-direction: column; gap: 8px; }
.dr-card-top { display: flex; align-items: center; justify-content: space-between; }
.dr-boat-name { font-size: 13px; font-weight: 700; }
.dr-route { font-size: 12px; font-weight: 600; }
.dr-stats { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--ink-mid); }
.dr-field { font-size: 11px; }
.dr-lbl { font-size: 9px; font-weight: 700; text-transform: uppercase; color: var(--ink-soft); margin-right: 4px; }
.dr-note { font-size: 10px; color: var(--ink-soft); }
.dr-issue { font-size: 11px; font-weight: 600; color: var(--red); background: #fff5f5; padding: 4px 8px; border-radius: var(--r-sm); }
.dr-no-report { font-size: 10px; color: var(--ink-soft); font-style: italic; }
.dr-empty { padding: 40px; text-align: center; color: var(--ink-soft); font-size: 12px; }
</style>
