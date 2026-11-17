import type { Me } from '@customaov/contracts'
import type { User } from '@supabase/supabase-js'
import type { AuthAdapter } from '../adapter'
import { clearDataCache } from '../hooks'
import { getSupabaseClient } from './client'
import { mapSupabaseAuthError, throwSupabase } from './errors'
import { clearSupabaseRuntime } from './lifecycle'
import type { ProfileRow } from './types'

const capabilities = { readyImmediately: false, supportsRealtime: true, persistsWrites: true, isSampleData: false, showsSampleBadge: false } as const

function safeUsername(value: string): string {
  const normalized = value.toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/^_+|_+$/g, '')
  return (normalized || 'user').slice(0, 20).padEnd(3, '0')
}

function uidFromId(id: string): string {
  let hash = 0
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return String(hash % 1_000_000).padStart(6, '0')
}

export function isAnonymousSupabaseUser(user: User | null | undefined): boolean {
  return Boolean(user?.is_anonymous || user?.app_metadata?.is_anonymous === true)
}

export async function mapSupabaseUser(user: User): Promise<Me> {
  const client = getSupabaseClient()
  const { data, error } = await client
    .from('profiles')
    .select('id, role, display_name, avatar_url, bio, created_at')
    .eq('id', user.id)
    .maybeSingle<ProfileRow>()
  if (error) throwSupabase(error)
  const emailPrefix = user.email?.split('@')[0] || 'user'
  const displayName = data?.display_name?.trim() || emailPrefix
  return {
    id: user.id,
    username: safeUsername(data?.display_name || emailPrefix),
    displayName: displayName.slice(0, 24),
    avatarUrl: data?.avatar_url ?? null,
    level: 1,
    crowned: data?.role === 'admin' || data?.role === 'organizer',
    uid: uidFromId(user.id),
  }
}

async function meFromUser(user: User | null | undefined): Promise<Me | null> {
  return !user || isAnonymousSupabaseUser(user) ? null : mapSupabaseUser(user)
}

export const supabaseAuthAdapter: AuthAdapter = {
  ...capabilities,
  authFlow: 'supabase',
  initial: () => ({ loggedIn: false, user: null }),
  async restore() {
    const { data, error } = await getSupabaseClient().auth.getSession()
    if (error) throw mapSupabaseAuthError(error)
    return meFromUser(data.session?.user)
  },
  subscribe(onChange) {
    const { data } = getSupabaseClient().auth.onAuthStateChange((_event, session) => {
      void meFromUser(session?.user).then(
        (user) => onChange(Boolean(user), user),
        () => onChange(false, null),
      )
    })
    return () => data.subscription.unsubscribe()
  },
  remember: () => undefined,
  async login(body) {
    return this.emailAuth!.login(body.username, body.password)
  },
  async register(body) {
    const result = await this.emailAuth!.signUp(body.username, body.password, body.displayName)
    if (!result.user) throw new Error('OTP verification required')
    return { user: result.user }
  },
  async logout() {
    await clearSupabaseRuntime()
    clearDataCache()
    const { error } = await getSupabaseClient().auth.signOut()
    if (error) throw mapSupabaseAuthError(error)
  },
  emailAuth: {
    async login(email, password) {
      const { data, error } = await getSupabaseClient().auth.signInWithPassword({ email: email.trim(), password })
      if (error) throw mapSupabaseAuthError(error)
      const user = await meFromUser(data.user)
      if (!user) throw new Error('Phiên anonymous không phải tài khoản đăng nhập.')
      return { user }
    },
    async signUp(email, password, displayName) {
      const { data, error } = await getSupabaseClient().auth.signUp({
        email: email.trim(),
        password,
        options: { data: { display_name: displayName.trim(), ingame_name: displayName.trim() } },
      })
      if (error) throw mapSupabaseAuthError(error)
      const user = data.session ? await meFromUser(data.user) : null
      return { needsOtp: !data.session, user }
    },
    async verifyOtp(email, token) {
      const { data, error } = await getSupabaseClient().auth.verifyOtp({ email: email.trim(), token: token.trim(), type: 'email' })
      if (error) throw mapSupabaseAuthError(error)
      const user = await meFromUser(data.user)
      if (!user) throw new Error('Không thể khôi phục tài khoản sau khi xác minh.')
      return { user }
    },
  },
}
