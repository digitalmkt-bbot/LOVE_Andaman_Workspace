import { useAppStore } from '../store/app'

let es = null
let retryTimer = null

export function useSSE() {
  const store = useAppStore()

  function connect() {
    if (es) return
    es = new EventSource('/api/events')

    es.addEventListener('update', e => {
      try {
        const info = JSON.parse(e.data)
        if (info.version && info.version > store.version) {
          store.setPendingRefresh(info)
        }
      } catch (_) {}
    })

    es.onerror = () => {
      es?.close()
      es = null
      clearTimeout(retryTimer)
      retryTimer = setTimeout(connect, 8000)
    }
  }

  function disconnect() {
    clearTimeout(retryTimer)
    es?.close()
    es = null
  }

  return { connect, disconnect }
}
