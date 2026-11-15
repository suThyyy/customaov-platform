import { useEffect, useRef, type RefObject } from 'react'
import { useLocation } from 'react-router-dom'

/** Đóng dropdown khi bấm ra ngoài `ref` hoặc nhấn Esc */
export function useDismiss(ref: RefObject<HTMLElement | null>, open: boolean, close: () => void) {
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) close()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [ref, open, close])
}

/**
 * Khi đổi route: có hash → cuộn tới phần tử đó (scroll-margin-top lo phần header sticky),
 * không có hash → về đầu trang và chuyển focus vào vùng nội dung chính (a11y).
 */
export function useRouteScroll(focusRef?: RefObject<HTMLElement | null>) {
  const { pathname, hash } = useLocation()
  // Chỉ chuyển focus khi route thực sự đổi (không phải lần tải đầu, không phải StrictMode chạy lại effect):
  // giữ focus tự nhiên để Tab đầu tiên vào link "Bỏ qua tới nội dung chính"
  const prevKey = useRef<string | null>(null)
  useEffect(() => {
    const key = pathname + hash
    const changed = prevKey.current !== null && prevKey.current !== key
    prevKey.current = key
    if (hash) {
      // đợi trang mới render xong rồi mới tìm anchor
      const t = window.setTimeout(() => {
        document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 0)
      return () => window.clearTimeout(t)
    }
    window.scrollTo(0, 0)
    if (changed) focusRef?.current?.focus({ preventScroll: true })
  }, [pathname, hash, focusRef])
}
