import { asset } from '../lib/asset'
import { players } from './players'
import type { ChatMessage, Lane, Room, RoomMember } from './types'

const m = (player: RoomMember['player'], lane: Lane, extra: Partial<RoomMember> = {}): RoomMember => ({
  player,
  lane,
  ready: true,
  ...extra,
})

const fullBlue: RoomMember[] = [
  m(players.suthy, 'MID', { captain: true }),
  m(players.vanhh, 'SP'),
  m(players.minz, 'JG'),
  m(players.khoaneo, 'AD'),
  m(players.tine, 'TOP'),
]
const fullRed: RoomMember[] = [
  m(players.hieukm, 'TOP'),
  m(players.rika, 'JG'),
  m(players.long2k, 'MID'),
  m(players.phuct, 'AD'),
  m(players.nanm, 'SP'),
]

/** Lấy n người đầu (xen kẽ 2 đội) để mô phỏng phòng chưa đủ người */
function partial(count: number, host: RoomMember['player']): Room['teams'] {
  // Loại cả suthy (người dùng hiện tại): suthy chỉ ở phòng AOV-1024, không thể đồng thời ở nhiều phòng
  const pool = [...fullBlue, ...fullRed].filter((x) => x.player.id !== host.id && x.player.id !== players.suthy.id)
  const hostMember = m(host, 'MID', { captain: true })
  const members = [hostMember, ...pool].slice(0, count)
  return {
    blue: members.filter((_, i) => i % 2 === 0),
    red: members.filter((_, i) => i % 2 === 1).map((x, i) => (i === 0 ? { ...x, captain: true } : x)),
  }
}

export const rooms: Room[] = [
  {
    id: 'AOV-1024',
    title: 'Kèo giao hữu',
    highlight: 'Team A vs B',
    thumbnail: asset('room-1.jpg'),
    host: players.suthy,
    modeLabel: '5v5 · Custom',
    visibility: 'private',
    playerCount: 10,
    capacity: 10,
    status: 'waiting',
    teams: { blue: fullBlue, red: fullRed },
  },
  {
    id: 'AOV-1025',
    title: 'Giao lưu cộng đồng #07',
    thumbnail: asset('room-2.jpg'),
    host: players.hieukm,
    modeLabel: '5v5 · Căng',
    visibility: 'public',
    playerCount: 10,
    capacity: 10,
    status: 'live',
    teams: partial(10, players.hieukm),
  },
  {
    id: 'AOV-1026',
    title: 'Thử nghiệm tướng mới',
    thumbnail: asset('room-3.jpg'),
    host: players.rika,
    modeLabel: '5v5 · Vui',
    visibility: 'public',
    playerCount: 6,
    capacity: 10,
    status: 'waiting',
    teams: partial(6, players.rika),
  },
  {
    id: 'AOV-1027',
    title: 'Custom giải trí – All Mid',
    thumbnail: asset('room-4.jpg'),
    host: players.long2k,
    modeLabel: '5v5 · Custom',
    visibility: 'public',
    playerCount: 10,
    capacity: 10,
    status: 'live',
    teams: partial(10, players.long2k),
  },
  {
    id: 'AOV-1028',
    title: 'Kèo rank nội bộ',
    thumbnail: asset('room-5.jpg'),
    host: players.phuct,
    modeLabel: '5v5 · Căng',
    visibility: 'private',
    playerCount: 9,
    capacity: 10,
    status: 'waiting',
    teams: partial(9, players.phuct),
  },
]

export const roomFullTitle = (r: Room): string => (r.highlight ? `${r.title} – ${r.highlight}` : r.title)

export const findRoom = (id: string | undefined): Room | undefined => rooms.find((r) => r.id === id)

/** Tin nhắn chat trong phòng (mock tĩnh). TODO: thay bằng realtime khi có backend. */
export const roomMessages: Record<string, ChatMessage[]> = {
  'AOV-1024': [
    { id: 'c1', author: players.suthy, text: 'Phòng đã mở, mọi người vào đủ rồi thì sẵn sàng nhé.', time: '19:02' },
    { id: 'c2', author: players.hieukm, text: 'Đã sẵn sàng. Hôm nay random lane hay tự chọn?', time: '19:03' },
    { id: 'c3', author: players.minz, text: 'Random cho vui đi 😆', time: '19:03' },
    { id: 'c4', author: players.suthy, text: 'Ok, chia đội xong mình random lane luôn.', time: '19:04' },
  ],
  'AOV-1025': [
    { id: 'd1', author: players.hieukm, text: 'Trận bắt đầu rồi, khán giả giữ trật tự giúp mình nhé.', time: '18:40' },
    { id: 'd2', author: players.rika, text: 'Team Đỏ gánh team đi 💪', time: '18:52' },
  ],
}
