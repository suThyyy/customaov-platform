import { useCallback, useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

export type LoadStatus = 'loading' | 'error' | 'ready'

/** Thời gian giả lập tải khi `?mock=slow` */
const SLOW_MS = 1200

const readMode = (search: string) => new URLSearchParams(search).get('mock')

/**
 * Trạng thái tải của danh sách (Phase 5). Dữ liệu hiện là mock đồng bộ nên mặc định luôn `ready`.
 * Để xem/kiểm thử các trạng thái khác, thêm query vào URL:
 * - `?mock=loading` — giữ skeleton
 * - `?mock=error`   — trạng thái lỗi, nút "Thử lại" bỏ query và tải lại
 * - `?mock=slow`    — skeleton ~1.2 giây rồi hiện dữ liệu
 * Khi nối API: thay hook này bằng trạng thái thật của request (isLoading / isError / refetch).
 */
export function useMockStatus(): { status: LoadStatus; retry: () => void } {
  const { pathname, search, hash } = useLocation()
  const navigate = useNavigate()
  const mode = readMode(search)
  const [slowDone, setSlowDone] = useState(false)

  useEffect(() => {
    if (mode !== 'slow') return
    const t = window.setTimeout(() => setSlowDone(true), SLOW_MS)
    return () => window.clearTimeout(t)
  }, [mode])

  const retry = useCallback(() => {
    const params = new URLSearchParams(search)
    params.delete('mock')
    const q = params.toString()
    navigate(`${pathname}${q ? `?${q}` : ''}${hash}`, { replace: true })
  }, [navigate, pathname, search, hash])

  const status: LoadStatus =
    mode === 'loading' ? 'loading' : mode === 'error' ? 'error' : mode === 'slow' && !slowDone ? 'loading' : 'ready'
  return { status, retry }
}
