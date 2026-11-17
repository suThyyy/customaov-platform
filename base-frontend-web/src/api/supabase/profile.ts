import type { UpdateMeBody } from '@customaov/contracts'
import type { ProfileAdapter } from '../adapter'
import type { UserProfile } from '../types'
import { getSupabaseClient } from './client'
import { SupabaseAdapterError, throwSupabase } from './errors'
import type { GameProfileRow, ProfileRow } from './types'

const capabilities = {
  readyImmediately: false,
  supportsRealtime: false,
  persistsWrites: true,
  isSampleData: false,
  showsSampleBadge: false,
} as const

const isMissingRow = (error: { code?: string } | null): boolean => error?.code === 'PGRST116'

export function mapSupabaseProfile(
  account: ProfileRow | null,
  game: GameProfileRow | null,
  userId: string,
): UserProfile {
  const name = account?.display_name?.trim() || game?.ingame_name?.trim() || userId.slice(0, 8)
  return {
    player: {
      id: userId,
      name,
      avatar: account?.avatar_url ?? '',
      crowned: account?.role === 'admin' || account?.role === 'organizer',
      tier: game?.current_tier ?? undefined,
      rankTier: game?.current_rank ?? undefined,
    },
    publicId: `@${userId}`,
    uid: game?.game_uid ?? 'Chưa liên kết',
    roleBadge: account?.role === 'admin' ? 'Quản trị viên' : account?.role === 'organizer' ? 'Ban tổ chức' : 'Người chơi',
    playerBadge: game?.current_rank || 'Chưa có hạng',
    bio: account?.bio?.trim() || 'Chưa có giới thiệu.',
    bioExtra: '',
    achievements: [],
    stats: { totalMatches: 0, winRate: 0, customMatches: 0, mvp: 0 },
    champions: [],
    roles: [],
    history: [],
    hasGameData: false,
  }
}

async function currentUserId(): Promise<string | null> {
  const { data, error } = await getSupabaseClient().auth.getSession()
  if (error) throwSupabase(error)
  const user = data.session?.user
  return !user || user.is_anonymous || user.app_metadata?.is_anonymous === true ? null : user.id
}

export const supabaseProfileAdapter: ProfileAdapter = {
  ...capabilities,
  publicProfileIsLimited: true,
  initial: () => undefined,
  async load(requestedUserId) {
    const ownId = await currentUserId()
    const userId = requestedUserId || ownId
    if (!userId) throw new SupabaseAdapterError('Bạn cần đăng nhập để xem hồ sơ.', 'AUTH_REQUIRED', 401)

    const client = getSupabaseClient()
    const [accountResult, gameResult] = await Promise.all([
      client.from('profiles').select('id, role, display_name, avatar_url, bio, created_at').eq('id', userId).maybeSingle<ProfileRow>(),
      client.from('game_profiles').select('id, user_id, ingame_name, game_uid, current_tier, current_rank, main_roles, system_mmr, uid_changed_at, uid_change_available_at, created_at').eq('user_id', userId).maybeSingle<GameProfileRow>(),
    ])
    if (accountResult.error && !isMissingRow(accountResult.error)) throwSupabase(accountResult.error)
    if (gameResult.error && !isMissingRow(gameResult.error)) throwSupabase(gameResult.error)
    if (!accountResult.data && !gameResult.data) return undefined
    return mapSupabaseProfile(accountResult.data, gameResult.data, userId)
  },
  async update(body: UpdateMeBody) {
    const userId = await currentUserId()
    if (!userId) throw new SupabaseAdapterError('Bạn cần đăng nhập để cập nhật hồ sơ.', 'AUTH_REQUIRED', 401)
    const patch = { display_name: body.displayName, avatar_url: body.avatarUrl, bio: body.bio }
    const { error } = await getSupabaseClient().from('profiles').update(patch).eq('id', userId)
    if (error) throwSupabase(error)
  },
  async requestGameUidChange(gameUid) {
    const normalized = gameUid.trim()
    if (!normalized) throw new SupabaseAdapterError('Game UID không được để trống.', 'INVALID_GAME_UID', 400)
    const { error } = await getSupabaseClient().rpc('request_game_uid_change', { new_game_uid: normalized })
    if (error) throwSupabase(error)
  },
}
