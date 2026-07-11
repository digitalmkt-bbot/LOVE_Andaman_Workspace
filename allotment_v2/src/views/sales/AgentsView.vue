<template>
  <div>
    <div class="page-hd">
      <div>
        <h1>Agents</h1>
        <p>รายชื่อ agent และตัวแทนการขายทั้งหมด</p>
      </div>
      <div class="page-actions">
        <input
          v-model="search"
          class="ag-search"
          placeholder="ค้นหาชื่อ agent…"
          type="search"
        />
      </div>
    </div>

    <!-- KPI strip -->
    <div class="ag-kpi-strip">
      <div class="ag-kpi-main">
        <div class="ag-kpi-sub">Agents</div>
        <div class="ag-kpi-big">
          <span class="ag-kpi-num">{{ agents.length }}</span>
          <span class="ag-kpi-unit">total</span>
          <span class="pill pill-green" style="align-self:center">{{ activeCount }} active</span>
        </div>
        <div class="ag-kpi-hint">{{ markets.length }} markets</div>
      </div>
      <div class="kpi">
        <div class="kpi-lbl">Active</div>
        <div class="kpi-val" style="color:var(--green)">{{ activeCount }}</div>
        <div class="kpi-sub">agents</div>
      </div>
      <div class="kpi">
        <div class="kpi-lbl">Inactive</div>
        <div class="kpi-val" style="color:var(--ink-soft)">{{ agents.length - activeCount }}</div>
        <div class="kpi-sub">agents</div>
      </div>
      <div class="kpi">
        <div class="kpi-lbl">Markets</div>
        <div class="kpi-val">{{ markets.length }}</div>
        <div class="kpi-sub">segments</div>
      </div>
    </div>

    <!-- Market filter pills -->
    <div class="ag-filters">
      <button
        class="pill ag-mkt-pill"
        :class="{ active: selectedMkt === null }"
        @click="selectedMkt = null"
      >All</button>
      <button
        v-for="m in markets"
        :key="m.id"
        class="pill ag-mkt-pill"
        :class="{ active: selectedMkt === m.id }"
        :style="selectedMkt === m.id ? { background: m.color, color: '#fff', borderColor: m.color } : {}"
        @click="selectedMkt = selectedMkt === m.id ? null : m.id"
      >{{ m.name }}</button>
    </div>

    <!-- Agent grid grouped A–Z -->
    <div v-if="!filteredGroups.length" class="ag-empty">ไม่พบ agent ที่ตรงกัน</div>

    <template v-for="grp in filteredGroups" :key="grp.letter">
      <div class="ag-letter-hd">{{ grp.letter }}</div>
      <div class="ag-grid">
        <div
          v-for="a in grp.items"
          :key="a.id"
          class="ag-card"
          :class="{ inactive: a.active === false }"
        >
          <div class="ag-avatar" :style="{ background: avatarBg(a) }">
            {{ agentInitials(a.name) }}
          </div>
          <div class="ag-info">
            <div class="ag-name">{{ a.name }}</div>
            <div class="ag-meta">
              <span v-if="a.market" class="pill ag-mkt-tag" :style="mktStyle(a.market)">
                {{ getMarket(a.market)?.name || a.market }}
              </span>
              <span v-if="a.active === false" class="pill pill-red" style="font-size:8px">Inactive</span>
            </div>
            <div v-if="a.phone" class="ag-contact">📞 {{ a.phone }}</div>
            <div v-if="a.email" class="ag-contact">✉ {{ a.email }}</div>
            <div v-if="a.line"  class="ag-contact">💬 {{ a.line }}</div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useAppData } from '../../composables/useAppData'

const { agents, markets, getMarket, agentInitials } = useAppData()

const search     = ref('')
const selectedMkt = ref(null)

const activeCount = computed(() => agents.value.filter(a => a.active !== false).length)

const filtered = computed(() => {
  let list = agents.value
  if (selectedMkt.value) list = list.filter(a => a.market === selectedMkt.value)
  if (search.value.trim()) {
    const q = search.value.trim().toLowerCase()
    list = list.filter(a =>
      (a.name || '').toLowerCase().includes(q) ||
      (a.phone || '').includes(q) ||
      (a.email || '').toLowerCase().includes(q)
    )
  }
  return list
})

const filteredGroups = computed(() => {
  const map = {}
  for (const a of filtered.value) {
    const letter = ((a.name || '#')[0]).toUpperCase()
    if (!map[letter]) map[letter] = []
    map[letter].push(a)
  }
  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([letter, items]) => ({ letter, items }))
})

function mktStyle(mktId) {
  const m = markets.value.find(x => x.id === mktId)
  if (!m) return {}
  return { background: m.color + '22', color: m.color, borderColor: m.color + '44' }
}

const AVATAR_PALETTE = ['#0F6E56','#185FA5','#C0392B','#8E44AD','#D48A14','#2980B9','#16A085','#7F8C8D']
function avatarBg(a) {
  const seed = (a.id || a.name || '').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return AVATAR_PALETTE[seed % AVATAR_PALETTE.length]
}
</script>

<style scoped>
.ag-search {
  padding: 6px 10px; border: 1px solid var(--border); border-radius: var(--r-sm);
  font-size: 12px; outline: none; background: var(--white);
  width: 200px;
}
.ag-search:focus { border-color: var(--ocean-mid); }

.ag-kpi-strip {
  display: grid;
  grid-template-columns: 1.6fr repeat(3, 0.85fr);
  gap: 10px;
  margin-bottom: 18px;
}
.ag-kpi-main { padding: 4px 0; }
.ag-kpi-sub  { font-size: 13px; font-weight: 500; color: var(--ink-soft); margin-bottom: 4px; }
.ag-kpi-big  { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; margin-bottom: 6px; }
.ag-kpi-num  { font-size: 42px; font-weight: 700; letter-spacing: -1.5px; line-height: 1; color: var(--ink); }
.ag-kpi-unit { font-size: 18px; color: var(--ink-soft); font-weight: 500; }
.ag-kpi-hint { font-size: 11px; color: var(--ink-soft); }

.ag-filters { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 18px; }
.ag-mkt-pill {
  cursor: pointer; font-size: 10px; font-weight: 500;
  border: 1px solid var(--border); background: var(--white);
  color: var(--ink-mid); transition: all .12s;
}
.ag-mkt-pill:hover { border-color: var(--ocean-mid); color: var(--ocean); }
.ag-mkt-pill.active { background: var(--ocean-50); border-color: var(--ocean-mid); color: var(--ocean); }

.ag-letter-hd {
  font-size: 11px; font-weight: 700; color: var(--ink-soft);
  margin: 16px 0 8px; padding-bottom: 4px;
  border-bottom: 1px solid var(--border);
}

.ag-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 10px;
  margin-bottom: 4px;
}

.ag-card {
  background: var(--white); border: 1px solid var(--border); border-radius: var(--r);
  padding: 12px 14px; display: flex; gap: 12px; align-items: flex-start;
  transition: box-shadow .12s;
}
.ag-card:hover { box-shadow: 0 2px 8px rgba(0,0,0,.06); }
.ag-card.inactive { opacity: .55; }

.ag-avatar {
  width: 36px; height: 36px; border-radius: 50%; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  font-size: 12px; font-weight: 700; color: #fff; letter-spacing: .02em;
}

.ag-info { flex: 1; min-width: 0; }
.ag-name { font-size: 12px; font-weight: 600; color: var(--ink); margin-bottom: 4px; }
.ag-meta { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 4px; }
.ag-mkt-tag {
  font-size: 9px; font-weight: 600; border: 1px solid transparent;
  padding: 2px 6px;
}
.ag-contact { font-size: 10px; color: var(--ink-soft); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.ag-empty { padding: 40px 0; text-align: center; color: var(--ink-soft); font-size: 12px; }
</style>
