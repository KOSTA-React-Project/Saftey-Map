import { useEffect, useState } from 'react'
import { getApprovedNotes } from '../api/notesApi.js'

// 지도 진입 즉시 조회. 다른 탭의 관리자 처리도 포커스 복귀 또는 30초 내 반영한다.
export function useApprovedNotes() {
  const [notes, setNotes] = useState([])
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    let controller
    async function refresh() {
      controller?.abort()
      const current = new AbortController()
      controller = current
      try {
        const result = await getApprovedNotes({ signal: current.signal })
        if (active && !current.signal.aborted) {
          setNotes(result)
          setError('')
        }
      } catch (cause) {
        if (active && !current.signal.aborted) {
          setNotes([])
          setError(cause.message)
        }
      }
    }
    function visible() {
      if (document.visibilityState === 'visible') refresh()
    }
    refresh()
    const timer = window.setInterval(visible, 30_000)
    window.addEventListener('focus', refresh)
    window.addEventListener('safety-map:notes-updated', refresh)
    document.addEventListener('visibilitychange', visible)
    return () => {
      active = false
      controller?.abort()
      window.clearInterval(timer)
      window.removeEventListener('focus', refresh)
      window.removeEventListener('safety-map:notes-updated', refresh)
      document.removeEventListener('visibilitychange', visible)
    }
  }, [])
  return { notes, error }
}
