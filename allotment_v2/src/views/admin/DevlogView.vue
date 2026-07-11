<template>
  <div>
    <div class="page-hd">
      <div>
        <h1>Dev Log</h1>
        <p>บันทึก sync, errors และ server events</p>
      </div>
      <div class="page-actions">
        <select v-model="filterType" class="dl-select">
          <option value="">All Types</option>
          <option value="sync">Sync</option>
          <option value="error">Error</option>
          <option value="sse">SSE</option>
          <option value="auth">Auth</option>
          <option value="info">Info</option>
        </select>
        <button class="btn btn-ghost btn-sm" @click="clearLog">Clear</button>
      </div>
    </div>

    <!-- Store state summary -->
    <div class="dl-state-strip">
      <div class="dl-state-item">
        <span class="dl-state-lbl">Version</span>
        <span class="dl-state-val">{{ store.version }}</span>
      </div>
      <div class="dl-state-item">
        <span class="dl-state-lbl">Last by</span>
        <span class="dl-state-val">{{ store.lastBy || '—' }}</span>
      </div>
      <div class="dl-state-item">
        <span class="dl-state-lbl">Dirty</span>
        <span class="dl-state-val" :style="{ color: store.dirty ? 'var(--amber)' : 'var(--green)' }">{{ store.dirty ? 'Yes' : 'No' }}</span>
      </div>
      <div class="dl-state-item">
        <span class="dl-state-lbl">User</span>
        <span class="dl-state-val">{{ store.me?.username || '—' }} ({{ store.me?.role || '—' }})</span>
      </div>
      <div class="dl-state-item">
        <span class="dl-state-lbl">Routes</span>
        <span class="dl-state-val">{{ store.state?.routes?.length ?? '—' }}</span>
      </div>
      <div class="dl-state-item">
        <span class="dl-state-lbl">Boats</span>
        <span class="dl-state-val">{{ store.state?.boats?.length ?? '—' }}</span>
      </div>
      <div class="dl-state-item">
        <span class="dl-state-lbl">Bookings</span>
        <span class="dl-state-val">{{ store.state?.sb_bookings?.length ?? '—' }}</span>
      </div>
      <div class="dl-state-item">
        <span class="dl-state-lbl">Agents</span>
        <span class="dl-state-val">{{ store.state?.sb_agents?.length ?? '—' }}</span>
      </div>
    </div>

    <!-- Save error banner -->
    <div v-if="store.saveError" class="dl-save-error">
      <span class="pill pill-red">{{ store.saveError.type }}</span>
      {{ store.saveError.msg }}
      <button class="btn btn-ghost btn-sm" @click="store.clearSaveError()">Dismiss</button>
    </div>

    <!-- Event log -->
    <div class="card dl-log-card">
      <div class="dl-log-hd">
        <span>Event Log</span>
        <span class="dl-log-count">{{ filtered.length }} entries</span>
      </div>
      <div v-if="!filtered.length" class="dl-log-empty">No events yet · sync or navigate to generate logs</div>
      <div v-for="(entry, i) in filtered" :key="i" class="dl-entry" :class="`dl-${entry.type}`">
        <span class="dl-entry-time">{{ entry.time }}</span>
        <span class="pill dl-entry-type" :class="typePill(entry.type)">{{ entry.type }}</span>
        <span class="dl-entry-msg">{{ entry.msg }}</span>
        <span v-if="entry.detail" class="dl-entry-detail">{{ entry.detail }}</span>
      </div>
    </div>

    <!-- Raw state inspector -->
    <div class="card dl-state-card" style="margin-top:14px">
      <div class="dl-log-hd">
        <span>State Inspector</span>
        <div class="dl-tabs">
          <button v-for="t in stateTabs" :key="t" class="dl-tab" :class="{ active: activeTab === t }" @click="activeTab = t">{{ t }}</button>
        </div>
      </div>
      <pre class="dl-json">{{ stateView }}</pre>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useAppStore } from '../../store/app'

const store = useAppStore()

const filterType = ref('')
const activeTab  = ref('meta')

const stateTabs = ['meta', 'routes', 'boats', 'trips (today)', 'agents', 'bookings']

const TODAY = new Date().toISOString().slice(0, 10)

const stateView = computed(() => {
  const s = store.state
  if (!s) return 'No state loaded'
  try {
    if (activeTab.value === 'meta')
      return JSON.stringify({ version: store.version, lastBy: store.lastBy, dirty: store.dirty, me: store.me }, null, 2)
    if (activeTab.value === 'routes')
      return JSON.stringify(s.routes?.slice(0, 5) || [], null, 2) + (s.routes?.length > 5 ? `\n... +${s.routes.length - 5} more` : '')
    if (activeTab.value === 'boats')
      return JSON.stringify(s.boats?.slice(0, 5) || [], null, 2) + (s.boats?.length > 5 ? `\n... +${s.boats.length - 5} more` : '')
    if (activeTab.value === 'trips (today)')
      return JSON.stringify(s.trips?.[TODAY] || {}, null, 2)
    if (activeTab.value === 'agents')
      return JSON.stringify(s.sb_agents?.slice(0, 5) || [], null, 2) + (s.sb_agents?.length > 5 ? `\n... +${s.sb_agents.length - 5} more` : '')
    if (activeTab.value === 'bookings')
      return JSON.stringify(s.sb_bookings?.slice(0, 5) || [], null, 2) + (s.sb_bookings?.length > 5 ? `\n... +${s.sb_bookings.length - 5} more` : '')
  } catch { return 'Error serializing state' }
  return ''
})

// In-memory log (module level so survives navigation)
const log = ref([])

function addLog(type, msg, detail) {
  log.value.unshift({ type, msg, detail: detail || '', time: new Date().toLocaleTimeString('en-GB') })
  if (log.value.length > 200) log.value.pop()
}

function clearLog() { log.value = [] }

const filtered = computed(() => {
  if (!filterType.value) return log.value
  return log.value.filter(e => e.type === filterType.value)
})

function typePill(t) {
  if (t === 'error') return 'pill-red'
  if (t === 'sync')  return 'pill-green'
  if (t === 'auth')  return 'pill-amber'
  return 'pill-blue'
}
</script>

<style scoped>
.dl-state-strip {
  display: flex; flex-wrap: wrap; gap: 10px;
  padding: 12px 16px; background: var(--white);
  border: 1px solid var(--border); border-radius: var(--r);
  margin-bottom: 14px;
}
.dl-state-item { display: flex; flex-direction: column; gap: 2px; min-width: 80px; }
.dl-state-lbl  { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: var(--ink-soft); }
.dl-state-val  { font-size: 12px; font-weight: 600; font-family: 'DM Mono', monospace; }

.dl-save-error {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 14px; background: #fff5f5; border: 1px solid #fcc;
  border-radius: var(--r); margin-bottom: 12px; font-size: 12px;
}

.dl-select { padding: 6px 10px; border: 1px solid var(--border); border-radius: var(--r-sm); font-size: 12px; background: var(--white); outline: none; }

.dl-log-card { padding: 0; overflow: hidden; }
.dl-log-hd {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 14px; background: var(--sand); border-bottom: 1px solid var(--border);
  font-size: 12px; font-weight: 600;
}
.dl-log-count { font-size: 10px; color: var(--ink-soft); font-weight: 400; }
.dl-log-empty { padding: 32px; text-align: center; color: var(--ink-soft); font-size: 12px; }

.dl-entry {
  display: flex; align-items: baseline; gap: 10px;
  padding: 7px 14px; border-bottom: 1px solid var(--border); font-size: 11px;
}
.dl-entry:last-child { border-bottom: none; }
.dl-entry:hover { background: var(--sand); }
.dl-error { background: #fff5f5; }
.dl-entry-time   { font-family: 'DM Mono', monospace; font-size: 10px; color: var(--ink-soft); flex-shrink: 0; }
.dl-entry-type   { flex-shrink: 0; }
.dl-entry-msg    { flex: 1; font-weight: 500; }
.dl-entry-detail { font-size: 10px; color: var(--ink-soft); max-width: 300px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.dl-state-card { padding: 0; overflow: hidden; }
.dl-tabs { display: flex; gap: 0; }
.dl-tab {
  padding: 4px 10px; font-size: 11px; cursor: pointer;
  border: none; background: none; color: var(--ink-soft);
  border-bottom: 2px solid transparent;
}
.dl-tab:hover { color: var(--ink); }
.dl-tab.active { color: var(--ocean-mid); border-bottom-color: var(--ocean-mid); font-weight: 600; }
.dl-json {
  font-family: 'DM Mono', monospace; font-size: 10px; line-height: 1.6;
  color: var(--ink-mid); background: var(--sand); padding: 14px;
  margin: 0; max-height: 400px; overflow-y: auto; white-space: pre-wrap;
}
</style>
