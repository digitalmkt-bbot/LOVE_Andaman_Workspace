<template>
  <div>
    <div class="page-hd">
      <div>
        <h1>Boat Status</h1>
        <p>สถานะเรือปัจจุบันทั้งหมด</p>
      </div>
      <div class="page-actions">
        <button
          v-for="f in filters"
          :key="f.key"
          class="btn btn-ghost btn-sm"
          :class="{ 'btn-primary': activeFilter === f.key }"
          @click="activeFilter = activeFilter === f.key ? null : f.key"
        >{{ f.label }} ({{ f.count }})</button>
      </div>
    </div>

    <!-- KPI strip -->
    <div class="fl-kpi-row">
      <div class="kpi k-green">
        <div class="kpi-lbl">Available</div>
        <div class="kpi-val" style="color:var(--green)">{{ countByStatus('available') }}</div>
        <div class="kpi-sub">ready to deploy</div>
      </div>
      <div class="kpi k-ocean">
        <div class="kpi-lbl">Deployed</div>
        <div class="kpi-val" style="color:var(--ocean-mid)">{{ boatsDeployedToday }}</div>
        <div class="kpi-sub">on trip today</div>
      </div>
      <div class="kpi k-coral">
        <div class="kpi-lbl">Maintenance</div>
        <div class="kpi-val" style="color:var(--red)">{{ countByStatus('maintenance') + countByStatus('repair') }}</div>
        <div class="kpi-sub">out of service</div>
      </div>
      <div class="kpi">
        <div class="kpi-lbl">Total Fleet</div>
        <div class="kpi-val">{{ boats.length }}</div>
        <div class="kpi-sub">vessels</div>
      </div>
    </div>

    <!-- Boat cards -->
    <div class="fl-grid">
      <div
        v-for="b in filteredBoats"
        :key="b.id"
        class="fl-card"
        :class="`fl-card-${statusKey(b)}`"
      >
        <div class="fl-card-top">
          <div class="fl-card-name">{{ b.name }}</div>
          <span class="pill" :class="statusPill(b)">{{ curStatus(b).s || 'available' }}</span>
        </div>

        <div class="fl-card-meta">
          <div class="fl-meta-row">
            <span class="fl-meta-lbl">Cap</span>
            <span class="fl-meta-val">{{ b.cap || '—' }} pax</span>
          </div>
          <div class="fl-meta-row" v-if="curStatus(b).loc && curStatus(b).loc !== '-'">
            <span class="fl-meta-lbl">Location</span>
            <span class="fl-meta-val">{{ curStatus(b).loc }}</span>
          </div>
          <div class="fl-meta-row" v-if="todayRoute(b.id)">
            <span class="fl-meta-lbl">Today</span>
            <span class="fl-meta-val" :style="{ color: todayRoute(b.id)?.routeColor }">
              {{ todayRoute(b.id)?.routeName }}
            </span>
          </div>
          <div class="fl-meta-row" v-if="curStatus(b).note">
            <span class="fl-meta-lbl">Note</span>
            <span class="fl-meta-val" style="color:var(--ink-soft)">{{ curStatus(b).note }}</span>
          </div>
        </div>

        <!-- Log timeline (last 3 entries) -->
        <div v-if="(b.log || []).length" class="fl-log">
          <div
            v-for="entry in [...(b.log || [])].sort((a,b) => b.from.localeCompare(a.from)).slice(0, 3)"
            :key="entry.id || entry.from"
            class="fl-log-entry"
          >
            <span class="fl-log-dot" :class="`dot-${entry.s}`"></span>
            <span class="fl-log-from">{{ fmtDate(entry.from) }}</span>
            <span class="fl-log-s">{{ entry.s }}</span>
            <span v-if="entry.loc" class="fl-log-loc">· {{ entry.loc }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useAppData } from '../../composables/useAppData'

const { boats, trips, getRoute, getCurStatus, fmtDate, TODAY } = useAppData()

const activeFilter = ref(null)

const todayOps = computed(() => trips.value[TODAY] || {})

function curStatus(b) { return getCurStatus(b, TODAY) }
function statusKey(b) {
  const s = curStatus(b).s
  if (!s || s === 'available') return 'ok'
  if (s === 'maintenance' || s === 'repair') return 'out'
  return 'other'
}

function todayRoute(bid) {
  const op = todayOps.value[bid]
  if (!op || Array.isArray(op)) return null
  const r = getRoute(op.route)
  return r ? { routeName: r.name, routeColor: r.color } : null
}

const boatsDeployedToday = computed(() => Object.keys(todayOps.value).length)

function countByStatus(s) {
  return boats.value.filter(b => (curStatus(b).s || 'available') === s).length
}

const filters = computed(() => [
  { key: 'available',   label: 'Available',   count: countByStatus('available') },
  { key: 'maintenance', label: 'Maintenance', count: countByStatus('maintenance') + countByStatus('repair') },
])

const filteredBoats = computed(() => {
  if (!activeFilter.value) return boats.value
  if (activeFilter.value === 'maintenance')
    return boats.value.filter(b => ['maintenance','repair'].includes(curStatus(b).s))
  return boats.value.filter(b => (curStatus(b).s || 'available') === activeFilter.value)
})

function statusPill(b) {
  const s = curStatus(b).s || 'available'
  if (s === 'available') return 'pill-green'
  if (s === 'maintenance' || s === 'repair') return 'pill-red'
  return 'pill-gray'
}
</script>

<style scoped>
.fl-kpi-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 16px; }

.fl-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 12px;
}

.fl-card {
  background: var(--white); border: 1px solid var(--border); border-radius: var(--r);
  padding: 14px; border-top: 3px solid var(--border);
  transition: box-shadow .12s;
}
.fl-card:hover { box-shadow: 0 2px 10px rgba(0,0,0,.07); }
.fl-card-ok    { border-top-color: var(--green); }
.fl-card-out   { border-top-color: var(--red); opacity: .8; }
.fl-card-other { border-top-color: var(--amber); }

.fl-card-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.fl-card-name { font-size: 13px; font-weight: 700; color: var(--ink); }

.fl-card-meta { margin-bottom: 10px; }
.fl-meta-row { display: flex; gap: 8px; font-size: 11px; margin-bottom: 3px; }
.fl-meta-lbl { color: var(--ink-soft); width: 60px; flex-shrink: 0; }
.fl-meta-val { font-weight: 500; }

.fl-log { border-top: 1px solid var(--border); padding-top: 8px; }
.fl-log-entry { display: flex; align-items: center; gap: 6px; font-size: 10px; margin-bottom: 3px; }
.fl-log-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; background: var(--border); }
.dot-available   { background: var(--green); }
.dot-maintenance { background: var(--red); }
.dot-repair      { background: var(--amber); }
.fl-log-from { color: var(--ink-soft); font-family: 'DM Mono', monospace; }
.fl-log-s    { font-weight: 600; color: var(--ink); }
.fl-log-loc  { color: var(--ink-soft); }
</style>
