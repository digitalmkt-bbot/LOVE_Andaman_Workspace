<template>
  <div>
    <div class="page-hd">
      <div>
        <h1>Add-on Services</h1>
        <p>บริการเสริม — ห้องพัก, ทริปพิเศษ, อาหาร</p>
      </div>
    </div>

    <div class="as-kpi-row">
      <div class="kpi">
        <div class="kpi-lbl">Add-ons</div>
        <div class="kpi-val">{{ addons.length }}</div>
        <div class="kpi-sub">services</div>
      </div>
      <div class="kpi k-green">
        <div class="kpi-lbl">Active</div>
        <div class="kpi-val" style="color:var(--green)">{{ addons.filter(a => a.active !== false).length }}</div>
        <div class="kpi-sub">available</div>
      </div>
      <div class="kpi">
        <div class="kpi-lbl">Categories</div>
        <div class="kpi-val">{{ categories.length }}</div>
        <div class="kpi-sub">types</div>
      </div>
    </div>

    <!-- Category filter -->
    <div class="as-filters">
      <button class="pill as-pill" :class="{ active: !filterCat }" @click="filterCat = ''">All</button>
      <button v-for="c in categories" :key="c" class="pill as-pill" :class="{ active: filterCat === c }" @click="filterCat = filterCat === c ? '' : c">{{ c }}</button>
    </div>

    <div class="as-grid">
      <div v-for="a in filtered" :key="a.id" class="as-card" :class="{ inactive: a.active === false }">
        <div class="as-card-top">
          <div class="as-name">{{ a.name }}</div>
          <span class="pill" :class="a.active !== false ? 'pill-green' : 'pill-gray'">{{ a.active !== false ? 'Active' : 'Off' }}</span>
        </div>
        <div v-if="a.category" class="as-cat">
          <span class="pill pill-blue" style="font-size:9px">{{ a.category }}</span>
        </div>
        <div v-if="a.price" class="as-price">฿{{ fmtTHB(a.price) }}<span class="as-per"> /{{ a.per || 'pax' }}</span></div>
        <div v-if="a.desc" class="as-desc">{{ a.desc }}</div>
        <div v-if="a.routes?.length" class="as-routes">
          <span v-for="rid in a.routes" :key="rid" class="pill" style="font-size:9px;background:var(--sand)">
            {{ getRoute(rid)?.name || rid }}
          </span>
        </div>
      </div>
      <div v-if="!filtered.length" class="as-empty">ยังไม่มี add-on service</div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useAppStore } from '../../store/app'
import { useAppData } from '../../composables/useAppData'

const store = useAppStore()
const { getRoute, fmtTHB } = useAppData()

const filterCat = ref('')
const addons = computed(() => store.state?.addon_services || store.state?.addons || [])
const categories = computed(() => [...new Set(addons.value.map(a => a.category).filter(Boolean))].sort())

const filtered = computed(() => {
  if (!filterCat.value) return addons.value
  return addons.value.filter(a => a.category === filterCat.value)
})
</script>

<style scoped>
.as-kpi-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 14px; }
.as-filters { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 14px; }
.as-pill { cursor: pointer; font-size: 10px; border: 1px solid var(--border); background: var(--white); color: var(--ink-mid); }
.as-pill:hover { border-color: var(--ocean-mid); }
.as-pill.active { background: var(--ocean-50); border-color: var(--ocean-mid); color: var(--ocean); }
.as-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; }
.as-card {
  background: var(--white); border: 1px solid var(--border); border-radius: var(--r);
  padding: 14px; display: flex; flex-direction: column; gap: 8px;
}
.as-card:hover { box-shadow: 0 2px 8px rgba(0,0,0,.06); }
.as-card.inactive { opacity: .6; }
.as-card-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
.as-name { font-size: 13px; font-weight: 700; }
.as-cat  { }
.as-price { font-size: 16px; font-weight: 700; color: var(--green); }
.as-per  { font-size: 11px; color: var(--ink-soft); font-weight: 400; }
.as-desc { font-size: 11px; color: var(--ink-soft); }
.as-routes { display: flex; flex-wrap: wrap; gap: 4px; }
.as-empty { grid-column: 1/-1; text-align: center; color: var(--ink-soft); font-size: 12px; padding: 40px; }
</style>
