/**
 * Shared data helpers — ports the global helper functions from allotment_v2.html
 * into reactive computed refs that read from the Pinia store.
 */
import { computed } from 'vue'
import { useAppStore } from '../store/app'

const TODAY = new Date().toISOString().slice(0, 10)

const DEFAULT_MARKETS = [
  { id: 'ru',     name: 'Russian Market',       color: '#c43a2e' },
  { id: 'ota',    name: 'Online Travel Agent',   color: '#2196be' },
  { id: 'ap',     name: 'Asia Pacific',          color: '#d48a14' },
  { id: 'hpk',   name: 'Hotel Phuket',          color: '#1a6a8a' },
  { id: 'hkl',   name: 'Hotel Khao Lak',        color: '#0F6E56' },
  { id: 'cpk',   name: 'Counter Tour Phuket',   color: '#6c5ce7' },
  { id: 'ckl',   name: 'Counter Tour Khao Lak', color: '#5d8a3a' },
  { id: 'ww',    name: 'World Wide',            color: '#7a3e8a' },
  { id: 'walkin',name: 'Walk-in / Direct',      color: '#2d9a6a' },
  { id: 'staff', name: 'Staff / Internal',      color: '#6c5ce7' },
]

export function useAppData() {
  const store = useAppStore()

  const routes  = computed(() => store.state?.routes   || [])
  const boats   = computed(() => store.state?.boats    || [])
  const trips   = computed(() => store.state?.trips    || {})
  const agents  = computed(() => store.state?.sb_agents     || [])
  const markets = computed(() => store.state?.sb_markets?.length ? store.state.sb_markets : DEFAULT_MARKETS)
  const sales   = computed(() => store.state?.sb_sales || [])
  const rateTypes = computed(() => store.state?.sb_rate_types || [])
  const bookings  = computed(() => store.state?.sb_bookings  || [])

  function getBoat(id)  { return boats.value.find(b => b.id === id) }
  function getRoute(id) { return routes.value.find(r => r.id === id) }
  function getMarket(id){ return markets.value.find(m => m.id === id) }
  function getSales(id) { return sales.value.find(s => s.id === id) }

  function getCurStatus(boat, ds) {
    const sorted = [...(boat.log || [])].sort((a, b) => b.from.localeCompare(a.from))
    return sorted.find(e => e.from <= ds && (!e.to || e.to >= ds)) || { s: 'available', loc: '-' }
  }

  function getRouteStatusNow(r) {
    if (!r.seasons?.length) return null
    return r.seasons.find(s => s.from <= TODAY && s.to >= TODAY) || null
  }

  function isRouteActiveToday(r) {
    const s = getRouteStatusNow(r)
    return s?.type === 'open'
  }

  function getDayStatus(r, dateStr) {
    if (r.overrides?.[dateStr]) return { type: r.overrides[dateStr], source: 'override' }
    if (!r.seasons?.length) return null
    const s = r.seasons.find(s => s.from <= dateStr && s.to >= dateStr)
    return s ? { type: s.type, source: 'season', seasonId: s.id } : null
  }

  function buildDAGroups(ds) {
    const dayOps = trips.value[ds] || {}
    const groups = { tublamu: {}, panwa: {} }
    Object.entries(dayOps).forEach(([bid, op]) => {
      if (Array.isArray(op) || !op.route || op.type === 'charter') return
      const r = getRoute(op.route); if (!r) return
      const b = getBoat(bid);       if (!b) return
      const pier = r.pier; if (!groups[pier]) return
      const key = `${op.route}__${op.type}`
      if (!groups[pier][key]) groups[pier][key] = { r, type: op.type, allot: 0, booked: 0 }
      groups[pier][key].allot  += b.cap
      groups[pier][key].booked += (op.booked || 0)
    })
    return groups
  }

  function agentInitials(name) {
    const parts = (name || '').replace(/[()]/g, '').split(/\s+/).filter(Boolean)
    return (parts.length >= 2 ? parts[0][0] + parts[1][0] : (name || '').slice(0, 2)).toUpperCase()
  }

  function fmtDate(s) {
    if (!s) return '—'
    return new Date(s).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: '2-digit' })
  }

  function fmtTHB(n) {
    return new Intl.NumberFormat('en-US').format(Math.round(n || 0))
  }

  return {
    routes, boats, trips, agents, markets, sales, rateTypes, bookings,
    getBoat, getRoute, getMarket, getSales,
    getCurStatus, getRouteStatusNow, isRouteActiveToday, getDayStatus,
    buildDAGroups, agentInitials, fmtDate, fmtTHB, TODAY
  }
}
