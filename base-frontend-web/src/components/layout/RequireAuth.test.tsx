import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { AppProviders } from '../../context/AppContext'
import { RequireAuth } from './RequireAuth'

const KEY = 'customaov.mockLoggedIn'

function Landing() {
  const { search } = useLocation()
  return <p>landing{search}</p>
}

function renderAt(path: string) {
  return render(
    <AppProviders>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route element={<RequireAuth />}>
            <Route path="/dashboard" element={<p>dashboard</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AppProviders>,
  )
}

beforeEach(() => localStorage.clear())
afterEach(cleanup)

describe('RequireAuth', () => {
  it('khách vào route nội bộ → chuyển tới /?login=login&next=<route>', () => {
    renderAt('/dashboard?tab=1#rooms')
    expect(screen.getByText(`landing?login=login&next=${encodeURIComponent('/dashboard?tab=1#rooms')}`)).toBeTruthy()
  })

  it('có session trong localStorage → khôi phục và hiển thị trang', () => {
    localStorage.setItem(KEY, '1')
    renderAt('/dashboard')
    expect(screen.getByText('dashboard')).toBeTruthy()
  })
})
