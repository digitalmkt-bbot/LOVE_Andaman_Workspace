<template>
  <div>
    <div class="page-hd">
      <div>
        <h1>Re-confirm</h1>
        <p>ติดตามการ reconfirm กับ agent ก่อนวันออกเดินทาง</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-ghost btn-sm" @click="prevDay">← ก่อนหน้า</button>
        <button class="btn btn-ghost btn-sm" @click="goToday">วันนี้</button>
        <button class="btn btn-ghost btn-sm" @click="nextDay">ถัดไป →</button>
      </div>
    </div>

    <div class="rc-date-bar">
      <span class="rc-date-lbl">{{ dateLabelFull }}</span>
      <span v-if="dateStr === TODAY" class="pill pill-green">Today</span>
    </div>

    <!-- Summary -->
    <div class="rc-kpi-row">
      <div class="kpi">
        <div class="kpi-lbl">Bookings</div>
        <div class="kpi-val">{{ dayBookings.length }}</div>
        <div class="kpi-sub">on this date</div>
      </div>
      <div class="kpi k-green">
        <div class="kpi-lbl">Confirmed</div>
        <div class="kpi-val" style="color:var(--green)">{{ confirmedCount }}</div>
        <div class="kpi-sub">reconfirmed</div>
      </div>
      <div class="kpi k-coral">
        <div class="kpi-lbl">Pending</div>
        <div class="kpi-val" style="color:var(--red)">{{ pendingCount }}</div>
        <div class="kpi-sub">need follow-up</div>
      </div>
      <div class="kpi">
        <div class="kpi-lbl">Total Pax</div>
        <div class="kpi-val">{{ totalPax }}</div>
        <div class="kpi-sub">passengers</div>
      </div>
    </div>

    <!-- Grouped by route -->
    <div v-if="!dayBookings.length" class="rc-empty card">ไม่มี booking วันนี้</div>

    <template v-for="grp in byRoute" :key="grp.routeId">
      <div class="rc-route-hd">
        <div class="rc-route-dot" :style="{ background: grp.color }"></div>
        <span class="rc-route-name">{{ grp.routeName }}</span>
        <span class="pill pill-blue" style="font-size:9px">{{ grp.items.length }} bookings</span>
        <span class="rc-route-pax">{{ grp.items.reduce((s,b) => s+b.pax, 0) }} pax</span>
        <span class="pill" :class="grp.allConfirmed ? 'pill-green' : 'pill-amber'">
          {{ grp.allConfirmed ? '✓ All confirmed' : `${grp.confirmedCount}/${grp.items.length} confirmed` }}
        </span>
      </div>

      <div class="card rc-card">
        <div class="rc-table-hd">
          <span>Ref</span>
          <span>Agent</span>
          <span>Pax</span>
          <span>Market</span>
          <span>Type</span>
          <span>Reconfirm</span>
          <span>Note</span>
        </div>
        <div v-for="b in grp.items" :key="b.id" class="rc-row" :class="{ 'rc-confirmed': b.reconfirmed }">
          <span class="rc-ref">{{ b.ref || b.id }}</span>
          <span class="rc-agent">{{ b.agent || '—' }}</span>
          <span class="rc-pax">{{ b.pax || '—' }}</span>
          <span>
            <span v-if="b.market" class="pill rc-mkt" :style="mktStyle(b.market)">
              {{ getMarket(b.market)?.name || b.market }}
            </span>
            <span v-else style="color:var(--ink-soft)">—</span>
          </span>
          <span>
            <span class="pill" :class="b.type === 'early' ? 'pill-amber' : 'pill-blue'" style="font-size:9px">
              {{ b.type || 'normal' }}
            </span>
          </span>
          <span>
            <span class="pill" :class="b.reconfirmed ? 'pill-green' : 'pill-red'">
              {{ b.reconfirmed ? '✓ Done' : 'Pending' }}
            </span>
          </span>
          <span class="rc-note">{{ b.note || '' }}</span>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useAppData } from '../../composables/useAppData'

const { bookings, routes, markets, getRoute, getMarket, fmtDate, TODAY } = useAppData()

const dateObj = ref(new Date())
const dateStr = computed(() => dateObj.value.toISOString().slice(0, 10))
const dateLabelFull = computed(() =>
  dateObj.value.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
)
function prevDay() { dateObj.value = new Date(dateObj.value.getTime() - 86400000) }
function nextDay() { dateObj.value = new Date(dateObj.value.getTime() + 86400000) }
function goToday()  { dateObj.value = new Date() }

const dayBookings = computed(() =>
  bookings.value.filter(b => b.date === dateStr.value && b.status !== 'cancelled')
)

const confirmedCount = computed(() => dayBookings.value.filter(b => b.reconfirmed).length)
const pendingCount   = computed(() => dayBookings.value.filter(b => !b.reconfirmed).length)
const totalPax       = computed(() => dayBookings.value.reduce((s, b) => s + (b.pax || 0), 0))

const byRoute = computed(() => {
  const map = {}
  for (const b of dayBookings.value) {
    const rid = b.route || '__none__'
    if (!map[rid]) {
      const r = getRoute(rid)
      map[rid] = {
        routeId: rid,
        routeName: r?.name || rid,
        color: r?.color || '#ccc',
        items: [],
        confirmedCount: 0,
        allConfirmed: false,
      }
    }
    map[rid].items.push(b)
    if (b.reconfirmed) map[rid].confirmedCount++
  }
  for (const g of Object.values(map)) {
    g.allConfirmed = g.confirmedCount === g.items.length
  }
  return Object.values(map).sort((a, b) => a.routeName.localeCompare(b.routeName))
})

function mktStyle(mktId) {
  const m = markets.value.find(x => x.id === mktId)
  if (!m) return {}
  return { background: m.color + '22', color: m.color, borderColor: m.color + '55' }
}
</script>

<style scoped>
.rc-date-bar { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; }
.rc-date-lbl { font-size: 15px; font-weight: 600; }

.rc-kpi-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 16px; }

.rc-route-hd {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 0; margin-top: 12px; margin-bottom: 6px;
  border-bottom: 1px solid var(--border);
}
.rc-route-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
.rc-route-name { font-size: 13px; font-weight: 700; flex: 1; }
.rc-route-pax  { font-size: 11px; color: var(--ink-soft); }

.rc-card { padding: 0; overflow: hidden; }
.rc-table-hd {
  display: grid;
  grid-template-columns: 100px 1fr 50px 130px 80px 100px 1fr;
  gap: 8px; padding: 7px 14px;
  background: var(--sand); border-bottom: 1px solid var(--border);
  font-size: 9px; font-weight: 700; text-transform: uppercase;
  letter-spacing: .05em; color: var(--ink-soft);
}
.rc-row {
  display: grid;
  grid-template-columns: 100px 1fr 50px 130px 80px 100px 1fr;
  gap: 8px; padding: 8px 14px; align-items: center;
  border-bottom: 1px solid var(--border); font-size: 11px;
  transition: background .1s;
}
.rc-row:last-child { border-bottom: none; }
.rc-row:hover { background: var(--sand); }
.rc-row.rc-confirmed { background: #f6fdf9; }

.rc-ref   { font-family: 'DM Mono', monospace; font-size: 10px; font-weight: 600; }
.rc-agent { font-weight: 500; }
.rc-pax   { font-weight: 700; }
.rc-mkt   { font-size: 9px; font-weight: 600; border: 1px solid transparent; }
.rc-note  { color: var(--ink-soft); font-size: 10px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.rc-empty { padding: 40px; text-align: center; color: var(--ink-soft); font-size: 12px; }
</style>
