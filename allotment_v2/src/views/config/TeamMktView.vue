<template>
  <div>
    <div class="page-hd">
      <div>
        <h1>Team &amp; Markets</h1>
        <p>จัดการ market segment และทีมงาน</p>
      </div>
    </div>

    <div class="tm-layout">
      <!-- Markets -->
      <div>
        <div class="tm-section-hd">Market Segments ({{ markets.length }})</div>
        <div class="card tm-card">
          <div class="tm-table-hd">
            <span>Color</span>
            <span>ID</span>
            <span>Name</span>
            <span>Agents</span>
            <span>Bookings</span>
          </div>
          <div v-if="!markets.length" class="tm-empty">ยังไม่มี market</div>
          <div v-for="m in markets" :key="m.id" class="tm-row">
            <span>
              <span class="tm-color-swatch" :style="{ background: m.color }"></span>
            </span>
            <span class="tm-code">{{ m.id }}</span>
            <span class="tm-name">{{ m.name }}</span>
            <span class="tm-num">{{ agentsByMkt[m.id] || 0 }}</span>
            <span class="tm-num">{{ bkByMkt[m.id] || 0 }}</span>
          </div>
        </div>

        <!-- Market pills preview -->
        <div class="tm-section-hd" style="margin-top:18px">Preview</div>
        <div class="tm-pills-preview card">
          <span v-for="m in markets" :key="m.id" class="pill tm-preview-pill" :style="{ background: m.color + '22', color: m.color, borderColor: m.color + '55' }">
            {{ m.name }}
          </span>
        </div>
      </div>

      <!-- Team / users -->
      <div>
        <div class="tm-section-hd">Team Members ({{ teamMembers.length }})</div>
        <div class="card tm-card">
          <div class="tm-table-hd">
            <span>Avatar</span>
            <span>Name / Username</span>
            <span>Role</span>
            <span>Areas</span>
          </div>
          <div v-if="!teamMembers.length" class="tm-empty">ยังไม่มีข้อมูลทีมงาน</div>
          <div v-for="u in teamMembers" :key="u.id || u.username" class="tm-row tm-user-row">
            <div class="tm-avatar" :style="{ background: userColor(u) }">
              {{ userInitials(u) }}
            </div>
            <div class="tm-user-info">
              <div class="tm-user-name">{{ u.name || u.username }}</div>
              <div class="tm-user-sub">{{ u.username }}</div>
            </div>
            <span>
              <span class="pill" :class="u.role === 'admin' ? 'pill-red' : 'pill-blue'">
                {{ u.role || 'viewer' }}
              </span>
            </span>
            <span class="tm-areas">
              <template v-if="u.role === 'admin'">
                <span class="pill pill-gray" style="font-size:9px">All</span>
              </template>
              <template v-else-if="u.editAreas?.length">
                <span v-for="a in u.editAreas" :key="a" class="pill pill-gray" style="font-size:9px">{{ a }}</span>
              </template>
              <span v-else style="color:var(--ink-soft);font-size:11px">—</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useAppStore } from '../../store/app'
import { useAppData } from '../../composables/useAppData'

const store = useAppStore()
const { markets, agents, bookings } = useAppData()

const teamMembers = computed(() => store.state?.users || store.state?.team || [])

const agentsByMkt = computed(() => {
  const map = {}
  for (const a of agents.value) {
    const mid = a.market
    if (mid) map[mid] = (map[mid] || 0) + 1
  }
  return map
})

const bkByMkt = computed(() => {
  const map = {}
  for (const b of bookings.value) {
    const mid = b.market
    if (mid) map[mid] = (map[mid] || 0) + 1
  }
  return map
})

const PALETTE = ['#0F6E56','#185FA5','#C0392B','#8E44AD','#D48A14','#2980B9','#7F8C8D']
function userColor(u) {
  const seed = (u.username || u.name || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  return PALETTE[seed % PALETTE.length]
}
function userInitials(u) {
  const name = u.name || u.username || '?'
  const parts = name.split(/\s+/)
  return (parts.length >= 2 ? parts[0][0] + parts[1][0] : name.slice(0, 2)).toUpperCase()
}
</script>

<style scoped>
.tm-layout { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.tm-section-hd {
  font-size: 9px; font-weight: 700; text-transform: uppercase;
  letter-spacing: .05em; color: var(--ink-soft); margin-bottom: 8px;
}
.tm-card { padding: 0; overflow: hidden; }

.tm-table-hd {
  display: grid;
  grid-template-columns: 40px 80px 1fr 60px 70px;
  gap: 8px; padding: 7px 14px;
  background: var(--sand); border-bottom: 1px solid var(--border);
  font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: var(--ink-soft);
}
.tm-row {
  display: grid;
  grid-template-columns: 40px 80px 1fr 60px 70px;
  gap: 8px; padding: 9px 14px; align-items: center; font-size: 11px;
  border-bottom: 1px solid var(--border);
}
.tm-row:last-child { border-bottom: none; }
.tm-row:hover { background: var(--sand); }

.tm-color-swatch { display: inline-block; width: 20px; height: 20px; border-radius: 4px; }
.tm-code { font-family: 'DM Mono', monospace; font-size: 10px; font-weight: 700; }
.tm-name { font-weight: 500; }
.tm-num  { text-align: right; font-weight: 600; color: var(--ink-mid); }
.tm-empty { padding: 24px 14px; font-size: 12px; color: var(--ink-soft); }

/* User rows override grid */
.tm-user-row { grid-template-columns: 36px 1fr 80px 1fr; }
.tm-avatar {
  width: 32px; height: 32px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 11px; font-weight: 700; color: #fff; flex-shrink: 0;
}
.tm-user-info { min-width: 0; }
.tm-user-name { font-size: 12px; font-weight: 600; }
.tm-user-sub  { font-size: 9px; color: var(--ink-soft); font-family: 'DM Mono', monospace; }
.tm-areas { display: flex; flex-wrap: wrap; gap: 4px; }

.tm-pills-preview { padding: 14px; display: flex; flex-wrap: wrap; gap: 8px; }
.tm-preview-pill { font-size: 11px; font-weight: 600; border: 1px solid transparent; }
</style>
