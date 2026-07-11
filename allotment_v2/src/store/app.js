import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useAppStore = defineStore('app', () => {
  const me = ref(null)           // current user from /api/me
  const state = ref(null)        // app data blob (parsed)
  const base = ref(null)         // server snapshot used for diffing
  const version = ref(0)         // server data version
  const lastBy = ref('')         // "username · date" string
  const dirty = ref(false)       // unsaved local changes
  const restResources = ref(null) // {entity: 'array'|'map'} from GET /api/v1
  const saveError = ref(null)    // { type: 'conflict'|'auth'|'transient', msg }
  const pendingRefresh = ref(null) // server is ahead, soft-refresh prompt

  const canEdit = computed(() =>
    !me.value || me.value.role === 'admin' || me.value.canEdit !== false
  )

  const isAdmin = computed(() =>
    me.value?.role === 'admin'
  )

  function canEditArea(area) {
    if (!me.value || me.value.role === 'admin') return true
    if (Array.isArray(me.value.editAreas)) return me.value.editAreas.includes(area)
    return me.value.canEdit !== false
  }

  function setMe(user) { me.value = user }
  function setState(data) { state.value = data }
  function setBase(data) { base.value = typeof data === 'string' ? JSON.parse(data) : structuredClone(data) }
  function setVersion(v) { version.value = v }
  function setLastBy(username, at) {
    lastBy.value = username ? `${username} · ${new Date(at).toLocaleString('th-TH', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}` : ''
  }
  function setDirty(v) { dirty.value = v }
  function setRestResources(r) { restResources.value = r }
  function setSaveError(status) {
    if (status === 409) saveError.value = { type: 'conflict', msg: 'ยับยั้งการบันทึก — บันทึกนี้จะทำให้ข้อมูลหาย กรุณาโหลดใหม่' }
    else if (status === 403) saveError.value = { type: 'auth', msg: 'บัญชีนี้ไม่มีสิทธิ์แก้ไข' }
    else if (status === 401) saveError.value = { type: 'auth', msg: 'เซสชันหมดอายุ — กรุณาเข้าสู่ระบบใหม่' }
    else saveError.value = { type: 'transient', msg: 'กำลังลองบันทึกขึ้นระบบใหม่… (ข้อมูลยังอยู่ในเครื่อง)' }
  }
  function clearSaveError() { saveError.value = null }
  function setPendingRefresh(info) { pendingRefresh.value = info }
  function clearPendingRefresh() { pendingRefresh.value = null }

  function patchState(updater) {
    if (!state.value) return
    updater(state.value)
    dirty.value = true
  }

  return {
    me, state, base, version, lastBy, dirty, restResources,
    saveError, pendingRefresh, canEdit, isAdmin,
    canEditArea, setMe, setState, setBase, setVersion, setLastBy,
    setDirty, setRestResources, setSaveError, clearSaveError,
    setPendingRefresh, clearPendingRefresh, patchState
  }
})
