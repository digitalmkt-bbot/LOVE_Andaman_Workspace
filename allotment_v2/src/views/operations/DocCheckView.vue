<template>
  <div>
    <div class="page-hd">
      <div>
        <h1>Doc Check</h1>
        <p>ตรวจสอบเอกสาร — passport, visa, voucher</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-ghost btn-sm" @click="prevDay">← ก่อนหน้า</button>
        <button class="btn btn-ghost btn-sm" @click="goToday">วันนี้</button>
        <button class="btn btn-ghost btn-sm" @click="nextDay">ถัดไป →</button>
      </div>
    </div>

    <div class="dc-date-bar">
      <span class="dc-date-lbl">{{ dateLabelFull }}</span>
      <span v-if="dateStr === TODAY" class="pill pill-green">Today</span>
    </div>

    <div class="dc-kpi-row">
      <div class="kpi">
        <div class="kpi-lbl">Bookings</div>
        <div class="kpi-val">{{ dayBk.length }}</div>
        <div class="kpi-sub">today</div>
      </div>
      <div class="kpi k-green">
        <div class="kpi-lbl">Docs OK</div>
        <div class="kpi-val" style="color:var(--green)">{{ docsOk }}</div>
        <div class="kpi-sub">verified</div>
      </div>
      <div class="kpi k-coral">
        <div class="kpi-lbl">Pending</div>
        <div class="kpi-val" style="color:var(--red)">{{ docsPending }}</div>
        <div class="kpi-sub">need check</div>
      </div>
      <div class="kpi">
        <div class="kpi-lbl">Total Pax</div>
        <div class="kpi-val">{{ totalPax }}</div>
        <div class="kpi-sub">passengers</div>
      </div>
    </div>

    <div v-if="!dayBk.length" class="dc-empty card">ไม่มี booking วันนี้</div>

    <template v-for="grp in byRoute" :key="grp.routeId">
      <div class="dc-route-hd">
        <div class="dc-route-dot" :style="{ background: grp.color }"></div>
        <span class="dc-route-name">{{ grp.routeName }}</span>
        <span class="pill pill-blue" style="font-size:9px">{{ grp.items.length }} bk</span>
        <span class="dc-route-pax">{{ grp.pax }} pax</span>
        <span class="pill" :class="grp.allOk ? 'pill-green' : 'pill-amber'">
          {{ grp.allOk ? '✓ All OK' : `${grp.okCount}/${grp.items.length} verified` }}
        </span>
      </div>

      <div class="card dc-card">
        <div class="dc-table-hd">
          <span>Ref</span><span>Agent</span><span>Pax</span><span>Passport</span><span>Visa</span><span>Voucher</span><span>Note</span>
        </div>
        <div v-for="b in grp.items" :key="b.id" class="dc-row" :class="{ 'dc-ok': b.docsOk }">
          <span class="dc-ref">{{ b.ref || b.id }}</span>
          <span>{{ b.agent || '—' }}</span>
          <span class="dc-pax">{{ b.pax || '—' }}</span>
          <span><span class="pill" :class="b.passportOk ? 'pill-green' : 'pill-red'">{{ b.passportOk ? '✓' : '✗' }}</span></span>
          <span><span class="pill" :class="b.visaOk !== false ? 'pill-green' : 'pill-red'">{{ b.visaOk !== false ? '✓' : '✗' }}</span></span>
          <span><span class="pill" :class="b.voucherOk ? 'pill-green' : 'pill-amber'">{{ b.voucherOk ? '✓' : '?' }}</span></span>
          <span class="dc-note">{{ b.docNote || '' }}</span>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useAppData } from '../../composables/useAppData'

const { bookings, getRoute, TODAY } = useAppData()

const dateObj = ref(new Date())
const dateStr = computed(() => dateObj.value.toISOString().slice(0, 10))
const dateLabelFull = computed(() =>
  dateObj.value.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
)
function prevDay() { dateObj.value = new Date(dateObj.value.getTime() - 86400000) }
function nextDay() { dateObj.value = new Date(dateObj.value.getTime() + 86400000) }
function goToday()  { dateObj.value = new Date() }

const dayBk = computed(() => bookings.value.filter(b => b.date === dateStr.value && b.status !== 'cancelled'))
const docsOk    = computed(() => dayBk.value.filter(b => b.docsOk).length)
const docsPending = computed(() => dayBk.value.length - docsOk.value)
const totalPax  = computed(() => dayBk.value.reduce((s, b) => s + (b.pax || 0), 0))

const byRoute = computed(() => {
  const map = {}
  for (const b of dayBk.value) {
    const rid = b.route || '__none__'
    if (!map[rid]) { const r = getRoute(rid); map[rid] = { routeId: rid, routeName: r?.name || rid, color: r?.color || '#aaa', items: [], pax: 0, okCount: 0 } }
    map[rid].items.push(b)
    map[rid].pax += b.pax || 0
    if (b.docsOk) map[rid].okCount++
  }
  return Object.values(map).map(g => ({ ...g, allOk: g.okCount === g.items.length }))
})
</script>

<style scoped>
.dc-date-bar { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; }
.dc-date-lbl { font-size: 15px; font-weight: 600; }
.dc-kpi-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 16px; }
.dc-route-hd { display: flex; align-items: center; gap: 10px; padding: 8px 0; margin-top: 12px; margin-bottom: 6px; border-bottom: 1px solid var(--border); }
.dc-route-dot { width: 10px; height: 10px; border-radius: 50%; }
.dc-route-name { font-size: 13px; font-weight: 700; flex: 1; }
.dc-route-pax  { font-size: 11px; color: var(--ink-soft); }
.dc-card { padding: 0; overflow: hidden; }
.dc-table-hd {
  display: grid; grid-template-columns: 90px 1fr 44px 80px 70px 80px 1fr;
  gap: 8px; padding: 7px 14px;
  background: var(--sand); border-bottom: 1px solid var(--border);
  font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: var(--ink-soft);
}
.dc-row {
  display: grid; grid-template-columns: 90px 1fr 44px 80px 70px 80px 1fr;
  gap: 8px; padding: 8px 14px; align-items: center; font-size: 11px;
  border-bottom: 1px solid var(--border);
}
.dc-row:last-child { border-bottom: none; }
.dc-row:hover { background: var(--sand); }
.dc-row.dc-ok  { background: #f6fdf9; }
.dc-ref  { font-family: 'DM Mono', monospace; font-size: 10px; font-weight: 600; }
.dc-pax  { font-weight: 700; text-align: center; }
.dc-note { color: var(--ink-soft); font-size: 10px; }
.dc-empty { padding: 40px; text-align: center; color: var(--ink-soft); font-size: 12px; }
</style>
