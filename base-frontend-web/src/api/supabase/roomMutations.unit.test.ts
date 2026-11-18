import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { setSupabaseClientForUnitTests } from './client'
import {
  closeOpenRoom,
  continueOpenRoomQueue,
  createOpenRoom,
  endOpenRoomRound,
  hostAddPlayerToRoom,
  hostKickRoomMember,
  hostRequeueRoomMember,
  joinOpenRoom,
  leaveOpenRoom,
  mapRoomMutationError,
  prepareNextOpenRoomRound,
  replaceOpenRoomPlayer,
  saveOpenRoomLineup,
  startOpenRoomRound,
  swapLineupPlayers,
  type OpenRoomLineupPlayer,
} from './roomMutations'

function fakeClient(user: Record<string, unknown> | null = { id: 'user-1', app_metadata: {} }) {
  const rpc = vi.fn().mockResolvedValue({ data: { id: 'result' }, error: null })
  const client = {
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: user ? { user } : null }, error: null }) },
    rpc,
  } as unknown as SupabaseClient
  setSupabaseClientForUnitTests(client)
  return { client, rpc }
}

const lineup: OpenRoomLineupPlayer[] = Array.from({ length: 10 }, (_, index) => ({
  member_id: `member-${index + 1}`,
  team: index < 5 ? 'a' : 'b',
  skill_mode: 'random',
  skill_value: null,
  skill_score: null,
}))

afterEach(() => {
  setSupabaseClientForUnitTests(null)
  vi.restoreAllMocks()
})

describe('Open Room mutation RPC adapter', () => {
  it.each([
    ['create_open_room', () => createOpenRoom(), {}],
    ['close_open_room', () => closeOpenRoom(' room-1 '), { p_room_id: 'room-1' }],
    ['join_open_room', () => joinOpenRoom(' INVITE-CODE-12 ', ' Tên '), { p_invite_code: 'INVITE-CODE-12', p_display_name: 'Tên' }],
    ['leave_open_room', () => leaveOpenRoom(' room-1 '), { p_room_id: 'room-1' }],
    ['host_add_player_to_room', () => hostAddPlayerToRoom('room-1', ' Người giả lập '), { p_room_id: 'room-1', p_display_name: 'Người giả lập' }],
    ['host_kick_room_member', () => hostKickRoomMember('room-1', 'member-1'), { p_room_id: 'room-1', p_member_id: 'member-1' }],
    ['host_requeue_room_member', () => hostRequeueRoomMember('room-1', 'member-1'), { p_room_id: 'room-1', p_member_id: 'member-1' }],
    ['continue_open_room_queue', () => continueOpenRoomQueue('room-1'), { p_room_id: 'room-1' }],
    ['prepare_next_open_room_round', () => prepareNextOpenRoomRound('room-1'), { p_room_id: 'room-1' }],
    ['start_open_room_round', () => startOpenRoomRound('room-1'), { p_room_id: 'room-1' }],
    ['end_open_room_round', () => endOpenRoomRound('room-1'), { p_room_id: 'room-1' }],
    ['save_open_room_lineup', () => saveOpenRoomLineup('room-1', 7, lineup), { p_room_id: 'room-1', p_version: 7, p_players: lineup }],
    ['replace_open_room_player', () => replaceOpenRoomPlayer('room-1', 7, 'member-1'), { p_room_id: 'room-1', p_version: 7, p_member_id: 'member-1' }],
  ])('gọi đúng %s và tham số SQL', async (rpcName, call, args) => {
    const { rpc } = fakeClient()
    await expect(call()).resolves.toEqual({ ok: true, data: { id: 'result' } })
    expect(rpc).toHaveBeenCalledWith(rpcName, args)
  })

  it('trim input, chặn tên quá 40 ký tự trước khi gọi RPC', async () => {
    const { rpc } = fakeClient()
    const result = await hostAddPlayerToRoom(' room-1 ', 'x'.repeat(41))
    expect(result).toEqual({ ok: false, error: expect.objectContaining({ kind: 'invalid_input', sourceMessage: 'Display name is required' }) })
    expect(rpc).not.toHaveBeenCalled()
  })

  it.each([
    [null, 'Authentication required'],
    [{ id: 'anon', is_anonymous: true, app_metadata: {} }, 'Permanent account required'],
    [{ id: 'anon', app_metadata: { is_anonymous: true } }, 'Permanent account required'],
  ])('chặn phiên thiếu/permanent anonymous', async (user, sourceMessage) => {
    const { rpc } = fakeClient(user)
    const result = await createOpenRoom()
    expect(result).toEqual({ ok: false, error: expect.objectContaining({ kind: 'auth_required', sourceMessage }) })
    expect(rpc).not.toHaveBeenCalled()
  })

  it.each([
    ['Room changed; refresh and retry', 'version_conflict'],
    ['Queue changed; refresh and retry', 'version_conflict'],
    ['Host only', 'forbidden'],
    ['permission denied for table rooms', 'forbidden'],
    ['Room member not found', 'not_found'],
    ['Round is not preparing', 'invalid_state'],
    ['Queue full', 'queue_full'],
    ['Ten waiting players required to prepare a 5v5 Round', 'not_enough_players'],
    ['Permanent account required', 'auth_required'],
    ['Invalid lineup values', 'invalid_input'],
    ['Failed to fetch', 'network'],
    ['unexpected database detail', 'unknown'],
  ])('ánh xạ lỗi SQL %s thành %s và không lộ SQL ra message UI', (message, kind) => {
    const mapped = mapRoomMutationError({ message })
    expect(mapped.kind).toBe(kind)
    expect(mapped.sourceMessage).toBe(message)
    expect(mapped.message).not.toBe(message)
  })
})

describe('swapLineupPlayers', () => {
  it('đổi team của đúng hai người và không mutate lineup gốc', () => {
    const original = lineup.map((player) => ({ ...player }))
    const swapped = swapLineupPlayers(original, 'member-1', 'member-6')
    expect(swapped.find((player) => player.member_id === 'member-1')?.team).toBe('b')
    expect(swapped.find((player) => player.member_id === 'member-6')?.team).toBe('a')
    expect(original).toEqual(lineup)
    expect(swapped).not.toBe(original)
  })

  it('từ chối hai người cùng đội hoặc không tồn tại', () => {
    expect(() => swapLineupPlayers(lineup, 'member-1', 'member-2')).toThrow('Chọn hai người chơi thuộc hai đội khác nhau.')
    expect(() => swapLineupPlayers(lineup, 'member-1', 'missing')).toThrow('Chọn hai người chơi thuộc hai đội khác nhau.')
  })
})
