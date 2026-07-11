<template>
  <div>
    <div class="page-hd">
      <div>
        <h1>Inventory</h1>
        <p>คลังสินค้าและอุปกรณ์กองเรือ</p>
      </div>
      <div class="page-actions">
        <input v-model="search" class="inv-search" type="search" placeholder="ค้นหา…" />
      </div>
    </div>

    <div class="inv-kpi-row">
      <div class="kpi">
        <div class="kpi-lbl">Items</div>
        <div class="kpi-val">{{ items.length }}</div>
        <div class="kpi-sub">total SKUs</div>
      </div>
      <div class="kpi k-coral">
        <div class="kpi-lbl">Low Stock</div>
        <div class="kpi-val" style="color:var(--red)">{{ lowStock }}</div>
        <div class="kpi-sub">below minimum</div>
      </div>
      <div class="kpi k-green">
        <div class="kpi-lbl">OK</div>
        <div class="kpi-val" style="color:var(--green)">{{ items.length - lowStock }}</div>
        <div class="kpi-sub">items</div>
      </div>
      <div class="kpi">
        <div class="kpi-lbl">Categories</div>
        <div class="kpi-val">{{ categories.length }}</div>
        <div class="kpi-sub">types</div>
      </div>
    </div>

    <!-- Category filter -->
    <div class="inv-filters">
      <button class="pill inv-pill" :class="{ active: !filterCat }" @click="filterCat = ''">All</button>
      <button v-for="c in categories" :key="c" class="pill inv-pill" :class="{ active: filterCat === c }" @click="filterCat = filterCat === c ? '' : c">{{ c }}</button>
    </div>

    <div class="card" style="padding:0;overflow:hidden">
      <div class="inv-table-hd">
        <span>Item</span><span>Category</span><span>Unit</span><span>Stock</span><span>Min</span><span>Location</span><span>Status</span>
      </div>
      <div v-if="!filtered.length" class="inv-empty">ยังไม่มีข้อมูล inventory</div>
      <div v-for="item in filtered" :key="item.id" class="inv-row" :class="{ 'inv-low': isLow(item) }">
        <span class="inv-name">{{ item.name }}</span>
        <span><span class="pill pill-blue" style="font-size:9px">{{ item.category || '—' }}</span></span>
        <span>{{ item.unit || 'pcs' }}</span>
        <span class="inv-stock" :style="{ color: isLow(item) ? 'var(--red)' : 'var(--green)', fontWeight: 700 }">{{ item.stock ?? '—' }}</span>
        <span class="inv-min">{{ item.min ?? '—' }}</span>
        <span>{{ item.location || '—' }}</span>
        <span><span class="pill" :class="isLow(item) ? 'pill-red' : 'pill-green'">{{ isLow(item) ? 'Low' : 'OK' }}</span></span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useAppStore } from '../../store/app'

const store  = useAppStore()
const search = ref('')
const filterCat = ref('')

const items      = computed(() => store.state?.inventory || store.state?.fl_inventory || [])
const categories = computed(() => [...new Set(items.value.map(i => i.category).filter(Boolean))].sort())
const lowStock   = computed(() => items.value.filter(i => isLow(i)).length)

function isLow(item) { return item.min != null && item.stock != null && item.stock < item.min }

const filtered = computed(() => {
  let list = items.value
  if (filterCat.value) list = list.filter(i => i.category === filterCat.value)
  if (search.value.trim()) { const q = search.value.toLowerCase(); list = list.filter(i => (i.name || '').toLowerCase().includes(q)) }
  return list
})
</script>

<style scoped>
.inv-search { padding: 6px 10px; border: 1px solid var(--border); border-radius: var(--r-sm); font-size: 12px; outline: none; width: 180px; }
.inv-kpi-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 14px; }
.inv-filters { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
.inv-pill { cursor: pointer; font-size: 10px; border: 1px solid var(--border); background: var(--white); color: var(--ink-mid); }
.inv-pill:hover { border-color: var(--ocean-mid); }
.inv-pill.active { background: var(--ocean-50); border-color: var(--ocean-mid); color: var(--ocean); }
.inv-table-hd {
  display: grid; grid-template-columns: 1fr 110px 70px 70px 60px 120px 70px;
  gap: 8px; padding: 7px 14px;
  background: var(--sand); border-bottom: 1px solid var(--border);
  font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: var(--ink-soft);
}
.inv-row {
  display: grid; grid-template-columns: 1fr 110px 70px 70px 60px 120px 70px;
  gap: 8px; padding: 9px 14px; align-items: center; font-size: 11px;
  border-bottom: 1px solid var(--border);
}
.inv-row:hover { background: var(--sand); }
.inv-row:last-child { border-bottom: none; }
.inv-row.inv-low { background: #fff5f5; }
.inv-name  { font-weight: 600; }
.inv-stock { text-align: center; }
.inv-min   { text-align: center; color: var(--ink-soft); }
.inv-empty { padding: 40px; text-align: center; color: var(--ink-soft); font-size: 12px; }
</style>
