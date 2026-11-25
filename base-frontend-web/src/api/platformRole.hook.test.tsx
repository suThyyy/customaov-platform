import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { usePlatformRole } from './platformRole'

const fixture = vi.hoisted(() => ({ source: 'supabase', rpc: vi.fn() }))
vi.mock('./source', () => ({ get DATA_SOURCE() { return fixture.source } }))
vi.mock('./supabase/client', () => ({ getSupabaseClient: () => ({ rpc: fixture.rpc }) }))
beforeEach(() => { fixture.source = 'supabase'; fixture.rpc.mockReset(); sessionStorage.clear() })
afterEach(cleanup)
describe('role session boundary', () => {
  it('preserves loaded forms during a routine refresh but invalidates on rejection', async () => {
    fixture.rpc.mockResolvedValueOnce({ data: 'admin', error: null }).mockImplementation(() => new Promise(() => {}))
    const { result } = renderHook(() => usePlatformRole(true, 'account-a'))
    await waitFor(() => expect(result.current.role).toBe('admin'))
    act(() => window.dispatchEvent(new Event('focus')))
    expect(result.current.role).toBe('admin'); expect(result.current.roleLoading).toBe(false)
    act(() => window.dispatchEvent(new Event('customaov:permission-denied')))
    expect(result.current.role).toBeNull(); expect(result.current.roleLoading).toBe(true)
  })
  it('refreshes after a permission denial', async () => {
    fixture.rpc.mockResolvedValueOnce({ data: 'admin', error: null }).mockResolvedValueOnce({ data: 'user', error: null })
    const { result } = renderHook(() => usePlatformRole(true, 'account-a'))
    await waitFor(() => expect(result.current.role).toBe('admin'))
    act(() => window.dispatchEvent(new Event('customaov:permission-denied')))
    await waitFor(() => expect(result.current.role).toBe('user'))
  })
  it('does not read Supabase for a guest', () => {
    const { result } = renderHook(() => usePlatformRole(false))
    expect(result.current.role).toBe('guest'); expect(fixture.rpc).not.toHaveBeenCalled()
  })
  it('keeps an unresolved role unavailable then reads the trusted role', async () => {
    let resolve!: (value: unknown) => void
    fixture.rpc.mockImplementation(() => new Promise(done => { resolve = done }))
    const { result } = renderHook(() => usePlatformRole(true, 'account-a'))
    expect(result.current.roleLoading).toBe(true); expect(result.current.role).toBeNull()
    await act(async () => resolve({ data: 'admin', error: null }))
    expect(result.current.role).toBe('admin'); expect(result.current.roleLoading).toBe(false)
    expect(fixture.rpc).toHaveBeenCalledWith('read_my_platform_role')
  })
  it('ignores a privileged read that completes after logout', async () => {
    let resolve!: (value: unknown) => void
    fixture.rpc.mockImplementation(() => new Promise(done => { resolve = done }))
    const { result, rerender } = renderHook(({ loggedIn }) => usePlatformRole(loggedIn, 'account-a'), { initialProps: { loggedIn: true } })
    rerender({ loggedIn: false })
    await act(async () => resolve({ data: 'super_admin', error: null }))
    expect(result.current.role).toBe('guest'); expect(result.current.roleError).toBeNull()
  })
  it('refreshes a revoked role from current server state', async () => {
    fixture.rpc.mockResolvedValueOnce({ data: 'admin', error: null }).mockResolvedValueOnce({ data: 'user', error: null })
    const { result } = renderHook(() => usePlatformRole(true, 'account-a'))
    await waitFor(() => expect(result.current.role).toBe('admin'))
    await act(async () => result.current.refreshRole())
    expect(result.current.role).toBe('user')
  })
  it('fails closed on RPC failure without mock fallback', async () => {
    fixture.rpc.mockResolvedValue({ data: null, error: { message: 'denied' } })
    const { result } = renderHook(() => usePlatformRole(true, 'account-a'))
    await waitFor(() => expect(result.current.roleError).toBeTruthy())
    expect(result.current.role).toBeNull()
    act(() => result.current.setMockRole('super_admin'))
    expect(result.current.role).toBeNull()
  })
  it('supports mock personas without a Supabase request', async () => {
    fixture.source = 'mock'
    const { result } = renderHook(() => usePlatformRole(true, 'mock-account'))
    await waitFor(() => expect(result.current.role).toBe('user'))
    for (const role of ['admin', 'super_admin', 'user'] as const) {
      act(() => result.current.setMockRole(role))
      await waitFor(() => expect(result.current.role).toBe(role))
    }
    expect(fixture.rpc).not.toHaveBeenCalled()
  })
})
