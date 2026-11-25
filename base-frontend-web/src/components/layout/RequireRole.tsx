import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AppContext'
import { Button } from '../ui/Button'
import { loginHref } from './nav'
import { DATA_SOURCE } from '../../api'

export function RequireRole({ superAdmin = false }: { superAdmin?: boolean }) {
  const { loggedIn, loading, role, roleLoading, roleError, refreshRole } = useAuth()
  const location = useLocation()
  if (loading || roleLoading) return <p role="status">Đang kiểm tra quyền truy cập…</p>
  if (!loggedIn) return <Navigate replace to={loginHref('login', location.pathname + location.search + location.hash)} />
  if (DATA_SOURCE === 'api' && !superAdmin) return <Outlet />
  if (roleError) return <section><p role="alert">{roleError}</p><Button variant="outline" onClick={() => void refreshRole()}>Thử lại</Button></section>
  if (role !== 'super_admin' && (superAdmin || role !== 'admin')) return <p role="alert">Bạn không có quyền truy cập chức năng quản trị này.</p>
  return <Outlet />
}
