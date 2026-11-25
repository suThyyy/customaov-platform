import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { RequireRole } from './RequireRole'

const auth = vi.hoisted(() => ({ loggedIn: true, loading: false, role: null as string | null, roleLoading: false, roleError: null as string | null, refreshRole: vi.fn() }))
vi.mock('../../context/AppContext', () => ({ useAuth: () => auth }))
function Landing() { return <p>{useLocation().search}</p> }
function mount(superAdmin = false) {
  return render(<MemoryRouter initialEntries={['/protected?tab=1#details']}><Routes>
    <Route path="/" element={<Landing />} />
    <Route element={<RequireRole superAdmin={superAdmin} />}><Route path="/protected" element={<p>protected-content</p>} /></Route>
  </Routes></MemoryRouter>)
}
beforeEach(() => { Object.assign(auth, { loggedIn: true, loading: false, role: null, roleLoading: false, roleError: null }); auth.refreshRole.mockClear() })
afterEach(cleanup)
describe('RequireRole', () => {
  it('preserves full guest return URL', () => {
    auth.loggedIn = false; mount()
    expect(screen.getByText(`?login=login&next=${encodeURIComponent('/protected?tab=1#details')}`)).toBeTruthy()
  })
  it.each([null, 'user', 'unknown'])('fails closed for %s', role => {
    auth.role = role; mount()
    expect(screen.queryByText('protected-content')).toBeNull()
    expect(screen.getByRole('alert')).toBeTruthy()
  })
  it.each(['admin', 'super_admin'])('allows organizer %s', role => {
    auth.role = role; mount(); expect(screen.getByText('protected-content')).toBeTruthy()
  })
  it('denies admin on platform administration', () => {
    auth.role = 'admin'; mount(true); expect(screen.queryByText('protected-content')).toBeNull()
  })
  it('allows super admin on platform administration', () => {
    auth.role = 'super_admin'; mount(true); expect(screen.getByText('protected-content')).toBeTruthy()
  })
  it('withholds protected content while refreshing a privileged role', () => {
    auth.role = 'admin'; auth.roleLoading = true; mount()
    expect(screen.getByRole('status')).toBeTruthy(); expect(screen.queryByText('protected-content')).toBeNull()
  })
  it('offers retry without authorizing a failed read', () => {
    auth.roleError = 'Không đọc được quyền'; mount()
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }))
    expect(auth.refreshRole).toHaveBeenCalledOnce(); expect(screen.queryByText('protected-content')).toBeNull()
  })
})
