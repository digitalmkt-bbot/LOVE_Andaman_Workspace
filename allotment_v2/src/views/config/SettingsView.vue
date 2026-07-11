<template>
  <div>
    <div class="page-hd">
      <div>
        <h1>Programs</h1>
        <p>โปรแกรมทัวร์ทั้งหมด · จัดการ route, pier และ season</p>
      </div>
    </div>

    <!-- KPI strip -->
    <div class="prog-kpi-strip">
      <div class="prog-kpi-main">
        <div class="prog-kpi-sub">Programs</div>
        <div class="prog-kpi-big">
          <span class="prog-kpi-num">{{ routes.length }}</span>
          <span class="prog-kpi-unit">routes</span>
          <span class="pill pill-green" style="align-self:center">▴ {{ openToday }} เปิดวันนี้</span>
        </div>
        <div class="prog-kpi-hint">{{ tlCount }} Tub Lamu · {{ vpCount }} Visit Panwa</div>
      </div>
      <div class="kpi k-green">
        <div class="kpi-lbl">Open Today</div>
        <div class="kpi-val" style="color:var(--green)">{{ openToday }}</div>
        <div class="kpi-sub">/ {{ routes.length }} · {{ routes.length ? Math.round(openToday/routes.length*100) : 0 }}% running</div>
      </div>
      <div class="kpi k-coral">
        <div class="kpi-lbl">Closed Today</div>
        <div class="kpi-val" style="color:var(--red)">{{ closedToday }}</div>
        <div class="kpi-sub">routes</div>
      </div>
      <div class="kpi">
        <div class="kpi-lbl">No Season Data</div>
        <div class="kpi-val" style="color:var(--ink-soft)">{{ noData }}</div>
        <div class="kpi-sub">no season set</div>
      </div>
    </div>

    <div class="prog-layout">
      <!-- Route list -->
      <div class="prog-list">
        <div class="prog-list-hd">
          <span style="font-size:13px;font-weight:600">โปรแกรมทั้งหมด</span>
          <span style="font-size:10px;color:var(--ink-soft)">{{ routes.length }} routes</span>
        </div>

        <template v-for="pier in ['tublamu', 'panwa']" :key="pier">
          <div class="prog-pier-hd">
            <div class="prog-pier-dot" :style="{ background: pierInfo[pier].accent }"></div>
            <div>
              <div style="font-size:12px;font-weight:600">{{ pierInfo[pier].label }}</div>
              <div style="font-size:10px;color:var(--ink-soft)">{{ byPier[pier].length }} programs</div>
            </div>
          </div>

          <div v-if="!byPier[pier].length" class="prog-empty-pier">ยังไม่มีโปรแกรม</div>

          <div
            v-for="r in byPier[pier]"
            :key="r.id"
            class="prog-row"
            :class="{ sel: selectedId === r.id }"
            @click="selectedId = r.id"
          >
            <div class="prog-row-bar" :style="{ background: r.color, opacity: isRouteActiveToday(r) ? 1 : 0.35 }"></div>
            <div class="prog-row-body">
              <div class="prog-row-top">
                <span class="prog-row-name" :style="!isRouteActiveToday(r) ? { color: 'var(--ink-soft)' } : {}">{{ r.name }}</span>
                <span class="pill" :class="statusPill(r)">{{ statusLabel(r) }}</span>
              </div>
              <div class="prog-row-sub">{{ r.islands || '—' }}</div>
              <div v-if="getRouteStatusNow(r)" class="prog-row-dates">
                {{ fmtDate(getRouteStatusNow(r).from) }} → {{ fmtDate(getRouteStatusNow(r).to) }}
              </div>
            </div>
          </div>
        </template>
      </div>

      <!-- Detail panel -->
      <div class="prog-detail">
        <div v-if="!selected" class="prog-detail-empty">เลือก route จากรายการเพื่อดูรายละเอียด</div>
        <template v-else>
          <div class="prog-detail-hd" :style="{ borderLeft: `4px solid ${selected.color}` }">
            <div class="prog-detail-name">{{ selected.name }}</div>
            <div class="prog-detail-sub">{{ selected.islands }} · {{ selected.pier }}</div>
          </div>

          <div class="prog-detail-section">Times</div>
          <div class="prog-times">
            <span v-for="t in (selected.times || [])" :key="t" class="pill pill-blue">{{ t }}</span>
          </div>

          <div class="prog-detail-section">Seasons</div>
          <div v-if="!(selected.seasons || []).length" style="font-size:12px;color:var(--ink-soft)">ยังไม่มี season</div>
          <table v-else class="prog-season-table">
            <thead><tr><th>From</th><th>To</th><th>Status</th></tr></thead>
            <tbody>
              <tr v-for="s in selected.seasons" :key="s.id">
                <td>{{ fmtDate(s.from) }}</td>
                <td>{{ fmtDate(s.to) }}</td>
                <td>
                  <span class="pill" :class="s.type === 'open' ? 'pill-green' : 'pill-red'">
                    {{ s.type === 'open' ? 'OPEN' : 'CLOSED' }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useAppData } from '../../composables/useAppData'

const { routes, getRouteStatusNow, isRouteActiveToday, fmtDate, TODAY } = useAppData()

const selectedId = ref(null)
const selected = computed(() => routes.value.find(r => r.id === selectedId.value) || null)

const openToday   = computed(() => routes.value.filter(r => isRouteActiveToday(r)).length)
const closedToday = computed(() => routes.value.filter(r => { const s = getRouteStatusNow(r); return s?.type === 'closed' }).length)
const noData      = computed(() => routes.value.length - openToday.value - closedToday.value)

const byPier = computed(() => ({
  tublamu: routes.value.filter(r => r.pier === 'tublamu'),
  panwa:   routes.value.filter(r => r.pier === 'panwa'),
}))
const tlCount = computed(() => byPier.value.tublamu.length)
const vpCount = computed(() => byPier.value.panwa.length)

const pierInfo = {
  tublamu: { label: 'Tub Lamu Pier', accent: '#0F6E56' },
  panwa:   { label: 'Visit Panwa',    accent: '#185FA5' },
}

function statusLabel(r) {
  const s = getRouteStatusNow(r)
  if (!s) return '—'
  return s.type === 'open' ? 'OPEN' : 'CLOSED'
}
function statusPill(r) {
  const s = getRouteStatusNow(r)
  if (!s) return 'pill-gray'
  return s.type === 'open' ? 'pill-green' : 'pill-red'
}
</script>

<style scoped>
.prog-kpi-strip {
  display: grid;
  grid-template-columns: 1.6fr repeat(3, 0.85fr);
  gap: 10px;
  margin-bottom: 18px;
}
.prog-kpi-main { padding: 4px 0; }
.prog-kpi-sub { font-size: 13px; font-weight: 500; color: var(--ink-soft); margin-bottom: 4px; }
.prog-kpi-big { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; margin-bottom: 6px; }
.prog-kpi-num { font-size: 42px; font-weight: 700; letter-spacing: -1.5px; line-height: 1; color: var(--ink); }
.prog-kpi-unit { font-size: 18px; color: var(--ink-soft); font-weight: 500; }
.prog-kpi-hint { font-size: 11px; color: var(--ink-soft); }

.prog-layout { display: grid; grid-template-columns: 380px 1fr; gap: 14px; align-items: start; }

.prog-list { background: var(--white); border: 1px solid var(--border); border-radius: var(--r); overflow: hidden; }
.prog-list-hd {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 14px; border-bottom: 1px solid var(--border);
}
.prog-pier-hd {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 14px 8px; background: var(--sand);
  border-bottom: 1px solid var(--border);
}
.prog-pier-dot { width: 28px; height: 28px; border-radius: 50%; background: var(--sand-dark); flex-shrink: 0; }
.prog-empty-pier {
  padding: 12px 14px; font-size: 11px; color: var(--ink-soft);
  border: 1px dashed var(--border); border-radius: var(--r-sm); margin: 8px;
  text-align: center;
}
.prog-row {
  display: flex; align-items: stretch; gap: 10px;
  padding: 10px 14px; cursor: pointer; transition: background .12s;
  border-bottom: 1px solid var(--border); border: 1px solid transparent;
}
.prog-row:last-child { border-bottom: none; }
.prog-row:hover { background: var(--sand); }
.prog-row.sel { background: var(--sand); border-color: var(--border); box-shadow: 0 0 0 2px rgba(26,26,26,.04); }
.prog-row-bar { width: 5px; border-radius: 3px; flex-shrink: 0; align-self: stretch; }
.prog-row-body { flex: 1; min-width: 0; }
.prog-row-top { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-bottom: 2px; }
.prog-row-name { font-size: 12px; font-weight: 600; }
.prog-row-sub { font-size: 10px; color: var(--ink-soft); }
.prog-row-dates { font-size: 9px; color: var(--ink-soft); font-family: 'DM Mono', monospace; margin-top: 2px; }

.prog-detail {
  background: var(--white); border: 1px solid var(--border); border-radius: var(--r);
  padding: 18px; min-height: 400px; position: sticky; top: 14px;
}
.prog-detail-empty { color: var(--ink-soft); font-size: 12px; padding: 40px 0; text-align: center; }
.prog-detail-hd { padding-left: 12px; margin-bottom: 16px; }
.prog-detail-name { font-size: 16px; font-weight: 700; color: var(--ink); }
.prog-detail-sub  { font-size: 11px; color: var(--ink-soft); margin-top: 2px; }
.prog-detail-section { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: var(--ink-soft); margin: 14px 0 6px; }
.prog-times { display: flex; flex-wrap: wrap; gap: 6px; }
.prog-season-table { font-size: 12px; }
</style>
