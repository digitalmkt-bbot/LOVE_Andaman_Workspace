<template>
  <div>
    <div class="page-hd">
      <div>
        <h1>Staff</h1>
        <p>ทีมงานขายและพนักงานประจำเรือ</p>
      </div>
      <div class="page-actions">
        <input v-model="search" class="st-search" type="search" placeholder="ค้นหาชื่อ…" />
      </div>
    </div>

    <div class="st-kpi-row">
      <div class="kpi">
        <div class="kpi-lbl">Total Staff</div>
        <div class="kpi-val">{{ staff.length }}</div>
        <div class="kpi-sub">members</div>
      </div>
      <div class="kpi k-green">
        <div class="kpi-lbl">Active</div>
        <div class="kpi-val" style="color:var(--green)">{{ staff.filter(s => s.active !== false).length }}</div>
        <div class="kpi-sub">staff</div>
      </div>
      <div class="kpi">
        <div class="kpi-lbl">Departments</div>
        <div class="kpi-val">{{ depts.length }}</div>
        <div class="kpi-sub">teams</div>
      </div>
    </div>

    <!-- Dept filter -->
    <div class="st-filters">
      <button class="pill st-pill" :class="{ active: !filterDept }" @click="filterDept = ''">All</button>
      <button v-for="d in depts" :key="d" class="pill st-pill" :class="{ active: filterDept === d }" @click="filterDept = filterDept === d ? '' : d">{{ d }}</button>
    </div>

    <div class="st-grid">
      <div v-for="s in filtered" :key="s.id" class="st-card" :class="{ inactive: s.active === false }">
        <div class="st-avatar" :style="{ background: avatarColor(s) }">{{ initials(s.name) }}</div>
        <div class="st-info">
          <div class="st-name">{{ s.name }}</div>
          <div class="st-meta">
            <span v-if="s.dept" class="pill pill-blue" style="font-size:9px">{{ s.dept }}</span>
            <span v-if="s.role" class="pill pill-gray" style="font-size:9px">{{ s.role }}</span>
            <span v-if="s.active === false" class="pill pill-red" style="font-size:9px">Inactive</span>
          </div>
          <div v-if="s.phone" class="st-contact">📞 {{ s.phone }}</div>
          <div v-if="s.line" class="st-contact">💬 {{ s.line }}</div>
        </div>
      </div>
      <div v-if="!filtered.length" class="st-empty">ไม่พบ staff</div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useAppStore } from '../../store/app'

const store = useAppStore()
const search = ref('')
const filterDept = ref('')

const staff = computed(() => store.state?.staff || store.state?.sb_staff || [])
const depts  = computed(() => [...new Set(staff.value.map(s => s.dept).filter(Boolean))].sort())

const filtered = computed(() => {
  let list = staff.value
  if (filterDept.value) list = list.filter(s => s.dept === filterDept.value)
  if (search.value.trim()) {
    const q = search.value.toLowerCase()
    list = list.filter(s => (s.name || '').toLowerCase().includes(q) || (s.role || '').toLowerCase().includes(q))
  }
  return list
})

const PALETTE = ['#0F6E56','#185FA5','#C0392B','#8E44AD','#D48A14','#7F8C8D']
function avatarColor(s) {
  const seed = (s.id || s.name || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  return PALETTE[seed % PALETTE.length]
}
function initials(name) {
  const p = (name || '').split(/\s+/)
  return (p.length >= 2 ? p[0][0] + p[1][0] : (name || '??').slice(0, 2)).toUpperCase()
}
</script>

<style scoped>
.st-search { padding: 6px 10px; border: 1px solid var(--border); border-radius: var(--r-sm); font-size: 12px; outline: none; width: 180px; }
.st-kpi-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 14px; }
.st-filters { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 14px; }
.st-pill { cursor: pointer; font-size: 10px; font-weight: 500; border: 1px solid var(--border); background: var(--white); color: var(--ink-mid); }
.st-pill:hover { border-color: var(--ocean-mid); }
.st-pill.active { background: var(--ocean-50); border-color: var(--ocean-mid); color: var(--ocean); }
.st-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px; }
.st-card {
  background: var(--white); border: 1px solid var(--border); border-radius: var(--r);
  padding: 12px 14px; display: flex; gap: 12px;
}
.st-card:hover { box-shadow: 0 2px 8px rgba(0,0,0,.06); }
.st-card.inactive { opacity: .55; }
.st-avatar {
  width: 36px; height: 36px; border-radius: 50%; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  font-size: 12px; font-weight: 700; color: #fff;
}
.st-info { flex: 1; min-width: 0; }
.st-name { font-size: 12px; font-weight: 600; margin-bottom: 4px; }
.st-meta { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 4px; }
.st-contact { font-size: 10px; color: var(--ink-soft); }
.st-empty { grid-column: 1/-1; text-align: center; color: var(--ink-soft); font-size: 12px; padding: 40px; }
</style>
