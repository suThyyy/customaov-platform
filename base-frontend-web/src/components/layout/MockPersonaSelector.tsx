import { startTransition } from 'react'
import { useNavigate } from 'react-router-dom'
import { DATA_SOURCE } from '../../api'
import { useAuth } from '../../context/AppContext'
import type { PlatformRole } from '../../api/platformRole'

export function MockPersonaSelector() {
  const { role, login, logout, setMockRole } = useAuth()
  const navigate = useNavigate()
  if (DATA_SOURCE !== 'mock') return null
  return <div className="flex flex-wrap items-center justify-center gap-3 border-b border-line bg-surface-2 p-2 text-sm">
    <label htmlFor="mock-persona">MOCK / DEVELOPMENT · Vai trò kiểm thử</label>
    <select id="mock-persona" className="rounded-btn border border-line bg-surface-3 p-2" value={role ?? 'user'} onChange={e => {
      const selected = e.target.value as PlatformRole
      navigate(selected === 'guest' ? '/' : '/dashboard')
      startTransition(() => { if (selected === 'guest') logout(); else { setMockRole(selected); login() } })
    }}>
      <option value="guest">Khách</option><option value="user">Người chơi</option>
      <option value="admin">Quản trị viên</option><option value="super_admin">Quản trị nền tảng</option>
    </select>
  </div>
}
