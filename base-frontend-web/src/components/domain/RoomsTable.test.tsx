import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Room } from '../../api'
import { roomAction } from '../../lib/room'
import { RoomActionButton, RoomStatusBadge } from './RoomsTable'

afterEach(cleanup)

const baseRoom: Room = {
  id: 'AOV-1024',
  title: 'Kèo kết thúc',
  thumbnail: '/mock-assets/room-1.jpg',
  host: { id: 'suthy', name: 'suthy', avatar: '', level: 42 },
  modeLabel: '5v5 · Custom',
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
})
