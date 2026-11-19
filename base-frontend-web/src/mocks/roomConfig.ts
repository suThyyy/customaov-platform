import { asset } from '../lib/asset'
import type { RoomConfig, RoomConfigEditable } from '../api/roomConfig'
import { currentUser } from './players'
import { roomFullTitle, rooms } from './rooms'

const inferredConfig = (room: (typeof rooms)[number]): RoomConfig => ({
  name: roomFullTitle(room),
  series: 'BO5',
  access: room.visibility,
  playStyle: room.modeLabel.includes('Căng') ? 'tryhard' : 'fun',
  splitTool: room.modeLabel.includes('Căng') ? 'tier' : 'random',
})

const seedConfigs = (): Map<string, RoomConfig> => new Map(rooms.map((room) => [room.id, inferredConfig(room)]))

let configs = seedConfigs()
let nextRoomNumber = 2000

export function createMockRoomWithConfig(config: RoomConfig): string {
  const roomId = `AOV-${nextRoomNumber}`
  nextRoomNumber += 1
  const stored = { ...config }
  configs.set(roomId, stored)
  rooms.push({
    id: roomId,
    title: stored.name,
    thumbnail: asset('room-1.jpg'),
    host: currentUser,
    modeLabel: stored.playStyle === 'fun' ? '5v5 · Vui' : '5v5 · Căng',
    visibility: stored.access,
    playerCount: 1,
    capacity: 10,
    status: 'waiting',
    teams: {
      blue: [{ player: currentUser, lane: 'MID', ready: true, captain: true }],
      red: [],
    },
  })
  return roomId
}

export const getMockRoomConfig = (roomId: string): RoomConfig | null => {
  const config = configs.get(roomId)
  return config ? { ...config } : null
}

export function updateMockRoomConfig(roomId: string, editable: RoomConfigEditable): RoomConfigEditable {
  const input = editable as RoomConfigEditable & Partial<Pick<RoomConfig, 'name' | 'series' | 'access'>>
  const locked = (['name', 'series', 'access'] as const).find((field) => field in input)
  if (locked) throw new Error(`Không thể cập nhật trường đã khoá: ${locked}.`)
  const config = configs.get(roomId)
  if (!config) throw new Error('Không tìm thấy cấu hình phòng.')
  const next = { ...config, ...editable }
  configs.set(roomId, next)
  const room = rooms.find((item) => item.id === roomId)
  if (room) room.modeLabel = next.playStyle === 'fun' ? '5v5 · Vui' : '5v5 · Căng'
  return { ...editable }
}

export function resetMockRoomConfigStore(): void {
  rooms.splice(0, rooms.length, ...rooms.filter((room) => !/^AOV-2\d{3}$/.test(room.id)))
  configs = seedConfigs()
  nextRoomNumber = 2000
}
