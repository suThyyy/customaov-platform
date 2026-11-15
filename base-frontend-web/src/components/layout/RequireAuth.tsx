import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AppContext'
import { loginHref } from './nav'

/**
 * Route guard cho trang nội bộ: khách bị chuyển tới landing kèm hộp đăng nhập
 * (`/?login=login&next=<route hiện tại>`), đăng nhập xong quay lại đúng route.
 */
export function RequireAuth() {
  const { loggedIn } = useAuth()
  const { pathname, search, hash } = useLocation()
  if (!loggedIn) return <Navigate to={loginHref('login', pathname + search + hash)} replace />
  return <Outlet />
}
