import { useAppStore } from '../store/app'

function isPlainObj(x) { return x !== null && typeof x === 'object' && !Array.isArray(x) }

function deepDiff(b, c) {
  const p = {}; const d = []; let ch = false
  Object.keys(c).forEach(k => {
    if (!(k in b)) { p[k] = { v: c[k] }; ch = true }
    else if (isPlainObj(b[k]) && isPlainObj(c[k])) {
      const s = deepDiff(b[k], c[k])
      if (s) { p[k] = { m: s }; ch = true }
    } else if (JSON.stringify(b[k]) !== JSON.stringify(c[k])) { p[k] = { v: c[k] }; ch = true }
  })
  Object.keys(b).forEach(k => { if (!(k in c)) { d.push(k); ch = true } })
  return ch ? { p, d } : null
}

export function computeDiff(base, cur) {
  const sets = {}; const cols = {}; const objs = {}; let ch = false
  const keys = {}
  Object.keys(base || {}).forEach(k => (keys[k] = 1))
  Object.keys(cur || {}).forEach(k => (keys[k] = 1))
  Object.keys(keys).forEach(k => {
    const b = base?.[k]; const c = cur?.[k]
    const isCol =
      Array.isArray(c) && c.length > 0 && c.every(x => x && typeof x === 'object' && x.id != null)
    if (isCol) {
      const bmap = {}
      if (Array.isArray(b)) b.forEach(x => { if (x && x.id != null) bmap[String(x.id)] = x })
      const up = []; const patch = []; const seen = {}
      c.forEach(x => {
        const id = String(x.id); seen[id] = 1
        const bx = bmap[id]
        if (!bx) { up.push(x); ch = true }
        else {
          const dd = deepDiff(bx, x)
          if (dd) {
            const pKeys = Object.keys(dd.p || {})
            if (pKeys.length <= 3 && !(dd.d || []).length) patch.push({ id: x.id, m: dd })
            else up.push(x)
            ch = true
          }
        }
      })
      const del = Object.keys(bmap).filter(id => !seen[id])
      if (del.length) ch = true
      if (up.length || patch.length || del.length) cols[k] = { up, patch, del }
    } else if (isPlainObj(c) && isPlainObj(b)) {
      const sub = deepDiff(b, c)
      if (sub) { objs[k] = { p: sub.p, d: sub.d }; ch = true }
    } else if (c === undefined && b !== undefined) {
      sets[k] = null; ch = true
    } else if (JSON.stringify(b) !== JSON.stringify(c)) {
      sets[k] = c; ch = true
    }
  })
  return { _changed: ch, sets, cols, objs }
}

function diffToOps(d, cur, resources) {
  const ops = []; let ok = true
  Object.keys(d.cols || {}).forEach(k => {
    if (!ok) return
    if (!resources[k]) { ok = false; return }
    const c = d.cols[k]
    const curMap = {}
    ;(Array.isArray(cur[k]) ? cur[k] : []).forEach(x => { if (x && x.id != null) curMap[String(x.id)] = x })
    ;(c.up || []).forEach(rec => ops.push({ op: 'put', r: k, id: String(rec.id), body: rec }))
    ;(c.patch || []).forEach(pr => {
      ops.push({ op: 'patch', r: k, id: String(pr.id), body: { m: pr.m, full: curMap[String(pr.id)] || null } })
    })
    ;(c.del || []).forEach(id => ops.push({ op: 'del', r: k, id: String(id) }))
  })
  Object.keys(d.objs || {}).forEach(k => {
    if (!ok) return
    if (!resources[k]) { ok = false; return }
    const o = d.objs[k]
    Object.keys(o.p || {}).forEach(sub => {
      const v = (cur[k] || {})[sub]
      if (v === undefined) { ok = false; return }
      ops.push({ op: 'put', r: k, id: sub, body: v })
    })
    ;(o.d || []).forEach(sub => ops.push({ op: 'del', r: k, id: sub }))
  })
  Object.keys(d.sets || {}).forEach(k => {
    if (!ok) return
    if (resources[k]) ops.push({ op: 'putall', r: k, body: d.sets[k] })
    else ops.push({ op: 'meta', id: k, body: d.sets[k] })
  })
  return ok ? ops : null
}

export function useSync() {
  const store = useAppStore()
  let saveTimer = null

  async function loadData() {
    const res = await fetch('/api/load').catch(() => ({ ok: false, status: 0 }))
    if (!res.ok) return false
    const json = await res.json().catch(() => null)
    if (!json) return false
    store.setVersion(json.version || 0)
    store.setLastBy(json.updated_by, json.updated_at)
    const dataStr = typeof json.data === 'string' && json.data.length > 2 ? json.data : null
    if (dataStr) {
      try {
        const parsed = JSON.parse(dataStr)
        store.setState(parsed)
        store.setBase(parsed)
      } catch (_) {}
    }
    return true
  }

  async function loadRestResources() {
    const res = await fetch('/api/v1').catch(() => ({ ok: false }))
    if (res.ok) {
      const json = await res.json().catch(() => null)
      if (json?.resources) store.setRestResources(json.resources)
    }
  }

  async function save(forceLegacy = false) {
    const cur = store.state
    if (!cur || !store.canEdit) return
    const d = computeDiff(store.base || {}, cur)
    if (!d._changed) { store.setDirty(false); return }
    const ops = !forceLegacy && store.restResources ? diffToOps(d, cur, store.restResources) : null
    const url = ops ? '/api/v1/_batch' : '/api/save'
    const body = ops
      ? { baseVersion: store.version, ops }
      : { baseVersion: store.version, diff: { sets: d.sets, cols: d.cols, objs: d.objs } }
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      if (res.ok) {
        const r = await res.json().catch(() => ({}))
        store.setVersion(r.version || store.version)
        store.setBase(cur)
        store.setDirty(false)
        store.clearSaveError()
        if (r.behind) store.setPendingRefresh(r)
      } else if (ops && (res.status === 404 || res.status === 400)) {
        await save(true)
      } else {
        store.setSaveError(res.status)
        if (res.status >= 500 || res.status === 0) {
          setTimeout(() => save(), 5000)
        }
      }
    } catch (_) {
      store.setSaveError(0)
      setTimeout(() => save(), 5000)
    }
  }

  function scheduleSave() {
    store.setDirty(true)
    clearTimeout(saveTimer)
    saveTimer = setTimeout(() => save(), 1000)
  }

  function flushBeforeUnload() {
    if (!store.dirty || !store.state) return
    const d = computeDiff(store.base || {}, store.state)
    if (!d._changed) return
    const ops = store.restResources ? diffToOps(d, store.state, store.restResources) : null
    const url = ops ? '/api/v1/_batch' : '/api/save'
    const body = JSON.stringify(
      ops
        ? { baseVersion: store.version, ops }
        : { baseVersion: store.version, diff: { sets: d.sets, cols: d.cols, objs: d.objs } }
    )
    try { navigator.sendBeacon(url, new Blob([body], { type: 'application/json' })) } catch (_) {}
  }

  return { loadData, loadRestResources, save, scheduleSave, flushBeforeUnload }
}
