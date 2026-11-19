import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mapOpenRoomSnapshot } from '../../api/supabase/room'
import type { OpenRoomPending } from '../../api/supabase/roomActions'
import { RoomMutationError, type RoomMutationResult } from '../../api/supabase/roomMutations'
import type { OpenRoomSnapshotPayload } from '../../api/supabase/types'
import { SupabaseRoomSnapshot, type OpenRoomActions } from './SupabaseRoomView'
import { buildLineupFromSelected } from './open-room/helpers'

const BASE_PENDING: OpenRoomPending = {
  close: false,
  leave: false,
  addPlayer: false,
  kick: false,
  requeue: false,
  continueQueue: false,
  prepare: false,
  saveLineup: false,
  replace: false,
  start: false,
  end: false,
}

function makeActions(overrides: Partial<OpenRoomActions> = {}): OpenRoomActions {
  const ok = async () => ({ ok: true, data: null }) as RoomMutationResult<never>
  return {
    pending: BASE_PENDING,
    close: vi.fn(ok),
    leave: vi.fn(ok),
    addPlayer: vi.fn(ok),
    kick: vi.fn(ok),
    requeue: vi.fn(ok),
    continueQueue: vi.fn(ok),
    prepare: vi.fn(ok),
    saveLineup: vi.fn(ok),
    replace: vi.fn(ok),
    start: vi.fn(ok),
    end: vi.fn(ok),
    ...overrides,
  }
}

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

function makeTenPlayerPreparingPayload(): OpenRoomSnapshotPayload {
  const members = Array.from({ length: 10 }, (_, idx) => ({
    id: `m${idx + 1}`,
    room_id: 'room-1',
    user_id: idx === 0 ? 'u1' : `u${idx + 1}`,
    member_kind: 'account' as const,
    display_name: `Player ${idx + 1}`,
    status: 'active' as const,
    joined_at: '2026-01-01',
    left_at: null,
  }))
  const queue = members.map((member, idx) => ({
    id: `q${idx + 1}`,
    room_id: 'room-1',
    member_id: member.id,
    queue_seq: idx + 1,
    status: 'selected' as const,
    joined_at: '2026-01-01',
    selected_round_no: 1,
  }))
  const currentPlayers = members.map((member, idx) => ({
    room_id: 'room-1',
    round_no: 1,
    member_id: member.id,
    queue_entry_id: `q${idx + 1}`,
    slot: idx + 1,
    ready_state: 'ready' as const,
    team: (idx < 5 ? 'a' : 'b') as 'a' | 'b',
    skill_mode: 'random' as const,
    skill_value: null,
    skill_score: null,
  }))
  return {
    room: { ...roomPayload.room, current_round_state: 'preparing' },
    members,
    queue,
    currentPlayers,
  }
}

describe('SupabaseRoomView (unit)', () => {
  afterEach(() => {
    cleanup()
  })

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
    expect(screen.getByText('Lưu kết quả trận: sắp có')).toBeTruthy()
  })

  it('hiển thị đúng nút theo vai trò (chủ phòng vs thành viên vs khán giả) và từng pha', () => {
    const idlePayload: OpenRoomSnapshotPayload = {
      ...roomPayload,
      room: { ...roomPayload.room, current_round_state: 'idle' },
      queue: [
        { id: 'q1', room_id: 'room-1', member_id: 'm1', queue_seq: 1, status: 'waiting', joined_at: '2026-01-01', selected_round_no: null },
        { id: 'q2', room_id: 'room-1', member_id: 'm2', queue_seq: 2, status: 'played', joined_at: '2026-01-01', selected_round_no: null },
      ],
      currentPlayers: [],
    }

    // Chủ phòng ở pha idle
    const hostIdle = mapOpenRoomSnapshot(idlePayload, 'u1')
    const { rerender } = render(<SupabaseRoomSnapshot snapshot={hostIdle} connection="live" userId="u1" actions={makeActions()} />)
    expect(screen.getByRole('button', { name: 'Chuẩn bị vòng' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Đóng phòng' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Sao chép link mời' })).toBeTruthy()

    // Chủ phòng ở pha preparing
    const hostPreparing = mapOpenRoomSnapshot({ ...idlePayload, room: { ...idlePayload.room, current_round_state: 'preparing' } }, 'u1')
    rerender(<SupabaseRoomSnapshot snapshot={hostPreparing} connection="live" userId="u1" actions={makeActions()} />)
    expect((screen.getByRole('button', { name: 'Bắt đầu' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText('Xếp đủ 5v5 rồi mới bắt đầu')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Đổi chỗ' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Chia ngẫu nhiên' })).toBeTruthy()

    // Chủ phòng ở pha active
    const hostActive = mapOpenRoomSnapshot({ ...idlePayload, room: { ...idlePayload.room, current_round_state: 'active' } }, 'u1')
    rerender(<SupabaseRoomSnapshot snapshot={hostActive} connection="live" userId="u1" actions={makeActions()} />)
    expect(screen.getByRole('button', { name: 'Kết thúc' })).toBeTruthy()

    // Chủ phòng ở pha ended
    const hostEnded = mapOpenRoomSnapshot({ ...idlePayload, room: { ...idlePayload.room, current_round_state: 'ended' } }, 'u1')
    rerender(<SupabaseRoomSnapshot snapshot={hostEnded} connection="live" userId="u1" actions={makeActions()} />)
    expect(screen.getByRole('button', { name: 'Vòng tiếp theo' })).toBeTruthy()

    // Thành viên (u2)
    const memberSnap = mapOpenRoomSnapshot(idlePayload, 'u2')
    rerender(<SupabaseRoomSnapshot snapshot={memberSnap} connection="live" userId="u2" actions={makeActions()} />)
    expect(screen.getByRole('button', { name: 'Vào hàng chờ' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Rời phòng' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Chuẩn bị vòng' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Đóng phòng' })).toBeNull()

    // Khán giả (u999)
    const spectatorSnap = mapOpenRoomSnapshot(idlePayload, 'u999')
    rerender(<SupabaseRoomSnapshot snapshot={spectatorSnap} connection="live" userId="u999" actions={makeActions()} />)
    expect(screen.queryByRole('button', { name: 'Vào hàng chờ' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Rời phòng' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Chuẩn bị vòng' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Sao chép link mời' })).toBeNull()
  })

  it('kick mở hộp xác nhận rồi gọi đúng memberId', async () => {
    const actions = makeActions()
    const snapshot = mapOpenRoomSnapshot(roomPayload, 'u1')
    render(<SupabaseRoomSnapshot snapshot={snapshot} connection="live" userId="u1" actions={actions} />)

    fireEvent.click(screen.getByRole('button', { name: 'Tuỳ chọn cho Hai' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Mời ra khỏi phòng' }))

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText(/Hai/)).toBeTruthy()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Mời ra khỏi phòng' }))

    await waitFor(() => {
      expect(actions.kick).toHaveBeenCalledWith('m2')
    })
  })

  it('swap chọn 1 người mỗi đội rồi gọi saveLineup với đội đã đổi', async () => {
    const actions = makeActions()
    const snapshot = mapOpenRoomSnapshot(makeTenPlayerPreparingPayload(), 'u1')
    render(<SupabaseRoomSnapshot snapshot={snapshot} connection="live" userId="u1" actions={actions} />)

    const teamAHeading = screen.getByRole('heading', { name: /Team A/ }).closest('div')?.parentElement as HTMLElement
    const teamBHeading = screen.getByRole('heading', { name: /Team B/ }).closest('div')?.parentElement as HTMLElement

    fireEvent.click(within(teamAHeading).getByRole('button', { name: 'Player 1' }))
    fireEvent.click(within(teamBHeading).getByRole('button', { name: 'Player 6' }))
    fireEvent.click(screen.getByRole('button', { name: 'Đổi chỗ' }))

    await waitFor(() => {
      expect(actions.saveLineup).toHaveBeenCalledTimes(1)
    })
    const savedLineup = (actions.saveLineup as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(savedLineup).toHaveLength(10)
    expect(savedLineup.filter((p: { team: string }) => p.team === 'a')).toHaveLength(5)
    expect(savedLineup.filter((p: { team: string }) => p.team === 'b')).toHaveLength(5)
    expect(savedLineup).toEqual(expect.arrayContaining([
      expect.objectContaining({ member_id: expect.any(String), skill_mode: 'random', skill_value: null, skill_score: null }),
    ]))
    expect(savedLineup.find((p: { member_id: string }) => p.member_id === 'm1').team).toBe('b')
    expect(savedLineup.find((p: { member_id: string }) => p.member_id === 'm6').team).toBe('a')
  })

  it('chia ngẫu nhiên gửi đủ 10 người, đúng 5v5 và đủ trường lineup', async () => {
    const actions = makeActions()
    const snapshot = mapOpenRoomSnapshot(makeTenPlayerPreparingPayload(), 'u1')
    render(<SupabaseRoomSnapshot snapshot={snapshot} connection="live" userId="u1" actions={actions} />)

    fireEvent.click(screen.getByRole('button', { name: 'Chia ngẫu nhiên' }))

    await waitFor(() => {
      expect(actions.saveLineup).toHaveBeenCalledTimes(1)
    })
    const savedLineup = (actions.saveLineup as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(savedLineup).toHaveLength(10)
    expect(new Set(savedLineup.map((player: { member_id: string }) => player.member_id)).size).toBe(10)
    expect(savedLineup.filter((player: { team: string }) => player.team === 'a')).toHaveLength(5)
    expect(savedLineup.filter((player: { team: string }) => player.team === 'b')).toHaveLength(5)
    for (const player of savedLineup) {
      expect(player).toEqual({
        member_id: expect.any(String),
        team: expect.stringMatching(/^[ab]$/),
        skill_mode: 'random',
        skill_value: null,
        skill_score: null,
      })
    }
  })

  it('xếp người chưa có đội vào team còn thiếu và giữ nguyên thông tin kỹ năng', async () => {
    const actions = makeActions()
    const payload = makeTenPlayerPreparingPayload()
    payload.currentPlayers = payload.currentPlayers.map((player) => player.member_id === 'm6'
      ? { ...player, team: null, skill_mode: 'tier', skill_value: 'Tinh Anh', skill_score: 42 }
      : player)
    const snapshot = mapOpenRoomSnapshot(payload, 'u1')
    render(<SupabaseRoomSnapshot snapshot={snapshot} connection="live" userId="u1" actions={actions} />)

    expect(screen.getByRole('heading', { name: 'Chưa xếp đội (1)' })).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Vào Team A cho Player 6' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Vào Team B cho Player 6' }))

    await waitFor(() => {
      expect(actions.saveLineup).toHaveBeenCalledTimes(1)
    })
    const savedLineup = (actions.saveLineup as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(savedLineup.filter((player: { team: string }) => player.team === 'a')).toHaveLength(5)
    expect(savedLineup.filter((player: { team: string }) => player.team === 'b')).toHaveLength(5)
    expect(savedLineup.find((player: { member_id: string }) => player.member_id === 'm6')).toEqual({
      member_id: 'm6',
      team: 'b',
      skill_mode: 'tier',
      skill_value: 'Tinh Anh',
      skill_score: 42,
    })
  })

  it('không gán đội ngầm khi nhiều người chưa xếp và hướng host dùng chia ngẫu nhiên', () => {
    const actions = makeActions()
    const payload = makeTenPlayerPreparingPayload()
    payload.currentPlayers = payload.currentPlayers.map((player) => ({ ...player, team: null }))
    const snapshot = mapOpenRoomSnapshot(payload, 'u1')
    render(<SupabaseRoomSnapshot snapshot={snapshot} connection="live" userId="u1" actions={actions} />)

    expect(screen.getByRole('heading', { name: 'Chưa xếp đội (10)' })).toBeTruthy()
    expect(screen.getByText('Bấm Chia ngẫu nhiên để xếp lại đội hình')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Vào Team A cho Player 1' }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: 'Vào Team B cho Player 1' }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: 'Đổi chỗ' }) as HTMLButtonElement).disabled).toBe(true)
    expect(() => buildLineupFromSelected(snapshot.selected)).toThrow('Đội hình phải đủ 5v5 trước khi lưu.')
    expect(actions.saveLineup).not.toHaveBeenCalled()
  })

  it('chỉ cho requeue người chơi host thêm đang ở ngoài queue và gọi đúng memberId', async () => {
    const actions = makeActions()
    const payload: OpenRoomSnapshotPayload = {
      ...roomPayload,
      members: [
        ...roomPayload.members,
        { id: 'm3', room_id: 'room-1', user_id: null, member_kind: 'guest', display_name: 'Guest ngoài queue', status: 'active', joined_at: '2026-01-01', left_at: null },
      ],
    }
    const snapshot = mapOpenRoomSnapshot(payload, 'u1')
    render(<SupabaseRoomSnapshot snapshot={snapshot} connection="live" userId="u1" actions={actions} />)

    fireEvent.click(screen.getByRole('button', { name: 'Tuỳ chọn cho Guest ngoài queue' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Đưa về cuối hàng chờ' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Đưa về cuối hàng chờ' }))

    await waitFor(() => {
      expect(actions.requeue).toHaveBeenCalledWith('m3')
    })
  })

  it('hiện toast khi thao tác trả về lỗi (kể cả version_conflict)', async () => {
    const onNotify = vi.fn()
    const actions = makeActions({
      start: vi.fn(async () => ({
        ok: false as const,
        error: new RoomMutationError('version_conflict', 'Phòng vừa thay đổi, đã tải lại.'),
      })),
    })
    const snapshot = mapOpenRoomSnapshot(makeTenPlayerPreparingPayload(), 'u1')
    render(<SupabaseRoomSnapshot snapshot={snapshot} connection="live" userId="u1" actions={actions} onNotify={onNotify} />)

    fireEvent.click(screen.getByRole('button', { name: 'Bắt đầu' }))
    await waitFor(() => {
      expect(onNotify).toHaveBeenCalledWith('Phòng vừa thay đổi, đã tải lại.')
    })
  })

  it('OpenRoomLineup khi splitTool là tier hoặc rank sẽ disable nút chia và hiện ghi chú sắp có', () => {
    const snapshot = mapOpenRoomSnapshot(makeTenPlayerPreparingPayload(), 'u1')
    const { rerender } = render(
      <SupabaseRoomSnapshot
        snapshot={snapshot}
        connection="live"
        userId="u1"
        actions={makeActions()}
        roomConfig={{
          name: 'Phòng Tier',
          series: 'BO5',
          access: 'private',
          playStyle: 'tryhard',
          splitTool: 'tier',
        }}
        configPersisted={false}
      />,
    )

    expect(screen.getByText('Cấu hình chưa được lưu lên server (chờ backend)')).toBeTruthy()
    const tierBtn = screen.getByRole('button', { name: 'Chia theo Tier Balance' }) as HTMLButtonElement
    expect(tierBtn.disabled).toBe(true)
    expect(screen.getByText('Cần điểm Tier/Rank của người chơi — sắp có')).toBeTruthy()

    rerender(
      <SupabaseRoomSnapshot
        snapshot={snapshot}
        connection="live"
        userId="u1"
        actions={makeActions()}
        roomConfig={{
          name: 'Phòng Rank',
          series: 'BO5',
          access: 'public',
          playStyle: 'tryhard',
          splitTool: 'rank',
        }}
        configPersisted={false}
      />,
    )
    const rankBtn = screen.getByRole('button', { name: 'Chia theo Rank Balance' }) as HTMLButtonElement
    expect(rankBtn.disabled).toBe(true)
    expect(screen.getByText('Cần điểm Tier/Rank của người chơi — sắp có')).toBeTruthy()
  })
})
