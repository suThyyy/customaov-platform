import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { mapOpenRoomSnapshot } from '../../api/supabase/room'
import type { OpenRoomSnapshotPayload } from '../../api/supabase/types'
import { SupabaseRoomSnapshot } from './SupabaseRoomView'

const roomPayload: OpenRoomSnapshotPayload = {
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

describe('SupabaseRoomView (unit)', () => {
  it('render waiting FIFO, selected theo slot và trạng thái realtime', () => {
    const snapshot = mapOpenRoomSnapshot({
      ...roomPayload,
      queue: [
        ...roomPayload.queue,
        { id: 'q3', room_id: 'room-1', member_id: 'm1', queue_seq: 3, status: 'waiting', joined_at: '2026-01-01', selected_round_no: null },
      ],
    }, 'u1')
    render(<SupabaseRoomSnapshot snapshot={snapshot} connection="live" />)
    expect(screen.getByRole('heading', { name: 'Phòng #ABC123' })).toBeTruthy()
    expect(screen.getByText('Đang cập nhật trực tiếp')).toBeTruthy()
    const waiting = screen.getByRole('heading', { name: /Đang chờ/ }).closest('section, div') as HTMLElement
    expect(within(waiting).getAllByText(/FIFO #/).map((node) => node.textContent)).toEqual(['FIFO #2', 'FIFO #3'])
    expect(screen.getByRole('cell', { name: '3' })).toBeTruthy()
    expect(screen.getByText('Thao tác phòng sẽ có ở bản sau.')).toBeTruthy()
  })
})
