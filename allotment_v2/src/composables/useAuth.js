import { ref } from 'vue'
import { useAppStore } from '../store/app'

export function useAuth() {
  const store = useAppStore()
  const loading = ref(false)
  const error = ref(null)

  async function checkAuth() {
    const res = await fetch('/api/me').catch(() => ({ status: 0 }))
    if (res.status === 401) return { authenticated: false }
    if (res.status !== 200) return { authenticated: true, offline: true }
    const me = await res.json().catch(() => ({}))
    store.setMe(me)
    window.LA_ME = me
    return { authenticated: true }
  }

  async function login(username, password) {
    loading.value = true
    error.value = null
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      })
      if (!res.ok) {
        error.value = 'username หรือรหัสผ่านไม่ถูกต้อง'
        return false
      }
      const me = await res.json().catch(() => ({}))
      store.setMe(me)
      window.LA_ME = me
      return true
    } catch (e) {
      error.value = 'เชื่อมต่อระบบไม่ได้'
      return false
    } finally {
      loading.value = false
    }
  }

  async function logout() {
    try { await fetch('/api/logout') } catch (_) {}
    store.setMe(null)
    window.LA_ME = null
  }

  return { checkAuth, login, logout, loading, error }
}
