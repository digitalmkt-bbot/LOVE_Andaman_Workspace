<template>
  <header class="topbar">
    <div class="topbar-brand">
      <div class="brand-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
          <path d="M3 17 L12 5 L21 17" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M6 13 L18 13" stroke-linecap="round"/>
        </svg>
      </div>
      <span>LOVE Andaman</span>
      <div class="topbar-sep"></div>
      <span class="topbar-sub">Operations</span>
    </div>

    <div class="topbar-right">
      <span class="topbar-date">{{ dateStr }}</span>

      <template v-if="store.dirty">
        <span class="save-badge saving">กำลังบันทึก…</span>
      </template>
      <template v-else-if="store.lastBy">
        <span class="topbar-date" style="font-family:'DM Sans',sans-serif;font-size:11px">
          บันทึกล่าสุด: {{ store.lastBy }}
        </span>
      </template>

      <button v-if="store.me" class="topbar-btn" @click="logout">
        {{ store.me.name || store.me.username }} · ออก
      </button>
    </div>
  </header>

  <div v-if="store.pendingRefresh" class="refresh-banner">
    <span>
      มีข้อมูลใหม่จากคนอื่น
      <template v-if="store.pendingRefresh.updated_by">
        (โดย {{ store.pendingRefresh.updated_by }})
      </template>
      · จะรีเฟรชอัตโนมัติเมื่อว่าง
    </span>
    <button @click="softRefresh">โหลดเลย</button>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useAppStore } from '../store/app'
import { useAuth } from '../composables/useAuth'
import { useSync } from '../composables/useSync'
import { useRouter } from 'vue-router'

const store = useAppStore()
const auth = useAuth()
const sync = useSync()
const router = useRouter()

const dateStr = computed(() => {
  const d = new Date()
  return d.toLocaleDateString('th-TH', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })
})

async function logout() {
  if (!confirm('ออกจากระบบ?')) return
  await auth.logout()
  router.go(0)
}

async function softRefresh() {
  await sync.loadData()
  store.clearPendingRefresh()
}
</script>

<style scoped>
.save-badge {
  font-size: 11px;
  padding: 3px 9px;
  border-radius: 12px;
  font-family: 'DM Sans', sans-serif;
}
.save-badge.saving { background: rgba(255,190,80,.2); color: #f5c84a; }

.refresh-banner {
  position: fixed;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 99999;
  background: #185FA5;
  color: #fff;
  border-radius: 24px;
  padding: 8px 8px 8px 16px;
  font: 13px/1.3 'DM Sans', sans-serif;
  box-shadow: 0 6px 20px rgba(0,0,0,.25);
  display: flex;
  align-items: center;
  gap: 10px;
}
.refresh-banner button {
  background: #fff;
  color: #185FA5;
  border: none;
  border-radius: 16px;
  padding: 6px 14px;
  font-weight: 700;
  cursor: pointer;
  font-family: inherit;
}
</style>
