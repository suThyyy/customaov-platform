import { useCallback, useEffect, useRef, useState } from 'react'
import { DATA_SOURCE } from './source'
import { getSupabaseClient } from './supabase/client'

export type PlatformRole = 'guest' | 'user' | 'admin' | 'super_admin'
export const isOrganizerRole = (role: PlatformRole | null) => role === 'admin' || role === 'super_admin'
export function parsePlatformRole(value: unknown): PlatformRole {
  if (value === 'user' || value === 'admin' || value === 'super_admin') return value
  throw new Error('Không xác định được quyền tài khoản.')
}
export function usePlatformRole(loggedIn: boolean, userId?: string) {
  const [state, setState] = useState<{ identity: string; role: PlatformRole | null; loading: boolean; error: string | null }>({ identity: '', role: null, loading: false, error: null })
  const [mockRole, setMockRole] = useState<PlatformRole>(() => {
    if (DATA_SOURCE !== 'mock') return 'user'
    try { return parsePlatformRole(sessionStorage.getItem('customaov.mockRole') ?? 'user') } catch { return 'user' }
  })
  const generation = useRef(0)
  const identity = loggedIn ? userId ?? 'mock-session' : ''
  const refreshRole = useCallback(async (invalidate = false) => {
    const token = ++generation.current
    if (!loggedIn) { setState({ identity: '', role: 'guest', loading: false, error: null }); return }
    // A routine background refresh must not unmount forms every minute.
    // Account changes, denied RPCs and failed reads still invalidate privilege.
    setState(previous => !invalidate && previous.identity === identity && previous.role !== null
      ? previous : { identity, role: null, loading: true, error: null })
    try {
      let role: PlatformRole = 'user'
      if (DATA_SOURCE === 'mock') role = mockRole
      else if (DATA_SOURCE === 'supabase') {
        const result = await getSupabaseClient().rpc('read_my_platform_role')
        if (result.error) throw new Error('Chưa đọc được quyền từ máy chủ. Thử lại sau khi migration được triển khai.')
        role = parsePlatformRole(result.data)
      }
      if (token === generation.current) setState({ identity, role, loading: false, error: null })
    } catch (error) {
      if (token === generation.current) setState({ identity, role: null, loading: false, error: error instanceof Error ? error.message : 'Không đọc được quyền.' })
    }
  }, [loggedIn, identity, mockRole])
  useEffect(() => {
    const requestGeneration = generation
    void refreshRole()
    const refresh = () => { void refreshRole() }
    const invalidate = () => { void refreshRole(true) }
    window.addEventListener('focus', refresh)
    window.addEventListener('customaov:permission-denied', invalidate)
    const interval = window.setInterval(refresh, 60000)
    return () => { requestGeneration.current++; window.removeEventListener('focus', refresh); window.removeEventListener('customaov:permission-denied', invalidate); window.clearInterval(interval) }
  }, [refreshRole])
  return {
    role: !loggedIn ? 'guest' as const : DATA_SOURCE === 'mock' ? mockRole : state.identity === identity ? state.role : null,
    roleLoading: DATA_SOURCE !== 'mock' && loggedIn && (state.identity !== identity || state.loading),
    roleError: loggedIn && state.identity === identity ? state.error : null,
    refreshRole,
    setMockRole: (role: PlatformRole) => {
      if (DATA_SOURCE !== 'mock' || !['user', 'admin', 'super_admin'].includes(role)) return
      try { sessionStorage.setItem('customaov.mockRole', role) } catch { /* In-memory demo remains usable. */ }
      setMockRole(role)
    },
  }
}
