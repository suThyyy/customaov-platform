import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Room } from '../../api'
import { roomAction } from '../../lib/room'
import { RoomActionButton, RoomCard, RoomStatusBadge } from './RoomsTable'

afterEach(cleanup)

const baseRoom: Room = {
  id: 'AOV-1024',
  title: 'Kèo kết thúc',
  thumbnail: '/mock-assets/room-1.jpg',
  host: { id: 'suthy', name: 'suthy', avatar: '', level: 42 },
  modeLabel: 'Tryhard',
  visibility: 'public',
  playerCount: 10,
  capacity: 10,
  status: 'finished',
  isMember: true,
  teams: { blue: [], red: [] },
}

describe('RoomsTable finished status', () => {
  it('hiển thị badge "Đã kết thúc" cho phòng finished', () => {
    render(<RoomStatusBadge status="finished" />)
    expect(screen.getByText('Đã kết thúc')).toBeTruthy()
  })

  it('trả về hành động "Xem" cho phòng finished kể cả khi là thành viên', () => {
    expect(roomAction(baseRoom, 'suthy')).toBe('view')

    render(
      <RoomActionButton
        room={baseRoom}
        userId="suthy"
        onJoin={vi.fn()}
        onWatch={vi.fn()}
      />,
    )
    expect(screen.getByRole('button', { name: /Xem phòng/ }).textContent).toContain('Xem')
  })

  it('card phòng hiện nhãn phong cách ngắn thay cho mode của wizard cũ', () => {
    render(
      <RoomCard
        room={baseRoom}
        onJoin={vi.fn()}
        onWatch={vi.fn()}
      />,
    )

    expect(screen.getByText('Tryhard')).toBeTruthy()
    expect(screen.queryByText(/5v5 · (Custom|Căng|Vui)/)).toBeNull()
  })
  it('renders unknown discovery phase honestly without changing explicit mock waiting rows', () => {
    const discovered: Room = { ...baseRoom, id: 'public-room', title: 'Public BO5', status: 'unknown', inviteCode: 'invite-secret', metadataUnavailable: true, isMember: false }
    const onJoin = vi.fn()
    const { rerender } = render(<RoomCard room={discovered} onJoin={onJoin} onWatch={vi.fn()} />)
    expect(screen.getByText('Trạng thái chưa có')).toBeTruthy()
    const discoveryJoin = screen.getByRole('button', { name: /Tham gia bằng lời mời Public BO5/ })
    expect(discoveryJoin.textContent).toContain('Tham gia bằng lời mời')
    fireEvent.click(discoveryJoin)
    expect(onJoin).toHaveBeenCalledWith(discovered)

    rerender(<RoomCard room={{ ...baseRoom, status: 'waiting' }} onJoin={onJoin} onWatch={vi.fn()} />)
    expect(screen.getByText('Đang chờ')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Vào phòng/ }).textContent).toContain('Vào phòng')
  })
})
