<template>
  <div>
    <!-- ── Toolbar ── -->
    <div class="cv-toolbar">
      <button class="cal-nav" @click="prevMonth">‹</button>
      <button class="cal-nav" @click="nextMonth">›</button>
      <span class="cv-month-lbl">{{ monthLabel }}</span>
      <div class="filter-pills" style="margin-left:8px">
        <button class="fp" :class="{ on: pierFilter === '' }" @click="pierFilter = ''">All</button>
        <button class="fp" :class="{ on: pierFilter === 'tublamu' }" @click="pierFilter = pierFilter === 'tublamu' ? '' : 'tublamu'">Tub Lamu</button>
        <button class="fp" :class="{ on: pierFilter === 'panwa' }" @click="pierFilter = pierFilter === 'panwa' ? '' : 'panwa'">Visit Panwa</button>
      </div>
      <div class="cv-view-btns">
        <button class="cv-vbtn" :class="{ active: viewMode === 'month' }" @click="viewMode = 'month'">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
          Month
        </button>
        <button class="cv-vbtn" :class="{ active: viewMode === 'matrix' }" @click="viewMode = 'matrix'">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
          Matrix
        </button>
      </div>
      <div class="cv-pier-chips">
        <span class="cv-pier-chip" style="background:rgba(15,110,86,.15);color:#0F6E56">TL {{ tlTodayFree }}</span>
        <span class="cv-pier-chip" style="background:rgba(24,95,165,.15);color:#185FA5">VP {{ vpTodayFree }}</span>
      </div>
    </div>

    <!-- ── Summary cards row ── -->
    <div class="cv-sum-row">
      <!-- Month summary dark card -->
      <div class="cv-sum-card cv-sum-dark">
        <div class="cv-sd-month">{{ monthLabelShort }}</div>
        <div class="cv-sd-trips">{{ monthTrips }} <span class="cv-sd-trips-lbl">trips</span></div>
        <div class="cv-sd-free">{{ monthFreeTotal.toLocaleString() }} seats free · avg {{ monthFreeWeekAvg }}/week</div>
      </div>

      <!-- Tub Lamu card -->
      <div class="cv-sum-card">
        <div class="cv-sc-hd">
          <span class="cv-sc-pier-lbl">Tub Lamu</span>
          <span class="cv-sc-badge" :class="tlTodayBoats > 0 ? 'green' : 'gray'">ready today</span>
        </div>
        <div class="cv-sc-boats">{{ tlTodayBoats }} / {{ tlTotalBoatsCount }} boats</div>
        <div v-if="!tlTodayBoats" class="cv-sc-note">no ready boats</div>
        <div class="cv-sc-status" :class="tlOpenDays > 0 ? 'open' : 'closed'">
          {{ tlOpenDays > 0 ? 'Open' : 'Closed' }} {{ tlOpenDays > 0 ? tlOpenDays : totalDays }}/{{ totalDays }}d
        </div>
      </div>

      <!-- Visit Panwa card -->
      <div class="cv-sum-card cv-sum-panwa">
        <div class="cv-sc-hd">
          <span class="cv-sc-pier-lbl">Visit Panwa</span>
          <span class="cv-sc-badge" :class="vpTodayBoats > 0 ? 'green' : 'gray'">ready today</span>
        </div>
        <div class="cv-sc-boats">{{ vpTodayBoats }} / {{ vpTotalBoatsCount }} boats</div>
        <div class="cv-sc-boat-list">
          <span v-for="b in vpTodayBoatList.slice(0, 5)" :key="b.id" class="cv-boat-chip">{{ b.name }}</span>
          <span v-if="vpTodayBoatList.length > 5" class="cv-boat-chip">+{{ vpTodayBoatList.length - 5 }} more</span>
        </div>
        <div class="cv-sc-status" :class="vpOpenDays > 0 ? 'open' : 'closed'">
          {{ vpOpenDays > 0 ? 'Open' : 'Closed' }} {{ vpOpenDays }}/{{ totalDays }}d
        </div>
      </div>

      <!-- Today card -->
      <div class="cv-sum-card">
        <div class="cv-sc-hd"><span class="cv-sc-pier-lbl">Today</span></div>
        <div class="cv-sd-trips" style="font-size:28px">{{ todayFreeTotal }} <span class="cv-sd-trips-lbl">free</span></div>
        <div class="cv-sc-note">{{ todayTripCount }} trips today</div>
      </div>
    </div>

    <!-- ── Avg seats per route ── -->
    <div class="cv-ra-section">
      <div class="cv-ra-hd">
        <span class="cv-ra-title">AVG SEATS FREE · PER ROUTE</span>
        <span class="cv-ra-hint">Counts only days/weeks the route actually ran</span>
        <div class="cv-ra-toggle">
          <button class="cv-rt-btn" :class="{ active: avgMode === 'week' }" @click="avgMode = 'week'">Weekly</button>
          <button class="cv-rt-btn" :class="{ active: avgMode === 'day' }" @click="avgMode = 'day'">Daily</button>
          <button class="cv-rt-btn" :class="{ active: avgMode === 'total' }" @click="avgMode = 'total'">Total</button>
        </div>
      </div>
      <div class="cv-ra-grid">
        <div v-for="r in routeStats" :key="r.id" class="cv-ra-card"
          :class="{ 'cv-ra-active': r.daysRan > 0 }"
          :style="r.daysRan > 0 ? raCardStyle(r.color) : {}">
          <div class="cv-ra-card-hd">
            <div class="cv-ra-dot" :style="{ background: r.color }"></div>
            <span class="cv-ra-rname">{{ r.name }}</span>
            <span class="cv-ra-pier-tag">{{ r.pier === 'tublamu' ? 'TL' : 'VP' }}</span>
          </div>
          <template v-if="r.daysRan > 0">
            <div class="cv-ra-val" :style="{ color: r.color }">
              {{ avgMode === 'week' ? r.avgFreeWeek : avgMode === 'day' ? r.avgFreeDay : r.totalFree }}
            </div>
            <div class="cv-ra-sub">
              {{ avgMode === 'week' ? `${r.tripsPerWeek} trips/week` : avgMode === 'day' ? `${r.daysRan} days ran` : `total free` }}
            </div>
          </template>
          <div v-else class="cv-ra-empty">
            {{ r.closedAllMonth ? 'Closed all month' : 'No trips' }}
          </div>
        </div>
      </div>
    </div>

    <!-- ── Main content ── -->
    <div class="cv-content" :class="{ 'cv-content-mx': viewMode === 'matrix' && !selectedDs }">

      <!-- ── MONTH calendar grid ── -->
      <template v-if="viewMode === 'month'">
        <div class="cv-cal-wrap">
          <div class="cv-dow-row">
            <div v-for="d in ['SUN','MON','TUE','WED','THU','FRI','SAT']" :key="d" class="cv-dow">{{ d }}</div>
          </div>
          <div class="cv-cal-grid">
            <div v-for="n in leadingBlanks" :key="`b${n}`" class="cv-cell cv-blank"></div>
            <div
              v-for="day in calDays" :key="day.ds"
              class="cv-cell"
              :class="{ 'cv-cell-today': day.ds === TODAY, 'cv-cell-sel': selectedDs === day.ds }"
              @click="selectedDs = selectedDs === day.ds ? null : day.ds"
            >
              <div class="cv-cell-hd">
                <span class="cv-dn">{{ day.n }}</span>
                <span v-if="day.ds === TODAY" class="cv-today-tag">TODAY</span>
              </div>
              <div v-if="showTL && isPierClosed('tublamu', day.ds)" class="cv-chip cv-chip-closed">Closed TL</div>
              <div v-for="op in day.ops.slice(0, 4)" :key="op.boatId" class="cv-chip" :style="chipStyle(op)">
                <span class="cv-chip-name">{{ abbr(op.routeName) }}</span>
                <span class="cv-chip-val" :style="op.free <= 0 ? { color: 'var(--red)', fontWeight: 700 } : {}">{{ op.free <= 0 ? '×' : op.free }}</span>
              </div>
              <div v-if="day.ops.length > 4" class="cv-chip-more">+{{ day.ops.length - 4 }} more</div>
            </div>
          </div>
        </div>
      </template>

      <!-- ── MATRIX view ── -->
      <template v-else>
        <div class="cv-mx-wrap card" style="padding:0;overflow:hidden">
          <div class="cv-mx-info">
            {{ mxRoutes.length }} routes × {{ totalDays }} days · numbers = free seats of that day · click cell to select day · hover row to hide
            <span class="cv-mx-legend">
              <span class="cv-mx-leg"><span class="cv-mx-leg-dot" style="background:var(--red)"></span>Full</span>
              <span class="cv-mx-leg"><span class="cv-mx-leg-dot" style="background:var(--coral)"></span>Selling</span>
              <span class="cv-mx-leg"><span class="cv-mx-leg-dot" style="background:var(--amber)"></span>Medium</span>
              <span class="cv-mx-leg"><span class="cv-mx-leg-dot" style="background:#aac8e4"></span>Under-sold</span>
              <span class="cv-mx-leg"><span class="cv-mx-leg-dot" style="background:var(--green)"></span>Many free</span>
              <span class="cv-mx-leg"><span class="cv-mx-leg-dot" style="background:var(--sand-dark)"></span>Closed</span>
              <span class="cv-mx-leg">No trips</span>
            </span>
          </div>
          <div class="cv-mx-scroll">
            <table class="cv-mx-table">
              <thead>
                <tr>
                  <th class="cv-mx-th-route">ROUTE</th>
                  <th v-for="d in mxDays" :key="d.ds" class="cv-mx-th-day" :class="{ 'cv-mx-today-col': d.ds === TODAY, 'cv-mx-wkend': d.isWkend }">
                    {{ d.n }}<div class="cv-mx-dow">{{ d.dow }}</div>
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="r in mxRoutes" :key="r.id" class="cv-mx-row">
                  <td class="cv-mx-td-route">
                    <div class="cv-mx-r-dot" :style="{ background: r.color }"></div>
                    <div>
                      <div class="cv-mx-rname">{{ r.name }}</div>
                      <div class="cv-mx-rmeta">
                        {{ r.id }} · {{ r.pier === 'tublamu' ? 'TL' : 'VP' }} ·
                        <template v-if="r.tripsCount > 0">{{ r.tripsCount }}t · {{ r.totalFree }} free</template>
                        <template v-else>no trips this month</template>
                      </div>
                    </div>
                  </td>
                  <td v-for="d in mxDays" :key="d.ds"
                    class="cv-mx-cell"
                    :class="['cv-mx-' + mxFillClass(r.id, d.ds), { 'cv-mx-today-col': d.ds === TODAY, 'cv-mx-sel-col': selectedDs === d.ds }]"
                    @click="selectedDs = d.ds"
                  >
                    <span class="cv-mx-val">{{ mxCellVal(r.id, d.ds) }}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </template>

      <!-- ── Selected day panel (shared) ── -->
      <div v-if="selectedDs" class="cv-detail card">
        <div class="cv-dp-tag">SELECTED DAY</div>
        <div class="cv-dp-date">
          {{ selectedDateLabel }}
          <span v-if="selectedDs === TODAY" class="pill pill-green" style="font-size:9px;margin-left:6px">Today</span>
        </div>

        <!-- Week context -->
        <div class="cv-dp-week-box">
          <div class="cv-dp-week-hd">This week ({{ weekDateRange }})</div>
          <div class="cv-dp-week-stats">
            <span class="cv-dp-week-sub">Avg {{ weekAvgFree }} free/day · {{ weekTripCount }} trips</span>
            <div class="cv-dp-week-total"><span class="cv-dp-wt-num">{{ weekTotalFree }}</span><span class="cv-dp-wt-lbl">Week total</span></div>
          </div>
        </div>

        <!-- Per-pier breakdown -->
        <div v-for="pier in ['tublamu', 'panwa']" :key="pier" class="cv-dp-pier">
          <div class="cv-dp-pier-hd">
            <span class="cv-dp-pier-dot" :style="{ background: pier === 'tublamu' ? '#0F6E56' : '#185FA5' }">{{ pier === 'tublamu' ? 'TL' : 'VP' }}</span>
            <span class="cv-dp-pier-name">{{ pier === 'tublamu' ? 'Tub Lamu Pier' : 'Visit Panwa Pier' }}</span>
            <span class="cv-dp-pier-meta">{{ pierDaySummary(pier) }}</span>
          </div>

          <div v-if="isPierClosed(pier, selectedDs)" class="cv-dp-pier-closed">
            Closed · Program
          </div>

          <template v-else>
            <div v-for="rg in pierDayRoutes(pier)" :key="rg.routeId" class="cv-dp-route-grp">
              <div class="cv-dp-rg-hd">
                <span class="cv-dp-rg-dot" :style="{ background: rg.color }"></span>
                <span class="cv-dp-rg-name">{{ rg.routeName }}</span>
                <span class="cv-dp-rg-meta">{{ rg.boatCount }} boats · {{ rg.time }}</span>
                <span class="cv-dp-rg-free" :style="{ color: rg.free <= 5 ? 'var(--red)' : 'var(--green-dark)' }">
                  {{ rg.free }}<small style="font-size:9px;font-weight:400">/{{ rg.allot }} free</small>
                </span>
              </div>
              <div v-for="b in rg.boats" :key="b.id" class="cv-dp-boat-row">
                <span class="cv-dp-boat-name">{{ b.name }}</span>
                <span class="cv-dp-boat-time">{{ b.time }}</span>
                <span class="cv-dp-boat-free" :class="b.free <= 0 ? 'full' : ''">
                  {{ b.free <= 0 ? '×' : b.free }}<template v-if="b.free > 0"><small>/{{ b.cap }}</small></template>
                </span>
              </div>
              <div v-if="rg.avgFree" class="cv-dp-route-avg">
                Route avg: <strong>{{ rg.avgFree }} free/day</strong>
                <span :style="{ color: rg.vsAvg < -30 ? 'var(--red)' : rg.vsAvg > 0 ? 'var(--green)' : 'var(--ink-soft)' }">
                  {{ rg.vsAvg > 0 ? '+ ' : '' }}{{ rg.vsAvg }}% vs avg
                </span>
              </div>
            </div>
          </template>
        </div>
      </div>

      <!-- No-selection placeholder -->
      <div v-else class="cv-detail cv-detail-empty card">
        <div style="color:var(--ink-soft);font-size:12px">Click a day to see details</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useAppData } from '../../composables/useAppData'

const { routes, boats, trips, getDayStatus, getBoat, getRoute, TODAY } = useAppData()

// ── Navigation ────────────────────────────────────────────────────────────────
const cursor = ref(new Date(TODAY + 'T12:00:00'))
function prevMonth() { cursor.value = new Date(cursor.value.getFullYear(), cursor.value.getMonth() - 1, 1) }
function nextMonth() { cursor.value = new Date(cursor.value.getFullYear(), cursor.value.getMonth() + 1, 1) }

const Y = computed(() => cursor.value.getFullYear())
const Mo = computed(() => cursor.value.getMonth())

const monthLabel      = computed(() => cursor.value.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }))
const monthLabelShort = computed(() => cursor.value.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }).toUpperCase())
const totalDays       = computed(() => new Date(Y.value, Mo.value + 1, 0).getDate())

function mkDs(n) {
  return `${Y.value}-${String(Mo.value + 1).padStart(2, '0')}-${String(n).padStart(2, '0')}`
}

const allDs = computed(() => Array.from({ length: totalDays.value }, (_, i) => mkDs(i + 1)))

// ── Filters / view state ──────────────────────────────────────────────────────
const pierFilter = ref('')
const viewMode   = ref('month')
const avgMode    = ref('week')
const selectedDs = ref(TODAY)

const showTL = computed(() => pierFilter.value === '' || pierFilter.value === 'tublamu')
const showVP = computed(() => pierFilter.value === '' || pierFilter.value === 'panwa')

// ── Calendar day data ─────────────────────────────────────────────────────────
const leadingBlanks = computed(() => new Date(Y.value, Mo.value, 1).getDay())

const calDays = computed(() => allDs.value.map(dateStr => {
  const dayOps = trips.value[dateStr] || {}
  const ops = Object.entries(dayOps).flatMap(([bid, op]) => {
    if (Array.isArray(op)) return []
    const b = getBoat(bid); if (!b) return []
    const r = getRoute(op.route); if (!r) return []
    if (pierFilter.value && r.pier !== pierFilter.value) return []
    const cap = b.cap || 0
    return [{ boatId: bid, routeId: op.route, routeName: r.name, boatName: b.name,
              pier: r.pier, cap, booked: op.booked || 0, free: cap - (op.booked || 0),
              time: r.times?.[0] || '', color: r.color }]
  }).sort((a, b) => a.pier.localeCompare(b.pier) || a.routeName.localeCompare(b.routeName))
  return { n: parseInt(dateStr.slice(-2)), ds: dateStr, ops }
}))

// ── Month-level stats ─────────────────────────────────────────────────────────
const monthTrips     = computed(() => calDays.value.reduce((s, d) => s + d.ops.length, 0))
const monthFreeTotal = computed(() => calDays.value.reduce((s, d) => s + d.ops.reduce((ss, o) => ss + o.free, 0), 0))
const monthFreeWeekAvg = computed(() => Math.round(monthFreeTotal.value / (totalDays.value / 7)))

// ── Pier summaries ────────────────────────────────────────────────────────────
function boatsTodayOnPier(pier) {
  const ops = trips.value[TODAY] || {}
  return Object.entries(ops).flatMap(([bid, op]) => {
    if (Array.isArray(op)) return []
    const r = getRoute(op.route); if (r?.pier !== pier) return []
    const b = getBoat(bid); if (!b) return []
    return [b]
  })
}
const tlTodayBoatList   = computed(() => boatsTodayOnPier('tublamu'))
const vpTodayBoatList   = computed(() => boatsTodayOnPier('panwa'))
const tlTodayBoats      = computed(() => tlTodayBoatList.value.length)
const vpTodayBoats      = computed(() => vpTodayBoatList.value.length)
const tlTotalBoatsCount = computed(() => boats.value.length)
const vpTotalBoatsCount = computed(() => boats.value.length)

function pierOpenDaysCount(pier) {
  return allDs.value.filter(ds => {
    const ops = trips.value[ds] || {}
    return Object.entries(ops).some(([bid, op]) => !Array.isArray(op) && getRoute(op.route)?.pier === pier)
  }).length
}
const tlOpenDays = computed(() => pierOpenDaysCount('tublamu'))
const vpOpenDays = computed(() => pierOpenDaysCount('panwa'))

function pierFreeToday(pier) {
  const ops = trips.value[TODAY] || {}
  return Object.entries(ops).reduce((s, [bid, op]) => {
    if (Array.isArray(op)) return s
    const r = getRoute(op.route); if (r?.pier !== pier) return s
    const b = getBoat(bid); if (!b) return s
    return s + (b.cap || 0) - (op.booked || 0)
  }, 0)
}
const tlTodayFree   = computed(() => pierFreeToday('tublamu'))
const vpTodayFree   = computed(() => pierFreeToday('panwa'))
const todayFreeTotal = computed(() => tlTodayFree.value + vpTodayFree.value)
const todayTripCount = computed(() => {
  const ops = trips.value[TODAY] || {}
  return Object.values(ops).filter(op => !Array.isArray(op)).length
})

// ── Route stats ───────────────────────────────────────────────────────────────
const routeStats = computed(() => routes.value.map(r => {
  let totalFree = 0, daysRan = 0, tripsCount = 0
  for (const ds of allDs.value) {
    let dayFree = 0, dayTrips = 0
    for (const [bid, op] of Object.entries(trips.value[ds] || {})) {
      if (Array.isArray(op) || op.route !== r.id) continue
      const b = getBoat(bid); if (!b) continue
      dayFree  += (b.cap || 0) - (op.booked || 0)
      dayTrips++
    }
    if (dayTrips > 0) { daysRan++; totalFree += dayFree; tripsCount += dayTrips }
  }
  const weeks = totalDays.value / 7
  const closedAllMonth = allDs.value.every(ds => {
    const st = getDayStatus(r, ds)
    return !st || st.type === 'closed'
  })
  return {
    id: r.id, name: r.name, pier: r.pier, color: r.color,
    daysRan, totalFree, tripsCount, closedAllMonth,
    avgFreeDay:   daysRan > 0 ? Math.round(totalFree / daysRan) : 0,
    avgFreeWeek:  daysRan > 0 ? Math.round(totalFree / (weeks || 1)) : 0,
    tripsPerWeek: weeks > 0 ? (tripsCount / weeks).toFixed(1) : 0,
  }
}))

// ── Day cell helpers ──────────────────────────────────────────────────────────
function isPierClosed(pier, dateStr) {
  // Show "Closed [pier]" when the pier has routes defined but zero operations on this day
  const pierRoutes = routes.value.filter(r => r.pier === pier)
  if (!pierRoutes.length) return false
  return !Object.entries(trips.value[dateStr] || {}).some(([bid, op]) => {
    if (Array.isArray(op)) return false
    return getRoute(op.route)?.pier === pier
  })
}

function raCardStyle(color) {
  const [r, g, b] = hexToRgb(color)
  return {
    background: `rgba(${r},${g},${b},0.08)`,
    borderColor: `rgba(${r},${g},${b},0.35)`,
  }
}

function hexToRgb(hex) {
  const h = (hex || '#888888').replace('#', '')
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h
  return [parseInt(full.slice(0,2),16), parseInt(full.slice(2,4),16), parseInt(full.slice(4,6),16)]
}

// ── Matrix helpers ────────────────────────────────────────────────────────────
const mxRoutes = computed(() =>
  routeStats.value.filter(r => !pierFilter.value || r.pier === pierFilter.value)
)

const mxDays = computed(() => allDs.value.map(ds => {
  const d = new Date(ds + 'T12:00')
  const dow = d.getDay()
  return {
    ds,
    n: parseInt(ds.slice(-2)),
    dow: ['S','M','T','W','T','F','S'][dow],
    isWkend: dow === 0 || dow === 6,
  }
}))

function mxRouteDay(routeId, dateStr) {
  let free = null, cap = 0, type = null
  for (const [bid, op] of Object.entries(trips.value[dateStr] || {})) {
    if (Array.isArray(op) || op.route !== routeId) continue
    const b = getBoat(bid); if (!b) return null
    free = (free || 0) + (b.cap || 0) - (op.booked || 0)
    cap += b.cap || 0
    if (!type) type = op.type
  }
  return free !== null ? { free, cap, type } : null
}

function mxCellVal(routeId, dateStr) {
  const d = mxRouteDay(routeId, dateStr)
  if (!d) return '×'
  if (d.free <= 0) return '×'
  if (d.type === 'early') return '↑'
  return d.free
}

function mxFillClass(routeId, dateStr) {
  const d = mxRouteDay(routeId, dateStr)
  if (!d) return 'none'
  if (d.free <= 0) return 'full'
  const pct = d.cap > 0 ? (d.cap - d.free) / d.cap * 100 : 0
  if (pct >= 95) return 'full'
  if (pct >= 75) return 'selling'
  if (pct >= 50) return 'medium'
  if (pct >= 20) return 'undersold'
  return 'many'
}

function chipStyle(op) {
  const [r, g, b] = hexToRgb(op.color)
  return {
    borderLeft: `2px solid ${op.color || '#888'}`,
    background: `rgba(${r},${g},${b},0.12)`,
    color: 'var(--ink)',
  }
}

function abbr(name) {
  if (!name) return '—'
  return name
    .replace('Phi Phi Bamboo by Speedboat', 'Phi Phi Spd')
    .replace(/Whale Shark.*/, 'Whale Shark')
    .replace('by Speedboat', 'Spd')
    .replace('by Catamaran', 'Cat')
    .replace('Ext.', 'E.')
    .split(' ').slice(0, 3).join(' ')
}

// ── Selected day detail ───────────────────────────────────────────────────────
const selectedDateLabel = computed(() => {
  if (!selectedDs.value) return ''
  return new Date(selectedDs.value + 'T12:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
})

function pierDaySummary(pier) {
  if (!selectedDs.value) return ''
  const ops = (calDays.value.find(d => d.ds === selectedDs.value)?.ops || []).filter(o => o.pier === pier)
  if (!ops.length) return 'Pier closed'
  const free = ops.reduce((s, o) => s + o.free, 0)
  return `${ops.length} trips · ${free} free`
}

function pierDayRoutes(pier) {
  if (!selectedDs.value) return []
  const ops = (calDays.value.find(d => d.ds === selectedDs.value)?.ops || []).filter(o => o.pier === pier)
  const map = {}
  for (const op of ops) {
    if (!map[op.routeId]) {
      const rs = routeStats.value.find(r => r.id === op.routeId)
      map[op.routeId] = {
        routeId: op.routeId, routeName: op.routeName, color: op.color,
        boatCount: 0, time: op.time, free: 0, allot: 0, boats: [],
        avgFree: rs?.avgFreeDay || 0,
      }
    }
    const grp = map[op.routeId]
    grp.boatCount++; grp.free += op.free; grp.allot += op.cap
    grp.boats.push({ id: op.boatId, name: op.boatName, time: op.time, free: op.free, cap: op.cap })
  }
  return Object.values(map).map(g => ({
    ...g,
    vsAvg: g.avgFree > 0 ? Math.round((g.free - g.avgFree) / g.avgFree * 100) : 0,
  }))
}

// Week context
const weekDates = computed(() => {
  if (!selectedDs.value) return []
  const d = new Date(selectedDs.value + 'T12:00'), dow = d.getDay()
  return Array.from({ length: 7 }, (_, i) => {
    const dd = new Date(d); dd.setDate(d.getDate() - dow + i)
    return dd.toISOString().slice(0, 10)
  })
})

const weekDateRange = computed(() => {
  if (!weekDates.value.length) return ''
  const [first, last] = [new Date(weekDates.value[0] + 'T12:00'), new Date(weekDates.value[6] + 'T12:00')]
  return `${first.getDate()}–${last.getDate()} ${first.toLocaleDateString('en-US', { month: 'short' })}`
})

const weekTripCount = computed(() => weekDates.value.reduce((s, ds) => {
  return s + Object.values(trips.value[ds] || {}).filter(op => !Array.isArray(op)).length
}, 0))

const weekTotalFree = computed(() => weekDates.value.reduce((s, ds) => {
  return s + Object.entries(trips.value[ds] || {}).reduce((ss, [bid, op]) => {
    if (Array.isArray(op)) return ss
    const b = getBoat(bid); if (!b) return ss
    return ss + (b.cap || 0) - (op.booked || 0)
  }, 0)
}, 0))

const weekAvgFree = computed(() => weekTripCount.value > 0 ? Math.round(weekTotalFree.value / weekTripCount.value) : 0)
</script>

<style scoped>
/* ── Toolbar ── */
.cv-toolbar {
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
  margin-bottom: 14px;
}
.cv-month-lbl { font-size: 16px; font-weight: 700; min-width: 140px; }
.cv-view-btns { display: flex; gap: 0; border: 1px solid var(--border); border-radius: var(--r-sm); overflow: hidden; margin-left: 4px; }
.cv-vbtn {
  padding: 5px 10px; font-size: 11px; font-family: 'DM Sans', sans-serif;
  display: flex; align-items: center; gap: 4px;
  border: none; background: var(--white); color: var(--ink-soft); cursor: pointer;
}
.cv-vbtn.active { background: var(--green); color: #fff; font-weight: 600; }
.cv-vbtn:not(.active):hover { background: var(--sand); }
.cv-pier-chips { display: flex; gap: 5px; margin-left: auto; }
.cv-pier-chip { padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; }

/* ── Summary cards ── */
.cv-sum-row { display: grid; grid-template-columns: 220px 1fr 1fr 140px; gap: 10px; margin-bottom: 12px; }
.cv-sum-card { background: var(--white); border: 1px solid var(--border); border-radius: var(--r); padding: 12px 14px; box-shadow: var(--shadow); }
.cv-sum-dark { background: #1a3a2a; border-color: transparent; color: #fff; }
.cv-sum-panwa { background: #eef5ff; border-color: rgba(24,95,165,.15); }

.cv-sd-month { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: rgba(255,255,255,.5); margin-bottom: 4px; }
.cv-sd-trips { font-size: 36px; font-weight: 700; line-height: 1; color: #fff; }
.cv-sd-trips-lbl { font-size: 13px; font-weight: 400; color: rgba(255,255,255,.5); }
.cv-sd-free { font-size: 10px; color: rgba(255,255,255,.5); margin-top: 6px; }

.cv-sc-hd { display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; }
.cv-sc-pier-lbl { font-size: 13px; font-weight: 600; color: var(--ink); }
.cv-sc-badge { font-size: 8px; font-weight: 700; padding: 2px 6px; border-radius: 10px; text-transform: uppercase; letter-spacing: .04em; }
.cv-sc-badge.green { background: var(--green-light); color: var(--green-dark); }
.cv-sc-badge.gray  { background: var(--sand-dark); color: var(--ink-soft); }
.cv-sc-boats { font-size: 18px; font-weight: 700; color: var(--ink); margin-bottom: 4px; }
.cv-sc-note  { font-size: 10px; color: var(--ink-soft); margin-bottom: 4px; }
.cv-sc-boat-list { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 6px; }
.cv-boat-chip { font-size: 9px; font-weight: 600; padding: 2px 6px; border-radius: 4px; background: var(--ocean-50); color: var(--ocean); border: 1px solid var(--ocean-light); }
.cv-sc-status { font-size: 11px; font-weight: 600; margin-top: 2px; }
.cv-sc-status.open   { color: var(--green-dark); }
.cv-sc-status.closed { color: var(--red); }

/* ── Route averages ── */
.cv-ra-section { background: var(--white); border: 1px solid var(--border); border-radius: var(--r); padding: 10px 14px; margin-bottom: 12px; box-shadow: var(--shadow); }
.cv-ra-hd { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
.cv-ra-title { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: var(--ink-soft); }
.cv-ra-hint { font-size: 9px; color: var(--ink-soft); }
.cv-ra-toggle { display: flex; gap: 0; margin-left: auto; border: 1px solid var(--border); border-radius: 4px; overflow: hidden; }
.cv-rt-btn { padding: 3px 9px; font-size: 10px; font-family: 'DM Sans',sans-serif; border: none; background: var(--white); color: var(--ink-soft); cursor: pointer; }
.cv-rt-btn.active { background: var(--navy); color: #fff; font-weight: 600; }
.cv-ra-grid { display: flex; flex-wrap: wrap; gap: 8px; }
.cv-ra-card { background: var(--sand); border: 1px solid var(--border); border-radius: var(--r-sm); padding: 8px 10px; min-width: 100px; }
.cv-ra-card.cv-ra-active { background: var(--white); border-color: var(--ocean-light); }
.cv-ra-card-hd { display: flex; align-items: center; gap: 4px; margin-bottom: 3px; }
.cv-ra-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
.cv-ra-rname { font-size: 10px; font-weight: 500; flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100px; }
.cv-ra-pier-tag { font-size: 8px; font-weight: 700; color: var(--ink-soft); }
.cv-ra-val  { font-size: 20px; font-weight: 700; color: var(--ink); line-height: 1; }
.cv-ra-sub  { font-size: 9px; color: var(--ink-soft); margin-top: 1px; }
.cv-ra-empty { font-size: 9px; color: var(--ink-soft); font-style: italic; }

/* ── Content split ── */
.cv-content { display: grid; grid-template-columns: 1fr 280px; gap: 12px; align-items: start; }
.cv-content-mx { grid-template-columns: 1fr; }

/* ── Calendar ── */
.cv-cal-wrap { background: var(--white); border: 1px solid var(--border); border-radius: var(--r); overflow: hidden; box-shadow: var(--shadow); }
.cv-dow-row { display: grid; grid-template-columns: repeat(7, 1fr); background: var(--sand); border-bottom: 1px solid var(--border); }
.cv-dow { text-align: center; font-size: 9px; font-weight: 700; letter-spacing: .05em; color: var(--ink-soft); padding: 7px 4px; text-transform: uppercase; }
.cv-cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 0; }
.cv-blank { background: transparent; }
.cv-cell {
  border-right: 1px solid var(--border); border-bottom: 1px solid var(--border);
  padding: 4px 5px; min-height: 100px; cursor: pointer;
  transition: background .1s;
  vertical-align: top;
}
.cv-cell:nth-child(7n) { border-right: none; }
.cv-cell:hover { background: var(--sand); }
.cv-cell-today { background: rgba(33,150,190,.06); }
.cv-cell-sel { outline: 2px solid var(--ocean-mid); outline-offset: -2px; background: var(--ocean-50); }
.cv-cell-hd { display: flex; align-items: center; justify-content: space-between; margin-bottom: 3px; }
.cv-dn { font-size: 11px; font-weight: 600; color: var(--ink-soft); }
.cv-cell-today .cv-dn { color: var(--ocean); }
.cv-today-tag { font-size: 7px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; background: var(--ocean-mid); color: #fff; padding: 1px 4px; border-radius: 3px; }

/* Chips */
.cv-chip { display: flex; align-items: center; justify-content: space-between; border-radius: 4px; padding: 2px 4px; margin-bottom: 2px; font-size: 9px; font-weight: 500; gap: 3px; border-left: 2px solid transparent; }
.cv-chip-name { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--ink-mid); }
.cv-chip-val  { flex-shrink: 0; font-weight: 700; color: var(--ink); }
.cv-chip-closed { background: var(--sand-dark); color: var(--ink-soft); border-left-color: var(--ink-soft); }
.cv-chip-more { font-size: 8px; color: var(--ink-soft); text-align: center; padding: 1px 0; }

/* ── Detail panel ── */
.cv-detail { padding: 14px; position: sticky; top: 10px; max-height: calc(100vh - 120px); overflow-y: auto; }
.cv-detail-empty { display: flex; align-items: center; justify-content: center; min-height: 200px; }
.cv-dp-tag  { font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: var(--ink-soft); margin-bottom: 4px; }
.cv-dp-date { font-size: 16px; font-weight: 700; margin-bottom: 10px; display: flex; align-items: center; flex-wrap: wrap; gap: 4px; }

.cv-dp-week-box { background: var(--green-light); border-radius: var(--r-sm); padding: 8px 12px; margin-bottom: 12px; display: flex; flex-direction: column; gap: 4px; }
.cv-dp-week-hd  { font-size: 10px; font-weight: 600; color: var(--green-dark); }
.cv-dp-week-stats { display: flex; align-items: center; justify-content: space-between; }
.cv-dp-week-sub  { font-size: 10px; color: var(--green-dark); }
.cv-dp-week-total { text-align: right; }
.cv-dp-wt-num { font-size: 24px; font-weight: 700; color: var(--green-dark); line-height: 1; display: block; }
.cv-dp-wt-lbl { font-size: 9px; color: var(--green-dark); opacity: .7; }

.cv-dp-pier { margin-bottom: 10px; }
.cv-dp-pier-hd { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; }
.cv-dp-pier-dot { padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: 700; color: #fff; flex-shrink: 0; }
.cv-dp-pier-name { font-size: 12px; font-weight: 600; flex: 1; }
.cv-dp-pier-meta { font-size: 10px; color: var(--ink-soft); }
.cv-dp-pier-closed { font-size: 11px; color: var(--ink-soft); background: var(--sand); border-radius: var(--r-sm); padding: 6px 10px; }

.cv-dp-route-grp { background: var(--sand); border-radius: var(--r-sm); padding: 8px 10px; margin-bottom: 6px; }
.cv-dp-rg-hd { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; }
.cv-dp-rg-dot  { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.cv-dp-rg-name { font-size: 12px; font-weight: 600; flex: 1; }
.cv-dp-rg-meta { font-size: 10px; color: var(--ink-soft); }
.cv-dp-rg-free { font-size: 18px; font-weight: 700; flex-shrink: 0; }
.cv-dp-boat-row { display: flex; align-items: center; gap: 8px; padding: 3px 0; border-top: 1px solid var(--border); font-size: 11px; }
.cv-dp-boat-name { flex: 1; font-weight: 500; }
.cv-dp-boat-time { color: var(--ink-soft); font-size: 10px; }
.cv-dp-boat-free { font-weight: 700; min-width: 40px; text-align: right; }
.cv-dp-boat-free.full { color: var(--red); }
.cv-dp-route-avg { font-size: 9px; color: var(--ink-soft); margin-top: 6px; padding-top: 6px; border-top: 1px dashed var(--border); display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }

/* ── Matrix view ── */
.cv-mx-wrap { overflow: hidden; }

.cv-mx-info {
  display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;
  padding: 8px 14px; background: var(--sand); border-bottom: 1px solid var(--border);
  font-size: 10px; color: var(--ink-soft);
}
.cv-mx-legend { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.cv-mx-leg { display: flex; align-items: center; gap: 4px; font-size: 9px; color: var(--ink-soft); }
.cv-mx-leg-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }

.cv-mx-scroll { overflow: auto; max-height: calc(100vh - 280px); }

.cv-mx-table {
  border-collapse: separate; border-spacing: 0;
  min-width: 100%; table-layout: fixed;
}
.cv-mx-table thead th,
.cv-mx-table tbody td { white-space: nowrap; }

.cv-mx-th-route {
  position: sticky; left: 0; top: 0; z-index: 4;
  background: var(--sand); border-right: 2px solid var(--border); border-bottom: 1px solid var(--border);
  padding: 6px 10px; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em;
  color: var(--ink-soft); min-width: 160px; text-align: left;
}
.cv-mx-th-day {
  position: sticky; top: 0; z-index: 2;
  border-bottom: 1px solid var(--border); border-right: 1px solid var(--border);
  padding: 4px 2px; text-align: center; font-size: 10px; font-weight: 600; min-width: 36px; width: 36px;
  background: var(--sand); color: var(--ink);
}
.cv-mx-th-day.cv-mx-today-col { background: rgba(33,150,190,.12); color: var(--ocean); }
.cv-mx-th-day.cv-mx-wkend { background: rgba(0,0,0,.03); }
.cv-mx-dow { font-size: 7px; font-weight: 700; letter-spacing: .04em; color: var(--ink-soft); text-transform: uppercase; }

.cv-mx-row:hover .cv-mx-td-route,
.cv-mx-row:hover .cv-mx-cell { filter: brightness(.96); }

.cv-mx-td-route {
  position: sticky; left: 0; z-index: 2;
  background: var(--white); border-right: 2px solid var(--border); border-bottom: 1px solid var(--border);
  padding: 5px 8px; min-width: 160px;
  display: flex; align-items: center; gap: 7px;
}
.cv-mx-r-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.cv-mx-rname { font-size: 10px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 110px; }
.cv-mx-rmeta { font-size: 8px; color: var(--ink-soft); display: flex; align-items: center; gap: 4px; }

.cv-mx-cell {
  border-right: 1px solid var(--border); border-bottom: 1px solid var(--border);
  text-align: center; padding: 4px 2px; cursor: pointer;
  transition: filter .1s;
}
.cv-mx-cell.cv-mx-today-col { outline: 1px solid var(--ocean-mid); outline-offset: -1px; }
.cv-mx-cell.cv-mx-sel-col { outline: 2px solid var(--ocean); outline-offset: -2px; }

.cv-mx-val { font-size: 10px; font-weight: 700; line-height: 1; }

/* Fill states — green tones from original FOREST/LIME palette */
.cv-mx-full       { background: #ffeded; }
.cv-mx-full .cv-mx-val { color: var(--red); }
.cv-mx-selling    { background: #fff3ef; }
.cv-mx-selling .cv-mx-val { color: var(--coral); }
.cv-mx-medium     { background: #fffbef; }
.cv-mx-medium .cv-mx-val { color: var(--amber); }
.cv-mx-undersold  { background: #eef4fb; }
.cv-mx-undersold .cv-mx-val { color: #4d80aa; }
.cv-mx-many       { background: #CFE9AC; }
.cv-mx-many .cv-mx-val { color: #1F4D2C; }
.cv-mx-none       { background: var(--sand); }
.cv-mx-none .cv-mx-val { color: var(--ink-soft); }
</style>
