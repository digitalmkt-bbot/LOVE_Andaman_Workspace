<template>
  <div>
    <div class="page-hd">
      <div>
        <h1>Rate Types</h1>
        <p>ประเภทราคาและอัตราค่าบริการ</p>
      </div>
    </div>

    <!-- KPI -->
    <div class="rt-kpi-row">
      <div class="kpi">
        <div class="kpi-lbl">Rate Types</div>
        <div class="kpi-val">{{ rateTypes.length }}</div>
        <div class="kpi-sub">defined</div>
      </div>
      <div class="kpi k-green">
        <div class="kpi-lbl">Active</div>
        <div class="kpi-val" style="color:var(--green)">{{ rateTypes.filter(r => r.active !== false).length }}</div>
        <div class="kpi-sub">in use</div>
      </div>
      <div class="kpi">
        <div class="kpi-lbl">Markets</div>
        <div class="kpi-val">{{ markets.length }}</div>
        <div class="kpi-sub">segments</div>
      </div>
    </div>

    <!-- Market filter -->
    <div class="rt-filters">
      <button
        class="pill rt-pill"
        :class="{ active: filterMkt === null }"
        @click="filterMkt = null"
      >All</button>
      <button
        v-for="m in markets"
        :key="m.id"
        class="pill rt-pill"
        :class="{ active: filterMkt === m.id }"
        :style="filterMkt === m.id ? { background: m.color, color: '#fff', borderColor: m.color } : {}"
        @click="filterMkt = filterMkt === m.id ? null : m.id"
      >{{ m.name }}</button>
    </div>

    <!-- Table -->
    <div class="card" style="padding:0;overflow:hidden">
      <div class="rt-table-hd">
        <span>Name</span>
        <span>Market</span>
        <span>Currency</span>
        <span>Routes</span>
        <span>Status</span>
        <span>Note</span>
      </div>

      <div v-if="!filtered.length" class="rt-empty">ไม่มี rate type</div>

      <div v-for="rt in filtered" :key="rt.id" class="rt-row" :class="{ inactive: rt.active === false }">
        <div class="rt-name">
          <span class="rt-name-txt">{{ rt.name }}</span>
          <span v-if="rt.code" class="rt-code">{{ rt.code }}</span>
        </div>

        <span>
          <span v-if="rt.market" class="pill rt-mkt-pill" :style="mktStyle(rt.market)">
            {{ getMarket(rt.market)?.name || rt.market }}
          </span>
          <span v-else style="color:var(--ink-soft);font-size:11px">All</span>
        </span>

        <span style="font-size:11px;font-weight:600">{{ rt.currency || 'THB' }}</span>

        <div class="rt-routes">
          <template v-if="rt.routes?.length">
            <span
              v-for="rid in rt.routes.slice(0, 3)"
              :key="rid"
              class="pill"
              :style="{ background: getRoute(rid)?.color + '22', color: getRoute(rid)?.color, border: '1px solid ' + getRoute(rid)?.color + '55', fontSize: '9px' }"
            >{{ getRoute(rid)?.name || rid }}</span>
            <span v-if="rt.routes.length > 3" style="font-size:9px;color:var(--ink-soft)">+{{ rt.routes.length - 3 }}</span>
          </template>
          <span v-else style="color:var(--ink-soft);font-size:11px">All routes</span>
        </div>

        <span>
          <span class="pill" :class="rt.active === false ? 'pill-red' : 'pill-green'">
            {{ rt.active === false ? 'Inactive' : 'Active' }}
          </span>
        </span>

        <span style="font-size:11px;color:var(--ink-soft)">{{ rt.note || '—' }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useAppData } from '../../composables/useAppData'

const { rateTypes, markets, getMarket, getRoute } = useAppData()

const filterMkt = ref(null)

const filtered = computed(() => {
  if (!filterMkt.value) return rateTypes.value
  return rateTypes.value.filter(r => r.market === filterMkt.value || !r.market)
})

function mktStyle(mktId) {
  const m = markets.value.find(x => x.id === mktId)
  if (!m) return {}
  return { background: m.color + '22', color: m.color, borderColor: m.color + '55' }
}
</script>

<style scoped>
.rt-kpi-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 16px; }

.rt-filters { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 14px; }
.rt-pill {
  cursor: pointer; font-size: 10px; font-weight: 500;
  border: 1px solid var(--border); background: var(--white);
  color: var(--ink-mid); transition: all .12s;
}
.rt-pill:hover { border-color: var(--ocean-mid); }
.rt-pill.active { background: var(--ocean-50); border-color: var(--ocean-mid); color: var(--ocean); }

.rt-table-hd {
  display: grid;
  grid-template-columns: 200px 160px 90px 1fr 90px 1fr;
  gap: 10px; padding: 8px 14px;
  background: var(--sand); border-bottom: 1px solid var(--border);
  font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: var(--ink-soft);
}
.rt-row {
  display: grid;
  grid-template-columns: 200px 160px 90px 1fr 90px 1fr;
  gap: 10px; padding: 10px 14px; align-items: center;
  border-bottom: 1px solid var(--border); transition: background .1s;
}
.rt-row:last-child { border-bottom: none; }
.rt-row:hover { background: var(--sand); }
.rt-row.inactive { opacity: .55; }

.rt-name { display: flex; flex-direction: column; gap: 2px; }
.rt-name-txt { font-size: 12px; font-weight: 600; }
.rt-code { font-size: 9px; font-family: 'DM Mono', monospace; color: var(--ink-soft); }

.rt-mkt-pill { font-size: 9px; font-weight: 600; border: 1px solid transparent; }

.rt-routes { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; }

.rt-empty { padding: 32px; text-align: center; color: var(--ink-soft); font-size: 12px; }
</style>
