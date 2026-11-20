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

function completePreparingSnapshot(): OpenRoomSnapshot {
  const members = Array.from({ length: 10 }, (_, index) => ({
    id: `lineup-${index + 1}`,
    room_id: 'room-1',
    user_id: index === 0 ? 'host-1' : `lineup-user-${index + 1}`,
    member_kind: 'account' as const,
    display_name: `Lineup ${index + 1}`,
    status: 'active' as const,
    joined_at: '',
    left_at: null,
  }))
  return {
    ...baseSnapshot,
    members,
    selected: members.map((member, index) => ({
      memberId: member.id,
      displayName: member.display_name,
      queueSeq: index + 1,
      queueStatus: 'selected' as const,
      slot: index + 1,
      team: (index < 5 ? 'a' : 'b') as 'a' | 'b',
      skillMode: 'random' as const,
      skillValue: null,
      skillScore: null,
    })),
  }
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
  it('routes configured Room Start to start_series_game and never legacy lifecycle RPCs', async () => {
    const base = completePreparingSnapshot()
    const configured: OpenRoomSnapshot = { ...base, room: { ...base.room, best_of: 5 } }
    const rpc = setFakeRpc({ data: { id: 'game-1' }, error: null })
    const { result } = renderHook(() => useOpenRoomActions('room-1', configured))
    await act(async () => { await result.current.start() })
    expect(rpc).toHaveBeenCalledExactlyOnceWith('start_series_game', { p_room_id: 'room-1', p_version: 7 })
    expect(rpc).not.toHaveBeenCalledWith('start_open_room_round', expect.anything())
    expect(rpc).not.toHaveBeenCalledWith('end_open_room_round', expect.anything())
  })

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

  it('replace chỉ gọi một RPC, không sửa bù đội hình trên client', async () => {
    const before = completePreparingSnapshot()
    before.selected = before.selected.map((player) => player.memberId === 'lineup-6'
      ? { ...player, skillMode: 'tier', skillValue: 'Tinh Anh', skillScore: 42 }
      : player)
    const replacementMember = {
      id: 'replacement', room_id: 'room-1', user_id: 'replacement-user', member_kind: 'account' as const,
      display_name: 'Replacement', status: 'active' as const, joined_at: '', left_at: null,
    }
    const refreshed: OpenRoomSnapshot = {
      ...before,
      room: { ...before.room, version: 8 },
      version: 8,
      members: [...before.members.filter((member) => member.id !== 'lineup-3'), replacementMember],
      selected: before.selected.map((player) => player.memberId === 'lineup-3'
        ? {
            ...player,
            memberId: replacementMember.id,
            displayName: replacementMember.display_name,
            team: null,
            skillMode: 'rank' as const,
            skillValue: 'Cao Thủ',
            skillScore: 88,
          }
        : { ...player, team: null }),
    }
    const rpc = setFakeRpc({ data: null, error: null })
    rpc
      .mockResolvedValueOnce({ data: { ...before.room, version: 8 }, error: null })
      .mockResolvedValueOnce({ data: { ...before.room, version: 9 }, error: null })
    const refetch = vi.fn().mockResolvedValue(refreshed)
    const unregister = registerOpenRoomRefetch('room-1', refetch)
    const { result } = renderHook(() => useOpenRoomActions('room-1', before))

    await act(async () => {
      await expect(result.current.replace('lineup-3')).resolves.toEqual({
        ok: true,
        data: { ...before.room, version: 8 },
      })
    })

    expect(rpc).toHaveBeenNthCalledWith(1, 'replace_open_room_player', {
      p_room_id: 'room-1', p_version: 7, p_member_id: 'lineup-3',
    })
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(refetch).toHaveBeenCalledTimes(1)
    unregister()
  })

  it('replace không tự lưu lại khi đội hình cũ chưa đủ 5v5', async () => {
    const rpc = setFakeRpc({ data: baseSnapshot.room, error: null })
    const refetch = vi.fn().mockResolvedValue(baseSnapshot)
    const unregister = registerOpenRoomRefetch('room-1', refetch)
    const { result } = renderHook(() => useOpenRoomActions('room-1', baseSnapshot))

    await act(async () => {
      await expect(result.current.replace('member-1')).resolves.toEqual({ ok: true, data: baseSnapshot.room })
    })

    expect(rpc).toHaveBeenCalledTimes(1)
    expect(refetch).toHaveBeenCalledTimes(1)
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

  it('gộp hai lần gọi cùng action khi mutation đầu vẫn đang chạy', async () => {
    const rpc = setFakeRpc({ data: baseSnapshot.room, error: null })
    const { result } = renderHook(() => useOpenRoomActions('room-1', baseSnapshot))

    await act(async () => {
      const first = result.current.replace('member-1')
      const second = result.current.replace('member-2')
      expect(second).toBe(first)
      await Promise.all([first, second])
    })

    expect(rpc).toHaveBeenCalledTimes(1)
    expect(rpc).toHaveBeenCalledWith('replace_open_room_player', {
      p_room_id: 'room-1', p_version: 7, p_member_id: 'member-1',
    })
  })
})

describe('openRoomPermissions', () => {
  it.each([
    ['idle', { prepare: true, saveLineup: false, start: false, end: false }],
    ['preparing', { prepare: false, saveLineup: true, start: true, end: false }],
    ['active', { prepare: false, saveLineup: false, start: false, end: true }],
    ['ended', { prepare: true, saveLineup: false, start: false, end: false }],
  ] as const)('host ở pha %s có đúng quyền vòng', (phase, expected) => {
    const source = phase === 'preparing' ? completePreparingSnapshot() : baseSnapshot
    const permissions = openRoomPermissions({ ...source, room: { ...source.room, current_round_state: phase } }, 'host-1')
    expect(permissions).toMatchObject({ role: 'host', close: true, addPlayer: true, kick: true, replace: expected.saveLineup, ...expected })
  })

  it('chỉ cho bắt đầu khi đội hình khớp đủ điều kiện active 5v5 của SQL', () => {
    const complete = completePreparingSnapshot()
    expect(openRoomPermissions(complete, 'host-1').start).toBe(true)

    const unassigned = {
      ...complete,
      selected: complete.selected.map((player, index) => index === 0 ? { ...player, team: null } : player),
    }
    expect(openRoomPermissions(unassigned, 'host-1').start).toBe(false)

    const inactive = {
      ...complete,
      members: complete.members.map((member, index) => index === 0 ? { ...member, status: 'left' as const } : member),
    }
    expect(openRoomPermissions(inactive, 'host-1').start).toBe(false)

    const invalidQueue = {
      ...complete,
      selected: complete.selected.map((player, index) => index === 0 ? { ...player, queueStatus: 'waiting' as const } : player),
    }
    expect(openRoomPermissions(invalidQueue, 'host-1').start).toBe(false)

    const missingRatedSkill = {
      ...complete,
      selected: complete.selected.map((player, index) => index === 0
        ? { ...player, skillMode: 'tier' as const, skillValue: 'Tinh Anh', skillScore: null }
        : player),
    }
    expect(openRoomPermissions(missingRatedSkill, 'host-1').start).toBe(false)
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

  it('tính quyền theo đúng memberId cho kick, requeue và replace', () => {
    const snapshot: OpenRoomSnapshot = {
      ...baseSnapshot,
      members: [
        ...baseSnapshot.members,
        { id: 'guest-off-queue', room_id: 'room-1', user_id: null, member_kind: 'guest', display_name: 'Guest off queue', status: 'active', joined_at: '', left_at: null },
        { id: 'guest-waiting', room_id: 'room-1', user_id: null, member_kind: 'guest', display_name: 'Guest waiting', status: 'active', joined_at: '', left_at: null },
      ],
      waiting: [
        ...baseSnapshot.waiting,
        { memberId: 'guest-waiting', displayName: 'Guest waiting', queueSeq: 2, queueStatus: 'waiting' },
      ],
      selected: [
        { memberId: 'member-1', displayName: 'Member', queueSeq: 3, queueStatus: 'selected', slot: 1, team: 'a' },
      ],
    }
    const permissions = openRoomPermissions(snapshot, 'host-1')

    expect(permissions.canKickMember('host-member')).toBe(false)
    expect(permissions.canKickMember('member-1')).toBe(true)
    expect(permissions.canRequeueMember('guest-off-queue')).toBe(true)
    expect(permissions.canRequeueMember('guest-waiting')).toBe(false)
    expect(permissions.canRequeueMember('member-1')).toBe(false)
    expect(permissions.canReplaceMember('member-1')).toBe(true)
    expect(permissions.canReplaceMember('guest-off-queue')).toBe(false)
  })
})
