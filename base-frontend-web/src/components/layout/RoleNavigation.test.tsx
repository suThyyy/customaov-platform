import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AppProviders } from '../../context/AppContext'
import { MockPersonaSelector } from './MockPersonaSelector'
import { TopNav } from './TopNav'
import { BottomNav } from './BottomNav'
import { RequireRole } from './RequireRole'

const client = vi.hoisted(() => vi.fn(() => { throw new Error('Mock must not initialize Supabase') }))
vi.mock('../../api/supabase/client', () => ({ getSupabaseClient: client }))
function mount(role: string, path = '/dashboard') {
  if (role !== 'guest') localStorage.setItem('customaov.mockLoggedIn', '1')
  sessionStorage.setItem('customaov.mockRole', role)
  return render(<AppProviders><MemoryRouter initialEntries={[path]}>
    <MockPersonaSelector /><TopNav /><BottomNav />
    <Routes>
      <Route path="/" element={<p>Landing</p>} />
      <Route path="/dashboard" element={<p>Dashboard</p>} />
      <Route element={<RequireRole />}><Route path="/rooms/new" element={<p>Organizer wizard</p>} /></Route>
      <Route element={<RequireRole superAdmin />}><Route path="/platform-admin" element={<p>Platform unavailable</p>} /></Route>
    </Routes>
  </MemoryRouter></AppProviders>)
}
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); client.mockClear() })
afterEach(cleanup)
describe('role navigation and mock persona integration', () => {
  it.each(['guest','user'])('hides organizer navigation for %s', role => {
    mount(role)
    expect(screen.queryAllByRole('link', { name: 'Tạo phòng' })).toHaveLength(0)
  })
  it.each(['admin','super_admin'])('shows organizer navigation for %s', role => {
    mount(role)
    expect(screen.getAllByRole('link', { name: 'Tạo phòng' })).toHaveLength(2)
    fireEvent.click(screen.getByRole('button', { name: /^Tài khoản / }))
    expect(screen.getByRole('menuitem', { name: 'Quản lý phòng' })).toBeTruthy()
    expect(screen.getByRole('menuitem', { name: 'Quản lý giải đấu' }).getAttribute('href')).toBe('/tournaments')
    expect(screen.queryByRole('menuitem', { name: 'Quản trị nền tảng' }) !== null).toBe(role === 'super_admin')
  })
  it('switches all personas, clears privilege on logout, and never initializes Supabase', () => {
    mount('guest', '/')
    const selector = screen.getByRole('combobox', { name: /Vai trò kiểm thử/ })
    for (const role of ['user','admin','super_admin','guest']) fireEvent.change(selector, { target: { value: role } })
    expect(screen.getByText('Landing')).toBeTruthy()
    expect(sessionStorage.getItem('customaov.mockRole')).toBe('user')
    expect(localStorage.getItem('customaov.mockLoggedIn')).toBeNull()
    expect(client).not.toHaveBeenCalled()
  })
  it.each(['user','invalid'])('denies organizer deep links for %s', role => {
    mount(role, '/rooms/new'); expect(screen.queryByText('Organizer wizard')).toBeNull()
    expect(screen.getByRole('alert')).toBeTruthy()
  })
  it('restores an explicitly selected mock admin on a direct URL', () => {
    mount('admin', '/rooms/new'); expect(screen.getByText('Organizer wizard')).toBeTruthy()
  })
  it('revokes the organizer UI immediately after persona change', () => {
    mount('admin', '/rooms/new')
    fireEvent.change(screen.getByRole('combobox', { name: /Vai trò kiểm thử/ }), { target: { value: 'user' } })
    expect(screen.queryByText('Organizer wizard')).toBeNull()
    expect(screen.queryAllByRole('link', { name: 'Tạo phòng' })).toHaveLength(0)
  })
  it('unfinished community navigation retains its unavailable state', () => {
    mount('user'); fireEvent.click(screen.getByRole('button', { name: 'Thêm' }))
    expect(within(screen.getByRole('menu', { name: 'Mục khác' })).getByText('Cộng đồng')).toBeTruthy()
    expect(screen.queryByRole('menuitem', { name: 'Cộng đồng' })).toBeNull()
  })
})
