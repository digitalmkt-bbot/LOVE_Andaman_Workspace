<template>
  <div>
    <div class="page-hd">
      <div>
        <h1>Insurance</html>
        <p>กรมธรรม์ประกันภัยและการคุ้มครองผู้โดยสาร</p>
      </div>
      <div class="page-actions">
        <input v-model="search" class="ins-search" type="search" placeholder="ค้นหา ref, boat…" />
      </div>
    </div>

    <div class="ins-kpi-row">
      <div class="kpi k-green">
        <div class="kpi-lbl">Active Policies</div>
        <div class="kpi-val" style="color:var(--green)">{{ activePolicies }}</div>
        <div class="kpi-sub">in force</div>
      </div>
      <div class="kpi k-coral">
        <div class="kpi-lbl">Expiring Soon</div>
        <div class="kpi-val" style="color:var(--red)">{{ expiringSoon }}</div>
        <div class="kpi-sub">within 30 days</div>
      </div>
      <div class="kpi">
        <div class="kpi-lbl">Expired</div>
        <div class="kpi-val" style="color:var(--ink-soft)">{{ expired }}</div>
        <div class="kpi-sub">policies</div>
      </div>
      <div class="kpi">
        <div class="kpi-lbl">Total</div>
        <div class="kpi-val">{{ policies.length }}</div>
        <div class="kpi-sub">policies</div>
      </div>
    </div>

    <div class="card" style="padding:0;overflow:hidden">
      <div class="ins-table-hd">
        <span>Policy No.</span><span>Type</span><span>Boat / Asset</span><span>Insurer</span><span>From</span><span>To</span><span>Premium</span><span>Status</span>
      </div>
      <div v-if="!filtered.length" class="ins-empty">ไม่มีข้อมูลกรมธรรม์</div>
      <div v-for="p in filtered" :key="p.id" class="ins-row" :class="policyRowClass(p)">
        <span class="ins-ref">{{ p.policyNo || p.id }}</span>
        <span>{{ p.type || '—' }}</span>
        <span>{{ p.boat || p.asset || '—' }}</span>
        <span>{{ p.insurer || '—' }}</span>
        <span class="ins-date">{{ fmtDate(p.from) }}</span>
        <span class="ins-date" :style="expiryStyle(p)">{{ fmtDate(p.to) }}</span>
        <span class="ins-thb">฿{{ fmtTHB(p.premium || 0) }}</span>
        <span><span class="pill" :class="policyPill(p)">{{ policyStatus(p) }}</span></span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useAppStore } from '../../store/app'
import { useAppData } from '../../composables/useAppData'

const store = useAppStore()
const { fmtDate, fmtTHB, TODAY } = useAppData()

const search = ref('')
const in30 = new Date(new Date(TODAY).getTime() + 30 * 86400000).toISOString().slice(0, 10)

const policies = computed(() => store.state?.insurance || store.state?.policies || [])
const filtered = computed(() => {
  if (!search.value.trim()) return policies.value
  const q = search.value.toLowerCase()
  return policies.value.filter(p =>
    (p.policyNo || '').toLowerCase().includes(q) ||
    (p.boat || '').toLowerCase().includes(q) ||
    (p.insurer || '').toLowerCase().includes(q)
  )
})

const activePolicies = computed(() => policies.value.filter(p => p.to >= TODAY).length)
const expiringSoon   = computed(() => policies.value.filter(p => p.to >= TODAY && p.to <= in30).length)
const expired        = computed(() => policies.value.filter(p => p.to < TODAY).length)

function policyStatus(p) {
  if (p.to < TODAY) return 'Expired'
  if (p.to <= in30)  return 'Expiring'
  return 'Active'
}
function policyPill(p) {
  const s = policyStatus(p)
  if (s === 'Active')   return 'pill-green'
  if (s === 'Expiring') return 'pill-amber'
  return 'pill-red'
}
function policyRowClass(p) {
  if (p.to < TODAY) return 'ins-expired'
  if (p.to <= in30)  return 'ins-expiring'
  return ''
}
function expiryStyle(p) {
  if (p.to < TODAY) return { color: 'var(--red)', fontWeight: 700 }
  if (p.to <= in30)  return { color: 'var(--amber)', fontWeight: 700 }
  return {}
}
</script>

<style scoped>
.ins-search { padding: 6px 10px; border: 1px solid var(--border); border-radius: var(--r-sm); font-size: 12px; outline: none; width: 200px; }
.ins-kpi-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 14px; }
.ins-table-hd {
  display: grid; grid-template-columns: 130px 110px 130px 130px 90px 90px 100px 90px;
  gap: 8px; padding: 8px 14px;
  background: var(--sand); border-bottom: 1px solid var(--border);
  font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: var(--ink-soft);
}
.ins-row {
  display: grid; grid-template-columns: 130px 110px 130px 130px 90px 90px 100px 90px;
  gap: 8px; padding: 9px 14px; align-items: center; font-size: 11px;
  border-bottom: 1px solid var(--border);
}
.ins-row:hover { background: var(--sand); }
.ins-row:last-child { border-bottom: none; }
.ins-expired  { opacity: .6; background: #fff5f5; }
.ins-expiring { background: #fffbf0; }
.ins-ref  { font-family: 'DM Mono', monospace; font-size: 10px; font-weight: 600; }
.ins-date { font-size: 11px; }
.ins-thb  { font-weight: 600; text-align: right; }
.ins-empty { padding: 40px; text-align: center; color: var(--ink-soft); font-size: 12px; }
</style>
