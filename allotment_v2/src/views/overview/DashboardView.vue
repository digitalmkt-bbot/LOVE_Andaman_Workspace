<template>
  <div class="db-root">

    <!-- ── LEFT COLUMN ── -->
    <div class="db-left">

      <!-- Date header -->
      <div class="db-date-hd">
        <div class="db-date-short">{{ dayShort }} · {{ dateShort }}</div>
        <div class="db-date-full">{{ dateFull }}</div>
      </div>

      <!-- Boat Operating card -->
      <div class="card db-op-card">
        <div class="db-op-hd">
          <span class="db-op-title">Boat Operating</span>
          <span class="pill pill-green" style="font-size:9px">Today</span>
        </div>
        <div class="db-op-kpis">
          <div class="db-ok">
            <div class="db-ok-lbl">BOATS</div>
            <div class="db-ok-val">{{ boatsDeployed }}</div>
            <div class="db-ok-sub">/ {{ boats.length }} ready</div>
          </div>
          <div class="db-ok">
            <div class="db-ok-lbl">FILL</div>
            <div class="db-ok-val" :style="{ color: fillColor }">{{ fillPct }}<span class="db-ok-pct">%</span></div>
            <div class="db-ok-sub">{{ totalBooked }}/{{ totalSeats }}</div>
          </div>
          <div class="db-ok">
            <div class="db-ok-lbl">FREE</div>
            <div class="db-ok-val" :style="{ color: totalFree <= 5 ? 'var(--red)' : 'var(--ink)' }">{{ totalFree }}</div>
            <div class="db-ok-sub">seats left</div>
          </div>
        </div>

        <!-- Per-pier route fill bars -->
        <div v-for="pier in ['tublamu', 'panwa']" :key="pier">
          <div v-if="Object.keys(groups[pier] || {}).length" class="db-pier-rows">
            <div class="db-pier-lbl" :style="{ color: pierAccent[pier] }">{{ pierNames[pier] }}</div>
            <div v-for="row in Object.values(groups[pier])" :key="`${row.r.id}-${row.type}`" class="db-rr">
              <div class="db-rr-dot" :style="{ background: row.r.color }"></div>
              <div class="db-rr-name">{{ row.r.name }}</div>
              <div class="db-rr-bar">
                <div class="fbar"><div class="fbar-inner" :style="{ width: Math.min(rowFill(row), 100) + '%', background: rowFillColor(row) }"></div></div>
              </div>
              <div class="db-rr-val" :style="{ color: rowFillColor(row) }">{{ Math.min(rowFill(row), 100) }}%</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Boats operating -->
      <div class="card db-boats-card" v-if="deployedBoats.length">
        <div class="db-section-hd">
          Boats operating
          <span class="db-count-pill">{{ deployedBoats.length }}</span>
        </div>
        <div v-for="b in deployedBoats" :key="b.id" class="db-boat-row">
          <div class="db-boat-av">{{ b.name.slice(0, 2).toUpperCase() }}</div>
          <div class="db-boat-info">
            <div class="db-boat-name">{{ b.name }}</div>
            <div class="db-boat-sub">{{ b.pier }} · {{ b.routeName }}</div>
          </div>
          <div class="db-boat-free">
            <span :style="{ color: b.free <= 0 ? 'var(--red)' : b.free <= 5 ? 'var(--amber)' : 'var(--ink-soft)' }">
              <strong style="font-size:15px">{{ b.free }}</strong>
              <span style="font-size:9px"> free / {{ b.cap }}</span>
            </span>
          </div>
        </div>
      </div>

      <!-- Today's headline: top fill route -->
      <div v-if="headline" class="card db-hl-card">
        <div class="db-hl-hd">
          <div class="db-hl-lbl">Today's headline</div>
          <div class="db-hl-date">{{ dayShort }} {{ dateShort }}</div>
        </div>
        <div class="db-hl-hint">route ที่ booking เยอะที่สุด</div>
        <div class="db-hl-pier">{{ pierNames[headline.pier] }}</div>
        <div class="db-hl-route">{{ headline.r.name }}</div>
        <div class="db-hl-boats">{{ headline.boatCount }} boats | {{ headline.free }} free / {{ headline.allot }}</div>
        <div class="db-hl-bar">
          <div class="fbar" style="height:8px">
            <div class="fbar-inner" :style="{ width: Math.min(rowFill(headline), 100) + '%', background: rowFillColor(headline) }"></div>
          </div>
          <div class="db-hl-pct" :style="{ color: rowFillColor(headline) }">{{ Math.min(rowFill(headline), 100) }}%</div>
        </div>
      </div>

      <!-- Departures 48h -->
      <div class="card db-dep-card">
        <div class="db-section-hd">
          Departures · 48h
          <span class="db-count-pill" style="background:var(--ocean-50);color:var(--ocean)">{{ departures.length }} TRIPS</span>
        </div>
        <div v-if="!departures.length" class="db-empty">ไม่มีข้อมูล</div>
        <div v-for="dep in departures.slice(0, 7)" :key="`${dep.date}-${dep.boatId}`" class="db-dep-row">
          <span class="db-dep-tag" :class="dep.isToday ? 'db-dep-today' : ''">{{ dep.isToday ? 'Today' : dep.timeLabel }}</span>
          <div class="db-dep-info">
            <div class="db-dep-route">{{ dep.routeName }}</div>
            <div class="db-dep-boat">{{ dep.boatName }}</div>
          </div>
          <div class="db-dep-free">{{ dep.free }}</div>
        </div>
      </div>
    </div>

    <!-- ── CENTER COLUMN ── -->
    <div class="db-center">

      <!-- Seats available calendar -->
      <div class="card db-cal-card">
        <div class="db-cal-hd">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--ocean-mid)"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
          <span class="db-cal-title">Seats available</span>
          <button class="cal-nav" @click="prevMonth">‹</button>
          <span class="db-cal-month">{{ calMonthLabel }}</span>
          <button class="cal-nav" @click="nextMonth">›</button>
        </div>

        <!-- Route filter -->
        <div class="db-cal-filters">
          <button class="fp" :class="{ on: !calFilter }" @click="calFilter = ''">All</button>
          <button v-for="r in routes" :key="r.id" class="fp" :class="{ on: calFilter === r.id }" @click="calFilter = calFilter === r.id ? '' : r.id">{{ r.name }}</button>
        </div>

        <!-- Legend -->
        <div class="db-cal-legend">
          <div v-for="l in legend" :key="l.label" class="db-cal-leg-item">
            <div class="db-cal-leg-dot" :style="{ background: l.color }"></div>{{ l.label }}
          </div>
          <span class="db-cal-legend-hint">free seats / capacity</span>
        </div>

        <!-- Weekday headers -->
        <div class="cal-grid-wd">
          <div v-for="d in ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']" :key="d" class="cal-wd">{{ d }}</div>
        </div>

        <!-- Calendar grid -->
        <div class="cal-grid db-cal-grid">
          <div v-for="(cell, i) in calCells" :key="i"
            class="cal-day db-cal-day"
            :class="{ empty: !cell, today: cell?.dateStr === TODAY, [calDayColorClass(cell)]: !!cell }">
            <template v-if="cell">
              <div class="cal-day-num">{{ cell.day }}</div>
              <div class="db-cal-free" :style="{ color: calFreeColor(cell.free, cell.cap) }">{{ cell.free }}</div>
              <div class="db-cal-of">/{{ cell.cap }} free</div>
              <div class="db-cal-pax">{{ cell.booked }} pax</div>
            </template>
          </div>
        </div>

        <!-- Footer -->
        <div class="db-cal-footer">
          <span>Today: <strong>{{ todayBooked }} pax booked</strong></span>
          <span>{{ todayFree }} / {{ todayCap }} seats free</span>
          <span class="pill" :class="todayFree > 0 ? 'pill-green' : 'pill-red'" style="font-size:9px">{{ todayFree > 0 ? 'Open today' : 'Full today' }}</span>
        </div>
      </div>

      <!-- Bookings overview -->
      <div class="card db-bk-overview">
        <div class="db-section-hd">Bookings overview · วันนี้</div>
        <div class="db-bk-sub">รวม {{ todayBooked }} seats / {{ todayCap }} cap · {{ fillPct }}% fill · วันนี้ - วันนี้ -48 vs เมื่อวาน</div>
        <div class="db-bk-bar-area">
          <div v-if="!bkBars.length" class="db-empty">ยังไม่มี booking วันนี้</div>
          <div v-for="b in bkBars.slice(0, 10)" :key="b.label" class="db-bk-bar-row">
            <div class="db-bk-lbl">{{ b.label }}</div>
            <div class="db-bk-track"><div class="db-bk-fill" :style="{ width: b.pct + '%' }"></div></div>
            <div class="db-bk-val">{{ b.pax }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- ── RIGHT COLUMN ── -->
    <div class="db-right">

      <!-- Bookings/day mini week view -->
      <div class="db-bkday-card">
        <div class="db-bkday-hd">
          Bookings/day
          <button class="topbar-btn" style="font-size:10px;padding:2px 8px">OK</button>
        </div>
        <div class="db-bkday-week">
          <div v-for="d in weekDays" :key="d.dateStr" class="db-bkday-col" :class="{ today: d.dateStr === TODAY }">
            <div class="db-bkday-dow">{{ d.dow }}</div>
            <div class="db-bkday-dd">{{ d.day }}</div>
            <div class="db-bkday-pax">{{ d.pax }}</div>
            <div v-if="d.pax" class="db-bkday-sub-lbl">{{ d.pax > 30 ? d.pax * 800 : '' }}</div>
          </div>
        </div>
        <div class="db-bkday-stats">
          <span>7-day avg <strong>{{ weekAvg }}</strong> pax</span>
          <span class="db-bkday-trend" :class="weekTrend >= 0 ? 'up' : 'dn'">
            {{ weekTrend >= 0 ? '↑' : '↓' }}{{ Math.abs(weekTrend) }}%
          </span>
        </div>
        <div class="db-bkday-today-row">
          <span>Today <strong style="color:var(--ocean-mid)">{{ todayBooked }}</strong> pax</span>
          <span style="color:var(--ink-soft);font-size:10px">vs prev week {{ prevWeekPax }}</span>
        </div>
      </div>

      <!-- Live bookings -->
      <div class="db-live-card">
        <div class="db-live-hd">
          <span>Live bookings</span>
          <span class="db-live-dot"></span>
          <span class="db-live-lbl">live</span>
        </div>
        <div v-if="!recentBookings.length" class="db-empty" style="padding:24px;font-size:11px">ยังไม่มี booking วันนี้</div>
        <div v-for="b in recentBookings.slice(0, 18)" :key="b.id" class="db-live-row">
          <div class="db-live-av" :style="{ background: avatarBg(b.agent) }">{{ agentInitials(b.agent) }}</div>
          <div class="db-live-info">
            <div class="db-live-name">{{ b.agent }} · {{ getRoute(b.route)?.name || b.route || '—' }}</div>
            <div class="db-live-sub">{{ b.pax || 1 }} pax · {{ b.date }}<template v-if="b.value"> · ฿{{ fmtTHB(b.value) }}</template></div>
          </div>
          <div class="db-live-time">{{ relativeTime(b.created_at || b.date) }}</div>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useAppStore } from '../../store/app'
import { useAppData } from '../../composables/useAppData'

const store = useAppStore()
const { routes, boats, trips, agents, bookings, buildDAGroups, getRoute, getBoat, fmtTHB, agentInitials, TODAY } = useAppData()

// ── Date labels ──────────────────────────────────────────────────────────────
const now      = new Date()
const dayShort = now.toLocaleDateString('en-GB', { weekday: 'short' }).toUpperCase()
const dateShort = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }).toUpperCase()
const dateFull  = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })

// ── Today ops ────────────────────────────────────────────────────────────────
const groups = computed(() => buildDAGroups(TODAY))
const allGroups = computed(() => {
  const rows = []
  for (const [pier, pRows] of Object.entries(groups.value))
    for (const row of Object.values(pRows))
      rows.push({ ...row, pier })
  return rows
})

const totalSeats  = computed(() => allGroups.value.reduce((s, r) => s + r.allot, 0))
const totalBooked = computed(() => allGroups.value.reduce((s, r) => s + r.booked, 0))
const totalFree   = computed(() => totalSeats.value - totalBooked.value)
const fillPct     = computed(() => totalSeats.value > 0 ? Math.round(totalBooked.value / totalSeats.value * 100) : 0)
const fillColor   = computed(() => fillPct.value >= 85 ? 'var(--red)' : fillPct.value >= 65 ? 'var(--amber)' : 'var(--green)')

const boatsDeployed = computed(() => Object.keys(trips.value[TODAY] || {}).length)

const deployedBoats = computed(() => {
  const ops = trips.value[TODAY] || {}
  return Object.entries(ops).map(([bid, op]) => {
    if (Array.isArray(op)) return null
    const b = getBoat(bid); if (!b) return null
    const r = getRoute(op.route)
    const free = (b.cap || 0) - (op.booked || 0)
    return { id: bid, name: b.name, cap: b.cap, free, pier: r?.pier || '—', routeName: r?.name || op.route || '—' }
  }).filter(Boolean).sort((a, b) => a.free - b.free)
})

// ── Headline: route with most booked ─────────────────────────────────────────
const headline = computed(() => {
  if (!allGroups.value.length) return null
  const row = [...allGroups.value].sort((a, b) => b.booked - a.booked)[0]
  const ops = trips.value[TODAY] || {}
  const boatCount = Object.entries(ops).filter(([, op]) => !Array.isArray(op) && op.route === row.r.id).length
  return { ...row, boatCount, free: row.allot - row.booked }
})

// ── Departures 48h ───────────────────────────────────────────────────────────
const tomorrow = (() => {
  const d = new Date(now); d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
})()

const departures = computed(() => {
  const rows = []
  for (const ds of [TODAY, tomorrow]) {
    const ops = trips.value[ds] || {}
    for (const [bid, op] of Object.entries(ops)) {
      if (Array.isArray(op)) continue
      const b = getBoat(bid); if (!b) continue
      const r = getRoute(op.route)
      const free = (b.cap || 0) - (op.booked || 0)
      const timeLabel = r?.times?.[0] || ds.slice(5)
      rows.push({ date: ds, boatId: bid, boatName: b.name, routeName: r?.name || op.route || '—', free, isToday: ds === TODAY, timeLabel })
    }
  }
  return rows.sort((a, b) => a.free - b.free)
})

// ── Calendar ─────────────────────────────────────────────────────────────────
const calYear  = ref(parseInt(TODAY.slice(0, 4)))
const calMonth = ref(parseInt(TODAY.slice(5, 7)) - 1)
const calFilter = ref('')

function prevMonth() { if (calMonth.value === 0) { calYear.value--; calMonth.value = 11 } else calMonth.value-- }
function nextMonth() { if (calMonth.value === 11) { calYear.value++; calMonth.value = 0 } else calMonth.value++ }

const calMonthLabel = computed(() =>
  new Date(calYear.value, calMonth.value, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
)

const calCells = computed(() => {
  const first = new Date(calYear.value, calMonth.value, 1)
  const daysInMonth = new Date(calYear.value, calMonth.value + 1, 0).getDate()
  let startDow = first.getDay(); if (startDow === 0) startDow = 7
  const cells = Array(startDow - 1).fill(null)

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${calYear.value}-${String(calMonth.value + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const dayOps  = trips.value[dateStr] || {}
    let cap = 0, booked = 0
    for (const [bid, op] of Object.entries(dayOps)) {
      if (Array.isArray(op)) continue
      if (calFilter.value && op.route !== calFilter.value) continue
      const b = getBoat(bid); if (!b) continue
      cap    += b.cap || 0
      booked += op.booked || 0
    }
    cells.push({ day: d, dateStr, cap, booked, free: cap - booked })
  }
  return cells
})

function calFreeColor(free, cap) {
  if (!cap) return 'var(--ink-soft)'
  const pct = free / cap * 100
  return pct <= 5 ? 'var(--red)' : pct <= 20 ? 'var(--amber)' : 'var(--green-dark)'
}

function calDayColorClass(cell) {
  if (!cell || !cell.cap) return ''
  const pct = cell.free / cell.cap * 100
  if (pct <= 0)  return 'db-cal-full'
  if (pct <= 10) return 'db-cal-red'
  if (pct <= 25) return 'db-cal-amber'
  if (pct <= 50) return 'db-cal-med'
  return 'db-cal-ok'
}

const legend = [
  { label: 'Full',      color: 'var(--red)' },
  { label: 'Selling',   color: 'var(--amber)' },
  { label: 'Medium',    color: '#d4a800' },
  { label: 'Under-sold',color: '#aac' },
  { label: 'Many free', color: 'var(--green)' },
]

const todayCap    = computed(() => { const c = calCells.value.find(c => c?.dateStr === TODAY); return c?.cap || 0 })
const todayBooked = computed(() => { const c = calCells.value.find(c => c?.dateStr === TODAY); return c?.booked || 0 })
const todayFree   = computed(() => todayCap.value - todayBooked.value)

// ── Bookings overview bars (today by agent) ──────────────────────────────────
const bkBars = computed(() => {
  const map = {}
  for (const b of bookings.value) {
    if (b.date !== TODAY) continue
    const key = b.agent || 'Unknown'
    if (!map[key]) map[key] = { label: key, pax: 0 }
    map[key].pax += b.pax || 1
  }
  const rows = Object.values(map).sort((a, b) => b.pax - a.pax)
  const max  = rows[0]?.pax || 1
  return rows.map(r => ({ ...r, pct: Math.round(r.pax / max * 100) }))
})

// ── Bookings/day: last 7 days ────────────────────────────────────────────────
const weekDays = computed(() => {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now)
    d.setDate(d.getDate() - (6 - i))
    const dateStr = d.toISOString().slice(0, 10)
    const pax = bookings.value.filter(b => b.date === dateStr).reduce((s, b) => s + (b.pax || 1), 0)
    return {
      dateStr,
      dow: d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase().slice(0, 3),
      day: d.getDate(),
      pax,
    }
  })
})

const weekAvg = computed(() => {
  const total = weekDays.value.reduce((s, d) => s + d.pax, 0)
  return Math.round(total / 7)
})

const weekTrend = computed(() => {
  const prev = weekDays.value.slice(0, 3).reduce((s, d) => s + d.pax, 0) / 3
  const curr = weekDays.value.slice(4).reduce((s, d) => s + d.pax, 0) / 3
  return prev > 0 ? Math.round((curr - prev) / prev * 100) : 0
})

const prevWeekPax = computed(() => {
  const d = new Date(now); d.setDate(d.getDate() - 7)
  const ds = d.toISOString().slice(0, 10)
  return bookings.value.filter(b => b.date === ds).reduce((s, b) => s + (b.pax || 1), 0)
})

// ── Live bookings feed ───────────────────────────────────────────────────────
const recentBookings = computed(() =>
  [...bookings.value]
    .filter(b => b.date >= TODAY.slice(0, 7))
    .sort((a, b) => (b.created_at || b.date || '').localeCompare(a.created_at || a.date || ''))
    .slice(0, 18)
)

function relativeTime(ts) {
  if (!ts) return ''
  const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 60000)
  if (diff < 1)  return 'just now'
  if (diff < 60) return `${diff}m`
  if (diff < 1440) return `${Math.floor(diff / 60)}h`
  return `${Math.floor(diff / 1440)}d`
}

const AVATAR_COLORS = ['#185FA5','#0F6E56','#c43a2e','#d48a14','#6c5ce7','#2d9a6a','#1a6a8a','#7a3e8a']
function avatarBg(name) { return AVATAR_COLORS[(name || '').charCodeAt(0) % AVATAR_COLORS.length] }

// ── Shared helpers ────────────────────────────────────────────────────────────
function rowFill(row)      { return row.allot > 0 ? Math.round(row.booked / row.allot * 100) : 0 }
function rowFillColor(row) {
  const p = rowFill(row)
  return p >= 85 ? 'var(--red)' : p >= 65 ? 'var(--amber)' : 'var(--green)'
}

const pierAccent = { tublamu: '#0F6E56', panwa: '#185FA5' }
const pierNames  = { tublamu: 'Tub Lamu Pier', panwa: 'Visit Panwa' }
</script>

<style scoped>
/* ── Root 3-col layout ── */
.db-root {
  display: grid;
  grid-template-columns: 280px 1fr 260px;
  gap: 14px;
  align-items: start;
}

/* ── Date header ── */
.db-date-hd { margin-bottom: 10px; }
.db-date-short { font-size: 11px; font-weight: 700; color: var(--ocean); letter-spacing: .04em; text-transform: uppercase; }
.db-date-full  { font-size: 16px; font-weight: 600; color: var(--ink); margin-top: 1px; }

/* ── Left column cards ── */
.db-left { display: flex; flex-direction: column; gap: 10px; }

/* Boat Operating */
.db-op-card { padding: 12px 14px; }
.db-op-hd { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.db-op-title { font-size: 13px; font-weight: 600; }
.db-op-kpis { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0; margin-bottom: 10px; border: 1px solid var(--border); border-radius: var(--r-sm); overflow: hidden; }
.db-ok { padding: 8px 10px; border-right: 1px solid var(--border); }
.db-ok:last-child { border-right: none; }
.db-ok-lbl { font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: var(--ink-soft); }
.db-ok-val { font-size: 22px; font-weight: 700; color: var(--ink); line-height: 1.1; }
.db-ok-pct { font-size: 12px; }
.db-ok-sub { font-size: 9px; color: var(--ink-soft); }

/* Route fill bars */
.db-pier-rows { margin-bottom: 6px; }
.db-pier-lbl { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; margin-bottom: 4px; }
.db-rr { display: flex; align-items: center; gap: 6px; padding: 3px 0; }
.db-rr-dot { width: 6px; height: 6px; border-radius: 2px; flex-shrink: 0; }
.db-rr-name { font-size: 11px; flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.db-rr-bar { width: 60px; flex-shrink: 0; }
.db-rr-val { font-size: 10px; font-weight: 700; min-width: 28px; text-align: right; }

/* Boats operating */
.db-boats-card { padding: 10px 14px; }
.db-section-hd { font-size: 11px; font-weight: 600; margin-bottom: 8px; display: flex; align-items: center; gap: 6px; }
.db-count-pill { font-size: 9px; font-weight: 600; padding: 1px 6px; border-radius: 10px; background: var(--sand-dark); color: var(--ink-soft); }
.db-boat-row { display: flex; align-items: center; gap: 8px; padding: 6px 0; border-bottom: 1px solid var(--border); }
.db-boat-row:last-child { border-bottom: none; }
.db-boat-av { width: 26px; height: 26px; border-radius: 6px; background: var(--navy); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 9px; font-weight: 700; flex-shrink: 0; }
.db-boat-info { flex: 1; min-width: 0; }
.db-boat-name { font-size: 11px; font-weight: 600; }
.db-boat-sub  { font-size: 9px; color: var(--ink-soft); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.db-boat-free { flex-shrink: 0; text-align: right; }

/* Headline card */
.db-hl-card { padding: 12px 14px; background: var(--navy); border-color: transparent; color: #fff; }
.db-hl-hd  { display: flex; align-items: center; justify-content: space-between; margin-bottom: 2px; }
.db-hl-lbl { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: .05em; color: rgba(255,255,255,.5); }
.db-hl-date { font-size: 10px; font-weight: 600; background: var(--ocean-mid); color: #fff; padding: 2px 7px; border-radius: 4px; }
.db-hl-hint { font-size: 10px; color: rgba(255,255,255,.4); margin-bottom: 6px; }
.db-hl-pier { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: rgba(255,255,255,.4); }
.db-hl-route { font-size: 14px; font-weight: 700; color: #fff; margin-top: 1px; }
.db-hl-boats { font-size: 10px; color: rgba(255,255,255,.5); margin-top: 2px; margin-bottom: 8px; }
.db-hl-bar { display: flex; align-items: center; gap: 8px; }
.db-hl-pct { font-size: 18px; font-weight: 700; flex-shrink: 0; }

/* Departures */
.db-dep-card { padding: 10px 14px; }
.db-dep-row { display: flex; align-items: center; gap: 8px; padding: 6px 0; border-bottom: 1px solid var(--border); }
.db-dep-row:last-child { border-bottom: none; }
.db-dep-tag { font-size: 9px; font-weight: 700; padding: 2px 6px; border-radius: 4px; background: var(--sand-dark); color: var(--ink-soft); flex-shrink: 0; white-space: nowrap; }
.db-dep-today { background: var(--ocean-50); color: var(--ocean); }
.db-dep-info { flex: 1; min-width: 0; }
.db-dep-route { font-size: 11px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.db-dep-boat  { font-size: 9px; color: var(--ink-soft); }
.db-dep-free  { font-size: 13px; font-weight: 700; color: var(--ink-soft); flex-shrink: 0; }
.db-empty { font-size: 11px; color: var(--ink-soft); text-align: center; padding: 12px; }

/* ── Center column ── */
.db-center { display: flex; flex-direction: column; gap: 10px; }

/* Calendar card */
.db-cal-card { padding: 12px 14px; }
.db-cal-hd { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
.db-cal-title { font-size: 14px; font-weight: 600; flex: 1; }
.db-cal-month { font-size: 14px; font-weight: 600; min-width: 130px; }
.db-cal-filters { display: flex; gap: 4px; flex-wrap: wrap; margin-bottom: 8px; }
.db-cal-legend { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; flex-wrap: wrap; }
.db-cal-leg-item { display: flex; align-items: center; gap: 3px; font-size: 10px; color: var(--ink-soft); }
.db-cal-leg-dot { width: 7px; height: 7px; border-radius: 50%; }
.db-cal-legend-hint { margin-left: auto; font-size: 10px; color: var(--ink-soft); }

.db-cal-grid { gap: 3px; }
.db-cal-day { min-height: 70px; padding: 4px; }
.cal-day-num { font-size: 10px; font-weight: 500; color: var(--ink-soft); }
.db-cal-free { font-size: 18px; font-weight: 700; line-height: 1.1; }
.db-cal-of   { font-size: 8px; color: var(--ink-soft); }
.db-cal-pax  { font-size: 9px; color: var(--ink-soft); }

/* Day color states */
.db-cal-full  { background: #ffe0de; border-color: rgba(196,58,46,.2); }
.db-cal-red   { background: #fff0ef; }
.db-cal-amber { background: #fffbf0; }
.db-cal-med   { background: var(--white); }
.db-cal-ok    { background: #f0fbf5; }

.db-cal-footer {
  display: flex; align-items: center; gap: 14px; flex-wrap: wrap;
  padding-top: 10px; border-top: 1px solid var(--border); margin-top: 8px;
  font-size: 11px; color: var(--ink-mid);
}

/* Bookings overview */
.db-bk-overview { padding: 12px 14px; }
.db-bk-sub { font-size: 10px; color: var(--ink-soft); margin-bottom: 10px; }
.db-bk-bar-area { display: flex; flex-direction: column; gap: 7px; }
.db-bk-bar-row { display: flex; align-items: center; gap: 8px; }
.db-bk-lbl { font-size: 10px; width: 140px; flex-shrink: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.db-bk-track { flex: 1; height: 6px; background: var(--border); border-radius: 3px; overflow: hidden; }
.db-bk-fill  { height: 100%; background: var(--ocean-mid); border-radius: 3px; }
.db-bk-val   { font-size: 10px; font-weight: 700; min-width: 24px; text-align: right; }

/* ── Right column ── */
.db-right { display: flex; flex-direction: column; gap: 10px; }

/* Bookings/day */
.db-bkday-card { background: #0f1f2e; border-radius: var(--r); padding: 12px; color: #fff; box-shadow: var(--shadow); }
.db-bkday-hd { font-size: 12px; font-weight: 600; display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.db-bkday-week { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; margin-bottom: 10px; }
.db-bkday-col { display: flex; flex-direction: column; align-items: center; gap: 1px; padding: 4px 2px; border-radius: 5px; background: rgba(255,255,255,.04); }
.db-bkday-col.today { background: rgba(33,150,190,.2); }
.db-bkday-dow { font-size: 7px; font-weight: 700; text-transform: uppercase; color: rgba(255,255,255,.35); letter-spacing: .03em; }
.db-bkday-dd  { font-size: 10px; font-weight: 600; color: rgba(255,255,255,.5); }
.db-bkday-pax { font-size: 16px; font-weight: 700; color: #fff; line-height: 1; }
.db-bkday-col.today .db-bkday-pax { color: var(--ocean-mid); }
.db-bkday-sub-lbl { font-size: 8px; color: rgba(255,255,255,.3); }
.db-bkday-stats { display: flex; align-items: center; justify-content: space-between; font-size: 10px; color: rgba(255,255,255,.4); padding-top: 8px; border-top: 1px solid rgba(255,255,255,.07); }
.db-bkday-trend { font-weight: 700; }
.db-bkday-trend.up { color: var(--green); }
.db-bkday-trend.dn { color: var(--red); }
.db-bkday-today-row { display: flex; align-items: center; justify-content: space-between; font-size: 11px; color: rgba(255,255,255,.6); margin-top: 6px; }

/* Live bookings */
.db-live-card { background: var(--white); border: 1px solid var(--border); border-radius: var(--r); overflow: hidden; box-shadow: var(--shadow); }
.db-live-hd { display: flex; align-items: center; gap: 6px; padding: 10px 12px; border-bottom: 1px solid var(--border); font-size: 12px; font-weight: 600; }
.db-live-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--green); animation: pulse 1.5s infinite; margin-left: auto; }
.db-live-lbl { font-size: 10px; color: var(--green); font-weight: 600; }
@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
.db-live-row { display: flex; align-items: flex-start; gap: 8px; padding: 8px 12px; border-bottom: 1px solid var(--border); }
.db-live-row:last-child { border-bottom: none; }
.db-live-row:hover { background: var(--sand); }
.db-live-av { width: 28px; height: 28px; border-radius: 7px; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 9px; font-weight: 700; flex-shrink: 0; }
.db-live-info { flex: 1; min-width: 0; }
.db-live-name { font-size: 11px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.db-live-sub  { font-size: 9px; color: var(--ink-soft); margin-top: 1px; }
.db-live-time { font-size: 9px; color: var(--ink-soft); flex-shrink: 0; white-space: nowrap; }
</style>
