import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'

afterEach(() => { cleanup(); vi.unstubAllEnvs(); vi.resetModules() })
it.each(['', 'invalid'])('renders a visible safe configuration error for source "%s"', async source => {
  vi.stubEnv('VITE_DATA_SOURCE', source)
  vi.resetModules()
  const { default: App } = await import('./App')
  render(<App />)
  expect(screen.getByRole('heading', { name: 'Chưa cấu hình nguồn dữ liệu' })).toBeTruthy()
  expect(screen.queryByText('suthy')).toBeNull()
})
it('selects real Supabase Auth/Profile/Rooms and isolates mock rooms in search', async () => {
  vi.stubEnv('VITE_DATA_SOURCE', 'supabase')
  vi.resetModules()
  const { authAdapter, roomsAdapter, profileAdapter, searchAdapter } = await import('./api/adapters')
  expect(authAdapter.authFlow).toBe('supabase')
  expect(authAdapter.initial()).toEqual({ loggedIn: false, user: null })
  expect(profileAdapter.isSampleData).toBe(false)
  expect(roomsAdapter.initial({})).toEqual([])
  expect(searchAdapter.initial('')).toEqual({ rooms: [], tournaments: [], players: [] })
})
