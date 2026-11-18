import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RoomMutationError } from '../api/supabase/roomMutations'

const { createOpenRoomMock, joinOpenRoomMock, notifyMock, mockRoomsAdapter } = vi.hoisted(() => ({
  createOpenRoomMock: vi.fn(),
  joinOpenRoomMock: vi.fn(),
  notifyMock: vi.fn(),
  mockRoomsAdapter: {
    roomView: 'open-room' as string | undefined,
    persistsWrites: false,
  },
}))

vi.mock('../api', async () => {
  const actual = await vi.importActual<typeof import('../api')>('../api')
  return {
    ...actual,
    createOpenRoom: createOpenRoomMock,
    joinOpenRoom: joinOpenRoomMock,
    roomsAdapter: { ...actual.roomsAdapter, ...mockRoomsAdapter },
  }
})

vi.mock('../context/AppContext', () => ({
  useAuth: () => ({
    loggedIn: true,
    loading: false,
    user: {
      id: '00000000-0000-0000-0000-000000000001',
      username: 'suthy',
      displayName: 'Suthy Profile',
      avatarUrl: null,
      level: 10,
      crowned: false,
      uid: '102394',
    },
    login: vi.fn(),
    logout: vi.fn(),
  }),
  useToast: () => ({
    notify: notifyMock,
    comingSoon: vi.fn(),
  }),
}))

import CreateRoom from './CreateRoom'
import JoinRoom from './JoinRoom'

describe('Open Room routes (unit)', () => {
  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mockRoomsAdapter.roomView = 'open-room'
  })

  it('/join/:inviteCode mặc định tên hồ sơ, gọi joinOpenRoom và điều hướng tới phòng', async () => {
    joinOpenRoomMock.mockResolvedValue({
      ok: true,
      data: {
        id: 'member-1',
        room_id: 'room-xyz',
        user_id: '00000000-0000-0000-0000-000000000001',
        member_kind: 'account',
        display_name: 'Suthy Custom',
        status: 'active',
        joined_at: '2026-01-01',
        left_at: null,
      },
    })

    render(
      <MemoryRouter initialEntries={['/join/INV123']}>
        <Routes>
          <Route path="/join/:inviteCode" element={<JoinRoom />} />
          <Route path="/rooms/:roomId" element={<div>Room Destination</div>} />
        </Routes>
      </MemoryRouter>,
    )

    const input = screen.getByLabelText('Tên hiển thị') as HTMLInputElement
    expect(input.value).toBe('Suthy Profile')
    fireEvent.change(input, { target: { value: 'Suthy Custom' } })
    fireEvent.click(screen.getByRole('button', { name: 'Vào phòng' }))

    await waitFor(() => {
      expect(joinOpenRoomMock).toHaveBeenCalledWith('INV123', 'Suthy Custom')
      expect(screen.getByText('Room Destination')).toBeTruthy()
    })
  })

  it('/join/:inviteCode hiển thị error.message khi joinOpenRoom thất bại', async () => {
    joinOpenRoomMock.mockResolvedValue({
      ok: false,
      error: new RoomMutationError('not_found', 'Không tìm thấy phòng hoặc người chơi cần thao tác.'),
    })

    render(
      <MemoryRouter initialEntries={['/join/BADCODE']}>
        <Routes>
          <Route path="/join/:inviteCode" element={<JoinRoom />} />
        </Routes>
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Vào phòng' }))

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toBe('Không tìm thấy phòng hoặc người chơi cần thao tác.')
      expect(notifyMock).toHaveBeenCalledWith('Không tìm thấy phòng hoặc người chơi cần thao tác.')
    })
  })

  it('/rooms/new ở chế độ supabase gọi createOpenRoom và điều hướng tới /rooms/<id>', async () => {
    createOpenRoomMock.mockResolvedValue({
      ok: true,
      data: {
        id: 'open-room-99',
        host_user_id: '00000000-0000-0000-0000-000000000001',
        invite_code: 'NEW99',
        status: 'open',
        current_round_no: 0,
        current_round_state: 'idle',
        version: 1,
        created_at: '2026-01-01',
        closed_at: null,
      },
    })

    render(
      <MemoryRouter initialEntries={['/rooms/new']}>
        <Routes>
          <Route path="/rooms/new" element={<CreateRoom />} />
          <Route path="/rooms/:roomId" element={<div>Created Room Page</div>} />
        </Routes>
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Tạo phòng mở' }))

    await waitFor(() => {
      expect(createOpenRoomMock).toHaveBeenCalledTimes(1)
      expect(screen.getByText('Created Room Page')).toBeTruthy()
    })
  })
})
