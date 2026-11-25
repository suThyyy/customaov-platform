import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RoomMutationError } from '../api/supabase/roomMutations'

const { createOpenRoomMock, createRoomWithConfigMock, joinOpenRoomMock, notifyMock, mockRoomsAdapter } = vi.hoisted(() => ({
  createOpenRoomMock: vi.fn(),
  createRoomWithConfigMock: vi.fn(),
  joinOpenRoomMock: vi.fn(),
  notifyMock: vi.fn(),
  mockRoomsAdapter: {
    roomView: 'open-room' as string | undefined,
    persistsWrites: false,
  },
}))

vi.mock('../api', async () => {
  const actual = await vi.importActual<typeof import('../api')>('../api')
  Object.assign(mockRoomsAdapter, actual.roomsAdapter)
  return {
    ...actual,
    createOpenRoom: createOpenRoomMock,
    createRoomWithConfig: createRoomWithConfigMock,
    joinOpenRoom: joinOpenRoomMock,
    roomsAdapter: mockRoomsAdapter,
  }
})

vi.mock('../context/AppContext', () => ({
  useAuth: () => ({
    canOrganize: true,
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

function InviteStateProbe() {
  const location = useLocation()
  const inviteCode = (location.state as { inviteCode?: string } | null)?.inviteCode
  return <p>invite-state:{inviteCode ?? 'missing'}</p>
}

function ProtectedRoomProbe() {
  const location = useLocation()
  return <><p>protected-room:{location.pathname}</p><InviteStateProbe /></>
}

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

  it('redeems discovery invite once before entering Room and clears credential navigation state', async () => {
    joinOpenRoomMock.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve({ ok: true, data: { room_id: 'public-room' } }), 20)))
    render(
      <MemoryRouter initialEntries={[{ pathname: '/join/discovery', state: { inviteCode: 'SECRET-CODE' } }]}>
        <Routes>
          <Route path="/join/:inviteCode" element={<JoinRoom />} />
          <Route path="/rooms/:roomId" element={<ProtectedRoomProbe />} />
        </Routes>
      </MemoryRouter>,
    )
    expect(screen.queryByText(/protected-room:/)).toBeNull()
    expect(notifyMock).not.toHaveBeenCalled()
    const submit = screen.getByRole('button', { name: 'Vào phòng' })
    fireEvent.click(submit)
    fireEvent.click(submit)
    expect(notifyMock).not.toHaveBeenCalled()
    expect(screen.queryByText(/protected-room:/)).toBeNull()
    await waitFor(() => expect(joinOpenRoomMock).toHaveBeenCalledExactlyOnceWith('SECRET-CODE', 'Suthy Profile'))
    expect(await screen.findByText('protected-room:/rooms/public-room')).toBeTruthy()
    expect(screen.getByText('invite-state:missing')).toBeTruthy()
    expect(notifyMock).toHaveBeenCalledExactlyOnceWith('Đã tham gia phòng', expect.any(String))
  })

  it('keeps rejected discovery redemption outside Room and redacts the invite credential', async () => {
    joinOpenRoomMock.mockResolvedValue({ ok: false, error: new RoomMutationError('forbidden', 'SECRET-CODE rejected') })
    render(
      <MemoryRouter initialEntries={[{ pathname: '/join/discovery', state: { inviteCode: 'SECRET-CODE' } }]}>
        <Routes>
          <Route path="/join/:inviteCode" element={<JoinRoom />} />
          <Route path="/rooms/:roomId" element={<p>protected-room</p>} />
        </Routes>
      </MemoryRouter>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Vào phòng' }))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('[ẩn] rejected'))
    expect(joinOpenRoomMock).toHaveBeenCalledOnce()
    expect(screen.queryByText('protected-room')).toBeNull()
    expect(screen.queryByText('SECRET-CODE')).toBeNull()
    expect(notifyMock).not.toHaveBeenCalledWith('Đã tham gia phòng', expect.anything())
  })

  it('does not redeem the discovery sentinel without router state', () => {
    render(<MemoryRouter initialEntries={['/join/discovery']}><Routes><Route path="/join/:inviteCode" element={<JoinRoom />} /></Routes></MemoryRouter>)
    expect(screen.getByRole('alert').textContent).toContain('Không tìm thấy lời mời')
    expect(screen.queryByRole('button', { name: 'Vào phòng' })).toBeNull()
    expect(screen.getByRole('link', { name: 'Chọn phòng' }).getAttribute('href')).toBe('/dashboard#rooms')
    expect(joinOpenRoomMock).not.toHaveBeenCalled()
  })

  it.each(['queue_full', 'invalid_state', 'not_found', 'network', 'auth_required'] as const)('keeps a %s join failure on the confirmation page without success', async kind => {
    joinOpenRoomMock.mockResolvedValue({ ok: false, error: new RoomMutationError(kind, `Join failed: ${kind}`) })
    render(<MemoryRouter initialEntries={['/join/VALID-INVITE']}><Routes><Route path="/join/:inviteCode" element={<JoinRoom />} /><Route path="/rooms/:roomId" element={<p>Destination</p>} /></Routes></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: 'Vào phòng' }))
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.queryByText('Destination')).toBeNull()
    expect(notifyMock).not.toHaveBeenCalledWith('Đã tham gia phòng', expect.anything())
  })

  it('/rooms/new ở chế độ supabase dùng wizard 4 bước, gọi createRoomWithConfig và điều hướng tới /rooms/<id>', async () => {
    createRoomWithConfigMock.mockResolvedValue({
      roomId: 'open-room-99',
      status: 'OPEN',
      config: {
        name: 'Phòng mở 5v5',
        series: 'BO5',
        access: 'private',
        playStyle: 'fun',
        splitTool: 'random',
      },
      configPersisted: false,
    })

    render(
      <MemoryRouter initialEntries={['/rooms/new']}>
        <Routes>
          <Route path="/rooms/new" element={<CreateRoom />} />
          <Route path="/rooms/:roomId" element={<div>Created Room Page</div>} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.queryByRole('button', { name: 'Tạo phòng mở' })).toBeNull()
    expect(screen.getByRole('heading', { name: 'Tạo phòng Custom' })).toBeTruthy()

    fireEvent.change(screen.getByLabelText('Tên phòng'), { target: { value: 'Phòng mở 5v5' } })
    fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục' }))
    fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục' }))
    fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục' }))
    fireEvent.click(screen.getByRole('button', { name: 'Tạo phòng' }))

    await waitFor(() => {
      expect(createRoomWithConfigMock).toHaveBeenCalledWith({
        name: 'Phòng mở 5v5',
        series: 'BO5',
        access: 'private',
        playStyle: 'fun',
        splitTool: 'random',
      })
      expect(screen.getByText('Created Room Page')).toBeTruthy()
    })
  })

  it('/rooms/new ngoài chế độ supabase cũng dùng cùng wizard 4 bước', () => {
    mockRoomsAdapter.roomView = undefined

    render(
      <MemoryRouter initialEntries={['/rooms/new']}>
        <Routes>
          <Route path="/rooms/new" element={<CreateRoom />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: 'Tạo phòng Custom' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Bước 1 — Thông tin phòng' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Tạo phòng mở' })).toBeNull()
    expect(createOpenRoomMock).not.toHaveBeenCalled()
  })
})
