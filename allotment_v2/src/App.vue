<template>
  <div v-if="status === 'loading'" class="app-boot">
    <div class="boot-spinner"></div>
    <div class="boot-label">กำลังโหลด…</div>
  </div>

  <LoginForm v-else-if="status === 'login'" @login-success="onLoginSuccess" />

  <template v-else>
    <AppTopbar />
    <LoadingBar />
    <div class="app">
      <AppSidebar />
      <main class="main">
        <router-view v-slot="{ Component }">
          <keep-alive>
            <component :is="Component" />
          </keep-alive>
        </router-view>
      </main>
    </div>
    <SaveErrorBanner />
  </template>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useAppStore } from './store/app'
import { useAuth } from './composables/useAuth'
import { useSync } from './composables/useSync'
import { useSSE } from './composables/useSSE'
import { useLoading } from './composables/useLoading'
import AppTopbar from './components/AppTopbar.vue'
import AppSidebar from './components/AppSidebar.vue'
import LoginForm from './components/LoginForm.vue'
import SaveErrorBanner from './components/SaveErrorBanner.vue'
import LoadingBar from './components/LoadingBar.vue'

const store = useAppStore()
const auth = useAuth()
const sync = useSync()
const sse = useSSE()
const { start: loadStart, stop: loadStop } = useLoading()

const status = ref('loading') // 'loading' | 'login' | 'ready'

onMounted(async () => {
  const { authenticated } = await auth.checkAuth()
  if (!authenticated) { status.value = 'login'; return }

  loadStart()
  await Promise.all([sync.loadData(), sync.loadRestResources()])
  loadStop()
  sse.connect()
  window.addEventListener('beforeunload', sync.flushBeforeUnload)
  window.addEventListener('pagehide', sync.flushBeforeUnload)
  status.value = 'ready'
})

onBeforeUnmount(() => {
  sse.disconnect()
  window.removeEventListener('beforeunload', sync.flushBeforeUnload)
  window.removeEventListener('pagehide', sync.flushBeforeUnload)
})

async function onLoginSuccess() {
  loadStart()
  await Promise.all([sync.loadData(), sync.loadRestResources()])
  loadStop()
  sse.connect()
  window.addEventListener('beforeunload', sync.flushBeforeUnload)
  window.addEventListener('pagehide', sync.flushBeforeUnload)
  status.value = 'ready'
}
</script>

<style scoped>
.app-boot {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  gap: 12px;
  background: var(--sand);
}
.boot-spinner {
  width: 28px; height: 28px;
  border: 2px solid var(--border);
  border-top-color: var(--ocean-mid);
  border-radius: 50%;
  animation: spin .8s linear infinite;
}
.boot-label { font-size: 12px; color: var(--ink-soft); }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
