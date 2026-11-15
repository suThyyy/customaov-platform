import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AppContext'
import { loginHref } from './nav'

/**
 * Route guard cho trang nội bộ: khách bị chuyển tới landing kèm hộp đăng nhập
 * (`/?login=login&next=<route hiện tại>`), đăng nhập xong quay lại đúng route.
 */
export function RequireAuth() {
  const { loggedIn, loading } = useAuth()
  const { pathname, search, hash } = useLocation()
  if (loading) {
    return (
      <div className="grid min-h-dvh place-items-center bg-bg text-sm text-fg-muted" role="status" aria-live="polite">
        Đang kiểm tra phiên đăng nhập...
      </div>
    )
  }
  if (!loggedIn) return <Navigate to={loginHref('login', pathname + search + hash)} replace />
  return <Outlet />
}
