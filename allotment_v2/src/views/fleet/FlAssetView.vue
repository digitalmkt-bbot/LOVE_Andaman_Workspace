<template>
  <div>
    <div class="page-hd">
      <div>
        <h1>Assets</h1>
        <p>ทะเบียนทรัพย์สินกองเรือ — เรือ, เครื่องยนต์, อุปกรณ์</p>
      </div>
    </div>

    <div class="fa-kpi-row">
      <div class="kpi">
        <div class="kpi-lbl">Total Assets</div>
        <div class="kpi-val">{{ assets.length }}</div>
        <div class="kpi-sub">registered</div>
      </div>
      <div class="kpi">
        <div class="kpi-lbl">Total Value</div>
        <div class="kpi-val" style="font-size:16px">฿{{ fmtTHB(totalValue) }}</div>
        <div class="kpi-sub">book value</div>
      </div>
      <div class="kpi k-coral">
        <div class="kpi-lbl">Depreciated</div>
        <div class="kpi-val" style="color:var(--red);font-size:16px">฿{{ fmtTHB(totalDepreciation) }}</div>
        <div class="kpi-sub">accumulated</div>
      </div>
      <div class="kpi k-green">
        <div class="kpi-lbl">Net Value</div>
        <div class="kpi-val" style="color:var(--green);font-size:16px">฿{{ fmtTHB(totalValue - totalDepreciation) }}</div>
        <div class="kpi-sub">current</div>
      </div>
    </div>

    <!-- Category filter -->
    <div class="fa-filters">
      <button class="pill fa-pill" :class="{ active: !filterCat }" @click="filterCat = ''">All</button>
      <button v-for="c in categories" :key="c" class="pill fa-pill" :class="{ active: filterCat === c }" @click="filterCat = filterCat === c ? '' : c">{{ c }}</button>
    </div>

    <div class="card" style="padding:0;overflow:hidden">
      <div class="fa-table-hd">
        <span>Asset</span><span>Category</span><span>Purchase Date</span><span>Cost</span><span>Depreciation</span><span>Net Value</span><span>Condition</span>
      </div>
      <div v-if="!filtered.length" class="fa-empty">ยังไม่มีข้อมูล asset</div>
      <div v-for="a in filtered" :key="a.id" class="fa-row">
        <div class="fa-asset-cell">
          <div class="fa-asset-name">{{ a.name }}</div>
          <div class="fa-asset-sub">{{ a.serial || '' }}</div>
        </div>
        <span><span class="pill pill-blue" style="font-size:9px">{{ a.category || '—' }}</span></span>
        <span class="fa-date">{{ fmtDate(a.purchaseDate) }}</span>
        <span class="fa-cost">฿{{ fmtTHB(a.cost || 0) }}</span>
        <span class="fa-dep" style="color:var(--red)">฿{{ fmtTHB(a.depreciation || 0) }}</span>
        <span class="fa-net" style="color:var(--green);font-weight:700">฿{{ fmtTHB((a.cost || 0) - (a.depreciation || 0)) }}</span>
        <span><span class="pill" :class="condPill(a.condition)">{{ a.condition || 'good' }}</span></span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useAppStore } from '../../store/app'
import { useAppData } from '../../composables/useAppData'

const store = useAppStore()
const { fmtDate, fmtTHB } = useAppData()

const filterCat = ref('')
const assets    = computed(() => store.state?.fl_assets || store.state?.assets || [])
const categories = computed(() => [...new Set(assets.value.map(a => a.category).filter(Boolean))].sort())
const totalValue       = computed(() => assets.value.reduce((s, a) => s + (a.cost || 0), 0))
const totalDepreciation = computed(() => assets.value.reduce((s, a) => s + (a.depreciation || 0), 0))

const filtered = computed(() => {
  if (!filterCat.value) return assets.value
  return assets.value.filter(a => a.category === filterCat.value)
})

function condPill(c) {
  if (!c || c === 'good' || c === 'excellent') return 'pill-green'
  if (c === 'fair') return 'pill-amber'
  return 'pill-red'
}
</script>

<style scoped>
.fa-kpi-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 14px; }
.fa-filters { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
.fa-pill { cursor: pointer; font-size: 10px; border: 1px solid var(--border); background: var(--white); color: var(--ink-mid); }
.fa-pill:hover { border-color: var(--ocean-mid); }
.fa-pill.active { background: var(--ocean-50); border-color: var(--ocean-mid); color: var(--ocean); }
.fa-table-hd {
  display: grid; grid-template-columns: 1fr 110px 100px 100px 110px 110px 90px;
  gap: 8px; padding: 7px 14px;
  background: var(--sand); border-bottom: 1px solid var(--border);
  font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: var(--ink-soft);
}
.fa-row {
  display: grid; grid-template-columns: 1fr 110px 100px 100px 110px 110px 90px;
  gap: 8px; padding: 9px 14px; align-items: center; font-size: 11px;
  border-bottom: 1px solid var(--border);
}
.fa-row:hover { background: var(--sand); }
.fa-row:last-child { border-bottom: none; }
.fa-asset-name { font-size: 12px; font-weight: 600; }
.fa-asset-sub  { font-size: 9px; color: var(--ink-soft); font-family: 'DM Mono', monospace; }
.fa-date { font-size: 10px; color: var(--ink-soft); }
.fa-cost, .fa-dep, .fa-net { text-align: right; }
.fa-empty { padding: 40px; text-align: center; color: var(--ink-soft); font-size: 12px; }
</style>
