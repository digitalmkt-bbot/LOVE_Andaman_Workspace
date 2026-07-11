import { createRouter, createWebHashHistory } from 'vue-router'
import { useAppStore } from '../store/app'
import { useLoading } from '../composables/useLoading'

const routes = [
  { path: '/', redirect: '/dashboard' },

  // Overview
  { path: '/dashboard',     component: () => import('../views/overview/DashboardView.vue') },
  { path: '/calendar',      component: () => import('../views/overview/CalendarView.vue') },
  { path: '/daily',         component: () => import('../views/overview/DailyView.vue') },

  // Operations
  { path: '/booking',       component: () => import('../views/operations/BookingView.vue') },
  { path: '/reconfirm',     component: () => import('../views/operations/ReconfirmView.vue') },
  { path: '/bookingflow',   component: () => import('../views/operations/BookingFlowView.vue') },
  { path: '/doccheck',      component: () => import('../views/operations/DocCheckView.vue') },
  { path: '/operation',     component: () => import('../views/operations/OperationView.vue') },
  { path: '/insurance',     component: () => import('../views/operations/InsuranceView.vue') },
  { path: '/vehicles',      component: () => import('../views/operations/VehiclesView.vue') },
  { path: '/vanjobs',       component: () => import('../views/operations/VanJobsView.vue') },
  { path: '/pickup-setup',  component: () => import('../views/operations/PickupSetupView.vue') },

  // Sales
  { path: '/agents',        component: () => import('../views/sales/AgentsView.vue') },
  { path: '/rate-types',    component: () => import('../views/sales/RateTypesView.vue') },
  { path: '/b2c',           component: () => import('../views/sales/B2CView.vue') },
  { path: '/staff',         component: () => import('../views/sales/StaffView.vue') },
  { path: '/marketdata',    component: () => import('../views/sales/MarketDataView.vue') },
  { path: '/focdetail',     component: () => import('../views/sales/FocDetailView.vue') },
  { path: '/pickupmap',     component: () => import('../views/sales/PickupMapView.vue') },

  // Accounting
  { path: '/accounting',    component: () => import('../views/accounting/AccountingView.vue') },
  { path: '/dailypfm',      component: () => import('../views/accounting/DailyPfmView.vue') },

  // Fleet
  { path: '/fl-dashboard',  component: () => import('../views/fleet/FlDashboardView.vue') },
  { path: '/fl-boatstatus', component: () => import('../views/fleet/FlBoatStatusView.vue') },
  { path: '/fl-dailyreport',component: () => import('../views/fleet/FlDailyReportView.vue') },
  { path: '/fl-incident',   component: () => import('../views/fleet/FlIncidentView.vue') },
  { path: '/fl-projects',   component: () => import('../views/fleet/FlProjectsView.vue') },
  { path: '/fl-maintenance',component: () => import('../views/fleet/FlMaintenanceView.vue') },
  { path: '/fl-inventory',  component: () => import('../views/fleet/FlInventoryView.vue') },
  { path: '/fl-consumables',component: () => import('../views/fleet/FlConsumablesView.vue') },
  { path: '/fl-cost',       component: () => import('../views/fleet/FlCostView.vue') },
  { path: '/fl-insights',   component: () => import('../views/fleet/FlInsightsView.vue') },
  { path: '/fl-fuel',       component: () => import('../views/fleet/FlFuelView.vue') },
  { path: '/fl-asset',      component: () => import('../views/fleet/FlAssetView.vue') },

  // Config
  { path: '/settings',      component: () => import('../views/config/SettingsView.vue') },
  { path: '/teammkt',       component: () => import('../views/config/TeamMktView.vue') },
  { path: '/addonsvc',      component: () => import('../views/config/AddonSvcView.vue') },

  // Admin
  { path: '/devlog',        component: () => import('../views/admin/DevlogView.vue'), meta: { adminOnly: true } },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

router.beforeEach((to) => {
  useLoading().start()
  if (to.meta.adminOnly) {
    const store = useAppStore()
    if (!store.isAdmin) return '/'
  }
})

router.afterEach(() => useLoading().stop())

export default router
