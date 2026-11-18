import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { setSupabaseClientForUnitTests } from './client'
import { openRoomPermissions, useOpenRoomActions } from './roomActions'
import { registerOpenRoomRefetch } from './realtime'
import type { OpenRoomSnapshot } from './types'

const baseSnapshot: OpenRoomSnapshot = {
  room: {
    id: 'room-1', host_user_id: 'host-1', invite_code: 'INVITE-CODE-12', status: 'open',
    current_round_no: 1, current_round_state: 'preparing', version: 7,
    created_at: '2026-11-18', closed_at: null,
  },
  members: [
    { id: 'host-member', room_id: 'room-1', user_id: 'host-1', member_kind: 'account', display_name: 'Host', status: 'active', joined_at: '', left_at: null },
    { id: 'member-1', room_id: 'room-1', user_id: 'user-1', member_kind: 'account', display_name: 'Member', status: 'active', joined_at: '', left_at: null },
  ],
  waiting: [{ memberId: 'host-member', displayName: 'Host', queueSeq: 1, queueStatus: 'waiting' }],
  selected: [],
  version: 7,
  viewer: { isHost: true, isMember: true },
}

function setFakeRpc(result: { data: unknown; error: unknown }) {
  const rpc = vi.fn().mockResolvedValue(result)
  setSupabaseClientForUnitTests({
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: 'host-1', app_metadata: {} } } }, error: null }) },
    rpc,
  } as unknown as SupabaseClient)
  return rpc
}

afterEach(() => {
  setSupabaseClientForUnitTests(null)
  vi.restoreAllMocks()
})

describe('useOpenRoomActions', () => {
  it('gắn roomId/version, pending theo action và refetch snapshot sau thành công', async () => {
    const rpc = setFakeRpc({ data: baseSnapshot.room, error: null })
    const refetch = vi.fn().mockResolvedValue(undefined)
    const unregister = registerOpenRoomRefetch('room-1', refetch)
    const { result } = renderHook(() => useOpenRoomActions('room-1', baseSnapshot))

    await act(async () => {
      await expect(result.current.replace('member-1')).resolves.toEqual({ ok: true, data: baseSnapshot.room })
    })
    expect(rpc).toHaveBeenCalledWith('replace_open_room_player', {
      p_room_id: 'room-1', p_version: 7, p_member_id: 'member-1',
    })
    expect(refetch).toHaveBeenCalledTimes(1)
    expect(result.current.pending.replace).toBe(false)
    unregister()
  })

  it('refetch sau version conflict và vẫn trả lỗi cho UI', async () => {
    setFakeRpc({ data: null, error: { message: 'Room changed; refresh and retry' } })
    const refetch = vi.fn().mockResolvedValue(undefined)
    const unregister = registerOpenRoomRefetch('room-1', refetch)
    const { result } = renderHook(() => useOpenRoomActions('room-1', baseSnapshot))

    let response: Awaited<ReturnType<typeof result.current.replace>> | undefined
    await act(async () => { response = await result.current.replace('member-1') })
    expect(response).toEqual({ ok: false, error: expect.objectContaining({ kind: 'version_conflict', message: 'Phòng vừa thay đổi, đã tải lại.' }) })
    expect(refetch).toHaveBeenCalledTimes(1)
    unregister()
  })
})

describe('openRoomPermissions', () => {
  it.each([
    ['idle', { prepare: true, saveLineup: false, start: false, end: false }],
    ['preparing', { prepare: false, saveLineup: true, start: true, end: false }],
    ['active', { prepare: false, saveLineup: false, start: false, end: true }],
    ['ended', { prepare: true, saveLineup: false, start: false, end: false }],
  ] as const)('host ở pha %s có đúng quyền vòng', (phase, expected) => {
    const permissions = openRoomPermissions({ ...baseSnapshot, room: { ...baseSnapshot.room, current_round_state: phase } }, 'host-1')
    expect(permissions).toMatchObject({ role: 'host', close: true, addPlayer: true, kick: true, replace: expected.saveLineup, ...expected })
  })

  it('member chỉ được leave và requeue chính mình khi không còn waiting/selected', () => {
    const permissions = openRoomPermissions(baseSnapshot, 'user-1')
    expect(permissions).toMatchObject({
      role: 'member', join: false, leave: true, continueQueue: true,
      close: false, addPlayer: false, kick: false, prepare: false, saveLineup: false, start: false, end: false,
    })
  })

  it('spectator chỉ được join phòng đang mở', () => {
    expect(openRoomPermissions(baseSnapshot, 'viewer-1')).toMatchObject({
      role: 'spectator', join: true, leave: false, close: false, continueQueue: false, prepare: false,
    })
    expect(openRoomPermissions({ ...baseSnapshot, room: { ...baseSnapshot.room, status: 'closed' } }, 'viewer-1').join).toBe(false)
  })

  it('member đang waiting không thể continue queue lần nữa', () => {
    const snapshot = {
      ...baseSnapshot,
      waiting: [{ memberId: 'member-1', displayName: 'Member', queueSeq: 2, queueStatus: 'waiting' as const }],
    }
    expect(openRoomPermissions(snapshot, 'user-1').continueQueue).toBe(false)
  })
})
