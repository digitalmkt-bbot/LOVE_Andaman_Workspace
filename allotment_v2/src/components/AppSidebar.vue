<template>
  <nav class="sidebar">
    <!-- Overview -->
    <div class="nav-section" style="color:rgba(180,210,255,.5);margin-top:4px">Overview</div>
    <RouterLink v-for="item in overviewNav" :key="item.path" :to="item.path" class="nav-item" v-html="item.html" />

    <div class="nav-divider"></div>

    <!-- Operations -->
    <div class="nav-section" style="color:rgba(130,210,170,.5)">Operations</div>
    <RouterLink
      v-for="item in opsNav" :key="item.path" :to="item.path"
      class="nav-item" style="border-left:2px solid rgba(130,210,170,.25);padding-left:9px"
      v-html="item.html"
    />

    <div class="nav-divider"></div>

    <!-- Sales -->
    <div class="nav-section" style="color:rgba(255,170,200,.5)">Sales</div>
    <RouterLink
      v-for="item in salesNav" :key="item.path" :to="item.path"
      class="nav-item" style="border-left:2px solid rgba(255,170,200,.25);padding-left:9px"
      v-html="item.html"
    />

    <div class="nav-divider"></div>

    <!-- Accounting -->
    <div class="nav-section" style="color:rgba(120,200,230,.5)">Accounting &amp; Finance</div>
    <RouterLink
      v-for="item in accountingNav" :key="item.path" :to="item.path"
      class="nav-item" style="border-left:2px solid rgba(120,200,230,.25);padding-left:9px"
      v-html="item.html"
    />

    <!-- Admin (admin-only) -->
    <template v-if="store.isAdmin">
      <div class="nav-divider"></div>
      <div class="nav-section" style="color:rgba(150,160,170,.55)">Admin</div>
      <RouterLink
        v-for="item in adminNav" :key="item.path" :to="item.path"
        class="nav-item" style="border-left:2px solid rgba(150,160,170,.28);padding-left:9px"
        v-html="item.html"
      />
    </template>

    <div class="nav-divider"></div>

    <!-- Fleet Management -->
    <div class="nav-section" style="color:rgba(255,190,80,.5)">Fleet Management</div>
    <RouterLink
      v-for="item in fleetNav" :key="item.path" :to="item.path"
      class="nav-item" style="border-left:2px solid rgba(255,190,80,.25);padding-left:9px"
      v-html="item.html"
    />

    <div class="nav-divider"></div>

    <!-- Config -->
    <div class="nav-section" style="color:rgba(200,180,255,.5)">Config</div>
    <RouterLink
      v-for="item in configNav" :key="item.path" :to="item.path"
      class="nav-item" style="border-left:2px solid rgba(200,180,255,.25);padding-left:9px"
      v-html="item.html"
    />

    <div class="sidebar-footer">
      LOVE Andaman · {{ store.me?.role || 'staff' }}
    </div>
  </nav>
</template>

<script setup>
import { RouterLink } from 'vue-router'
import { useAppStore } from '../store/app'

const store = useAppStore()

const icon = (path) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${path}</svg>`

const overviewNav = [
  { path: '/dashboard', html: icon('<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>') + ' Dashboard' },
  { path: '/calendar',  html: icon('<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>') + ' Calendar' },
  { path: '/daily',     html: icon('<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>') + ' Daily Availability' },
]

const opsNav = [
  { path: '/booking',      html: icon('<path d="M19 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2z"/><path d="M9 11l2 2 4-4"/>') + ' Booking' },
  { path: '/reconfirm',   html: icon('<path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/>') + ' Re-confirm' },
  { path: '/bookingflow',  html: icon('<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/>') + ' Booking Flow' },
  { path: '/doccheck',     html: icon('<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/><path d="M9 15l2 2 4-4"/>') + ' ตรวจเอกสาร' },
  { path: '/operation',    html: icon('<path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 12h6M9 16h4"/>') + ' Boat Operation' },
  { path: '/insurance',    html: icon('<path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/><path d="M9 12l2 2 4-4"/>') + ' Insurance' },
  { path: '/vehicles',     html: icon('<path d="M3 13l2-5a2 2 0 012-1h10a2 2 0 012 1l2 5"/><path d="M5 13h14v4a1 1 0 01-1 1h-1a2 2 0 01-4 0H8a2 2 0 01-4 0H3v-4z"/><circle cx="7.5" cy="17.5" r="1.5"/><circle cx="16.5" cy="17.5" r="1.5"/>') + ' Transfer Fleet' },
  { path: '/vanjobs',      html: icon('<path d="M6 9V3h12v6"/><rect x="6" y="13" width="12" height="8"/><path d="M6 17H4a2 2 0 01-2-2v-2a2 2 0 012-2h16a2 2 0 012 2v2a2 2 0 01-2 2h-2"/>') + ' ใบงานรถ (Van Jobs)' },
  { path: '/pickup-setup', html: icon('<path d="M12 22s8-7 8-13a8 8 0 10-16 0c0 6 8 13 8 13z"/><circle cx="12" cy="9" r="3"/>') + ' Pickup time setup' },
]

const salesNav = [
  { path: '/agents',    html: icon('<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>') + ' Agent List' },
  { path: '/rate-types',html: icon('<path d="M20 7L9.5 17.5 4 12"/><path d="M20 12v6a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h10"/>') + ' Rate Types' },
  { path: '/b2c',       html: icon('<path d="M21 10H3M21 6H3M21 14H3M21 18H3"/>') + ' B2C Channels' },
  { path: '/staff',     html: icon('<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>') + ' Staff & Welfare' },
  { path: '/marketdata',html: icon('<path d="M3 3v18h18"/><path d="M7 14l4-4 3 3 5-6"/>') + ' Demand' },
  { path: '/focdetail', html: icon('<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>') + ' FOC Detail' },
  { path: '/pickupmap', html: icon('<path d="M12 21s-7-6.5-7-11a7 7 0 0 1 14 0c0 4.5-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>') + ' แผนที่จุดรับ' },
]

const accountingNav = [
  { path: '/accounting', html: icon('<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/>') + ' Accounting' },
  { path: '/dailypfm',   html: icon('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>') + ' Daily PFM' },
]

const adminNav = [
  { path: '/devlog', html: icon('<path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 12l1.4 1.4L13 11M9 16h4"/>') + ' System Log' },
]

const fleetNav = [
  { path: '/fl-dashboard',  html: icon('<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>') + ' Fleet Dashboard' },
  { path: '/fl-boatstatus', html: icon('<path d="M3 17l2-8h14l2 8H3z"/><path d="M12 9V5M9 9V6M15 9V6"/>') + ' Boat Status' },
  { path: '/fl-dailyreport',html: icon('<path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/>') + ' Daily Fleet Log' },
  { path: '/fl-incident',   html: icon('<path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>') + ' Incident / Job' },
  { path: '/fl-projects',   html: icon('<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 3H8l-2 4h12l-2-4z"/>') + ' Projects' },
  { path: '/fl-maintenance',html: icon('<path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/>') + ' Maintenance' },
  { path: '/fl-inventory',  html: icon('<path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>') + ' Inventory / Memo' },
  { path: '/fl-consumables',html: icon('<path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5M2 12l10 5 10-5"/>') + ' เบิกของใช้/น้ำมัน' },
  { path: '/fl-cost',       html: icon('<circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/>') + ' Cost Analytics' },
  { path: '/fl-insights',   html: icon('<path d="M2 20h20M5 20V10l7-7 7 7v10"/>') + ' Fleet Insights' },
  { path: '/fl-fuel',       html: icon('<path d="M3 22V8a1 1 0 011-1h4a1 1 0 011 1v14M3 15h6"/><path d="M10 8h4l2 4h2a2 2 0 012 2v8"/>') + ' Fuel' },
  { path: '/fl-asset',      html: icon('<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>') + ' Company Asset' },
]

const configNav = [
  { path: '/settings', html: icon('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>') + ' Programs' },
  { path: '/teammkt',  html: icon('<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>') + ' Team & Markets' },
  { path: '/addonsvc', html: icon('<path d="M12 5v14M5 12h14"/>') + ' Add-on Services' },
]
</script>
