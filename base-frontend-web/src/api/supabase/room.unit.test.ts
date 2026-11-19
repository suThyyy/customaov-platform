import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { setSupabaseClientForUnitTests } from './client'
import { mapOpenRoomSnapshot, readOpenRoomSnapshot } from './room'
import type { OpenRoomSnapshotPayload } from './types'

export const roomPayload: OpenRoomSnapshotPayload = {
  room: { id: 'room-1', host_user_id: 'u1', invite_code: 'ABC123', status: 'open', current_round_no: 1, current_round_state: 'preparing', version: 4, created_at: '2026-01-01', closed_at: null },
  members: [
    { id: 'm1', room_id: 'room-1', user_id: 'u1', member_kind: 'account', display_name: 'Một', status: 'active', joined_at: '2026-01-01', left_at: null },
    { id: 'm2', room_id: 'room-1', user_id: 'u2', member_kind: 'account', display_name: 'Hai', status: 'active', joined_at: '2026-01-01', left_at: null },
  ],
  queue: [
    { id: 'q2', room_id: 'room-1', member_id: 'm2', queue_seq: 2, status: 'waiting', joined_at: '2026-01-01', selected_round_no: null },
    { id: 'q1', room_id: 'room-1', member_id: 'm1', queue_seq: 1, status: 'selected', joined_at: '2026-01-01', selected_round_no: 1 },
  ],
  currentPlayers: [{ room_id: 'room-1', round_no: 1, member_id: 'm1', queue_entry_id: 'q1', slot: 3, ready_state: 'ready', team: 'a', skill_mode: null, skill_value: null, skill_score: null }],
}

afterEach(() => setSupabaseClientForUnitTests(null))

describe('Supabase room snapshot adapter (unit)', () => {
  it('sắp waiting theo queue_seq và selected theo slot', () => {
    const mapped = mapOpenRoomSnapshot(roomPayload, 'u1')
    expect(mapped.waiting.map((item) => item.displayName)).toEqual(['Hai'])
    expect(mapped.selected).toEqual([expect.objectContaining({ displayName: 'Một', slot: 3 })])
    expect(mapped.viewer).toEqual({ isHost: true, isMember: true })
  })

  it('lọc thành viên đã rời khỏi hàng chờ nhưng giữ dữ liệu đội hình vòng hiện tại', () => {
    const payload: OpenRoomSnapshotPayload = {
      ...roomPayload,
      members: roomPayload.members.map((member) => member.id === 'm2'
        ? { ...member, status: 'left' as const, left_at: '2026-01-02' }
        : member),
    }
    const mapped = mapOpenRoomSnapshot(payload, 'u1')
    expect(mapped.waiting).toEqual([])
    expect(mapped.selected.map((player) => player.memberId)).toEqual(['m1'])
  })

  it('trả null khi phòng không tồn tại', async () => {
    setSupabaseClientForUnitTests({
      auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: 'u1', app_metadata: {} } } }, error: null }) },
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    } as unknown as SupabaseClient)
    await expect(readOpenRoomSnapshot('missing')).resolves.toBeNull()
  })

  it('không nuốt lỗi RLS', async () => {
    setSupabaseClientForUnitTests({
      auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: 'u1', app_metadata: {} } } }, error: null }) },
      rpc: vi.fn().mockResolvedValue({ data: null, error: { code: '42501', message: 'permission denied' } }),
    } as unknown as SupabaseClient)
    await expect(readOpenRoomSnapshot('room-1')).rejects.toThrow('permission denied')
  })
})
