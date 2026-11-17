import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { supabaseAuthAdapter } from './auth'
import { setSupabaseClientForUnitTests } from './client'
import { registerSupabaseCleanup } from './lifecycle'

const user = { id: 'user-1', email: 'tester@example.test', app_metadata: {} } as User
const profile = { id: user.id, role: 'player', display_name: 'Tester', avatar_url: null, bio: null, created_at: '2026-01-01' }

function fakeClient(overrides: Record<string, unknown> = {}) {
  const maybeSingle = vi.fn().mockResolvedValue({ data: profile, error: null })
  const query = { select: vi.fn(() => query), eq: vi.fn(() => query), maybeSingle }
  const auth = {
    signInWithPassword: vi.fn().mockResolvedValue({ data: { user }, error: null }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
    getSession: vi.fn().mockResolvedValue({ data: { session: { user } }, error: null }),
    signUp: vi.fn().mockResolvedValue({ data: { user, session: null }, error: null }),
    verifyOtp: vi.fn().mockResolvedValue({ data: { user, session: { user } }, error: null }),
    onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    ...(overrides.auth as object),
  }
  return { auth, from: vi.fn(() => query), ...overrides } as unknown as SupabaseClient
}

afterEach(() => setSupabaseClientForUnitTests(null))

describe('Supabase auth adapter (unit)', () => {
  it('đăng nhập bằng email và map hồ sơ', async () => {
    const client = fakeClient()
    setSupabaseClientForUnitTests(client)
    const result = await supabaseAuthAdapter.emailAuth!.login(' tester@example.test ', 'password')
    expect(client.auth.signInWithPassword).toHaveBeenCalledWith({ email: 'tester@example.test', password: 'password' })
    expect(result.user.displayName).toBe('Tester')
  })

  it('map lỗi sai mật khẩu sang tiếng Việt', async () => {
    setSupabaseClientForUnitTests(fakeClient({ auth: { signInWithPassword: vi.fn().mockResolvedValue({ data: {}, error: new Error('Invalid login credentials') }) } }))
    await expect(supabaseAuthAdapter.emailAuth!.login('x@example.test', 'bad')).rejects.toThrow('Email hoặc mật khẩu không đúng')
  })

  it('khôi phục phiên thường nhưng coi anonymous là khách', async () => {
    setSupabaseClientForUnitTests(fakeClient())
    await expect(supabaseAuthAdapter.restore()).resolves.toMatchObject({ displayName: 'Tester' })
    setSupabaseClientForUnitTests(fakeClient({ auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { user: { ...user, is_anonymous: true } } }, error: null }) } }))
    await expect(supabaseAuthAdapter.restore()).resolves.toBeNull()
  })

  it('đăng ký chuyển sang OTP rồi xác minh', async () => {
    const client = fakeClient()
    setSupabaseClientForUnitTests(client)
    await expect(supabaseAuthAdapter.emailAuth!.signUp('new@example.test', 'password', 'New User')).resolves.toEqual({ needsOtp: true, user: null })
    await expect(supabaseAuthAdapter.emailAuth!.verifyOtp('new@example.test', '123456')).resolves.toMatchObject({ user: { displayName: 'Tester' } })
    expect(client.auth.verifyOtp).toHaveBeenCalledWith({ email: 'new@example.test', token: '123456', type: 'email' })
  })

  it('đăng xuất dọn subscription runtime trước khi signOut', async () => {
    const cleanup = vi.fn()
    registerSupabaseCleanup(cleanup)
    const client = fakeClient()
    setSupabaseClientForUnitTests(client)
    await supabaseAuthAdapter.logout()
    expect(cleanup).toHaveBeenCalledOnce()
    expect(client.auth.signOut).toHaveBeenCalledOnce()
  })
})
