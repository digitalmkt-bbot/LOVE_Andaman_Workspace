<template>
  <div>
    <div class="page-hd">
      <div>
        <h1>B2C / Direct</h1>
        <p>การขายตรง — walk-in, online, และ direct booking</p>
      </div>
      <div class="page-actions">
        <input v-model="search" class="b2c-search" type="search" placeholder="ค้นหา ref, ชื่อ…" />
      </div>
    </div>

    <div class="b2c-kpi-row">
      <div class="kpi">
        <div class="kpi-lbl">Direct Bookings</div>
        <div class="kpi-val">{{ directBk.length }}</div>
        <div class="kpi-sub">B2C total</div>
      </div>
      <div class="kpi k-green">
        <div class="kpi-lbl">Revenue</div>
        <div class="kpi-val" style="color:var(--green);font-size:18px">฿{{ fmtTHB(totalRev) }}</div>
        <div class="kpi-sub">direct sales</div>
      </div>
      <div class="kpi k-ocean">
        <div class="kpi-lbl">Total Pax</div>
        <div class="kpi-val" style="color:var(--ocean-mid)">{{ totalPax }}</div>
        <div class="kpi-sub">{{ avgPax }} avg/booking</div>
      </div>
      <div class="kpi">
        <div class="kpi-lbl">Channels</div>
        <div class="kpi-val">{{ channels.length }}</div>
        <div class="kpi-sub">sales channels</div>
      </div>
    </div>

    <!-- Channel pills -->
    <div class="b2c-filters">
      <button class="pill b2c-pill" :class="{ active: !filterChannel }" @click="filterChannel = ''">All</button>
      <button v-for="c in channels" :key="c" class="pill b2c-pill" :class="{ active: filterChannel === c }" @click="filterChannel = filterChannel === c ? '' : c">{{ c }}</button>
    </div>

    <div class="card" style="padding:0;overflow:hidden">
      <div class="b2c-table-hd">
        <span>Ref</span><span>Date</span><span>Route</span><span>Channel</span><span>Name</span><span>Pax</span><span>Revenue</span><span>Status</span>
      </div>
      <div v-if="!filtered.length" class="b2c-empty">ไม่มีข้อมูล B2C</div>
      <div v-for="b in filtered" :key="b.id" class="b2c-row">
        <span class="b2c-ref">{{ b.ref || b.id }}</span>
        <span class="b2c-date">{{ b.date }}</span>
        <div class="b2c-route">
          <span v-if="getRoute(b.route)" class="b2c-dot" :style="{ background: getRoute(b.route).color }"></span>
          {{ getRoute(b.route)?.name || b.route || '—' }}
        </div>
        <span><span class="pill pill-blue" style="font-size:9px">{{ b.channel || 'direct' }}</span></span>
        <span class="b2c-name">{{ b.guestName || b.name || '—' }}</span>
        <span class="b2c-pax">{{ b.pax || '—' }}</span>
        <span class="b2c-rev">฿{{ fmtTHB(b.revenue || 0) }}</span>
        <span><span class="pill" :class="statusPill(b.status)">{{ b.status || 'confirmed' }}</span></span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useAppData } from '../../composables/useAppData'

const { bookings, getRoute, fmtTHB } = useAppData()

const search        = ref('')
const filterChannel = ref('')

const B2C_MARKETS = ['walkin', 'direct', 'b2c', 'online']
const directBk = computed(() =>
  bookings.value.filter(b => !b.market || B2C_MARKETS.includes(b.market) || b.channel)
)

const channels = computed(() => [...new Set(directBk.value.map(b => b.channel || 'direct').filter(Boolean))].sort())

const filtered = computed(() => {
  let list = directBk.value
  if (filterChannel.value) list = list.filter(b => (b.channel || 'direct') === filterChannel.value)
  if (search.value.trim()) {
    const q = search.value.toLowerCase()
    list = list.filter(b =>
      (b.ref || '').toLowerCase().includes(q) ||
      (b.guestName || b.name || '').toLowerCase().includes(q)
    )
  }
  return list
})

const totalRev  = computed(() => filtered.value.reduce((s, b) => s + (b.revenue || 0), 0))
const totalPax  = computed(() => filtered.value.reduce((s, b) => s + (b.pax || 0), 0))
const avgPax    = computed(() => filtered.value.length > 0 ? (totalPax.value / filtered.value.length).toFixed(1) : 0)

function statusPill(s) {
  if (!s || s === 'confirmed') return 'pill-green'
  if (s === 'cancelled') return 'pill-red'
  return 'pill-amber'
}
</script>

<style scoped>
.b2c-search { padding: 6px 10px; border: 1px solid var(--border); border-radius: var(--r-sm); font-size: 12px; outline: none; width: 180px; }
.b2c-kpi-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 14px; }
.b2c-filters { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
.b2c-pill { cursor: pointer; font-size: 10px; border: 1px solid var(--border); background: var(--white); color: var(--ink-mid); }
.b2c-pill:hover { border-color: var(--ocean-mid); }
.b2c-pill.active { background: var(--ocean-50); border-color: var(--ocean-mid); color: var(--ocean); }
.b2c-table-hd {
  display: grid; grid-template-columns: 90px 85px 1fr 100px 130px 44px 90px 90px;
  gap: 8px; padding: 7px 14px;
  background: var(--sand); border-bottom: 1px solid var(--border);
  font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: var(--ink-soft);
}
.b2c-row {
  display: grid; grid-template-columns: 90px 85px 1fr 100px 130px 44px 90px 90px;
  gap: 8px; padding: 8px 14px; align-items: center; font-size: 11px;
  border-bottom: 1px solid var(--border);
}
.b2c-row:hover { background: var(--sand); }
.b2c-row:last-child { border-bottom: none; }
.b2c-ref  { font-family: 'DM Mono', monospace; font-size: 10px; font-weight: 600; }
.b2c-date { font-size: 10px; color: var(--ink-soft); }
.b2c-route { display: flex; align-items: center; gap: 5px; font-weight: 500; }
.b2c-dot   { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
.b2c-name  { color: var(--ink-mid); }
.b2c-pax   { font-weight: 700; text-align: center; }
.b2c-rev   { font-weight: 700; color: var(--green); }
.b2c-empty { padding: 40px; text-align: center; color: var(--ink-soft); font-size: 12px; }
</style>
