import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { setSupabaseClientForUnitTests } from './client'
import { mapSupabaseProfile, supabaseProfileAdapter } from './profile'
import type { GameProfileRow, ProfileRow } from './types'

const account: ProfileRow = { id: 'u1', role: 'player', display_name: 'An', avatar_url: null, bio: 'Xin chào', created_at: '2026-01-01' }
const game: GameProfileRow = { id: 'g1', user_id: 'u1', ingame_name: 'AnGame', game_uid: '123', current_tier: '3', current_rank: 'Cao thủ', main_roles: [], system_mmr: 1000, created_at: '2026-01-01' }

afterEach(() => setSupabaseClientForUnitTests(null))

describe('Supabase profile adapter (unit)', () => {
  it('map profiles + game_profiles mà không bịa thống kê', () => {
    const result = mapSupabaseProfile(account, game, 'u1')
    expect(result.player.name).toBe('An')
    expect(result.uid).toBe('123')
    expect(result.hasGameData).toBe(false)
    expect(result.history).toEqual([])
    expect(result.achievements).toEqual([])
  })

  it('map được khi thiếu game profile', () => {
    expect(mapSupabaseProfile(account, null, 'u1')).toMatchObject({ uid: 'Chưa liên kết', playerBadge: 'Chưa có hạng' })
  })

  it('chỉ update cột profile được policy cho phép và đổi UID qua RPC', async () => {
    const single = vi.fn().mockResolvedValue({ data: account, error: null })
    const updateQuery = { eq: vi.fn(() => updateQuery), select: vi.fn(() => updateQuery), single }
    const update = vi.fn(() => updateQuery)
    const client = {
      auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: 'u1' } } }, error: null }) },
      from: vi.fn(() => ({ update })),
      rpc: vi.fn().mockResolvedValue({ data: game, error: null }),
    } as unknown as SupabaseClient
    setSupabaseClientForUnitTests(client)
    await supabaseProfileAdapter.update({ displayName: 'Mới', bio: 'Bio', bioExtra: 'không có cột', avatarUrl: null })
    expect(update).toHaveBeenCalledWith({ display_name: 'Mới', avatar_url: null, bio: 'Bio' })
    await supabaseProfileAdapter.requestGameUidChange!(' 999 ')
    expect(client.rpc).toHaveBeenCalledWith('request_game_uid_change', { new_game_uid: '999' })
  })
})
