import type { RoomConfig, RoomConfigEditable } from '../roomConfig'
import { readOpenRoomSnapshot } from './room'
import { requestOpenRoomRefetch } from './realtime'
import { rpc, RoomMutationError } from './roomMutations'
import type { OpenRoomRow } from './types'

export interface DiscoveredRoom { room_id: string; room_name: string; best_of: 3 | 5 | 7; play_style: 'fun' | 'tryhard'; allocation_mode: 'random' | 'tier' | 'rank'; invite_code: string }
export const configFromRoom = (room: OpenRoomRow): RoomConfig | null => room.best_of && room.room_name && room.play_style && room.allocation_mode ? {
  name: room.room_name, series: `BO${room.best_of}`, access: room.visibility ?? 'private', playStyle: room.play_style, splitTool: room.allocation_mode,
} : null
export const createSeriesRoom = (config: RoomConfig) => rpc<OpenRoomRow>('create_series_room', {
  p_name: config.name.trim(), p_best_of: Number(config.series.slice(2)), p_visibility: config.access, p_style: config.playStyle, p_mode: config.splitTool,
})
export async function discoverSeriesRooms(): Promise<DiscoveredRoom[]> {
  const result = await rpc<DiscoveredRoom[]>('discover_series_rooms')
  if (!result.ok) throw result.error
  return result.data ?? []
}
export async function updateConfiguredRoom(roomId: string, editable: RoomConfigEditable, expectedVersion?: number) {
  let snapshot = await readOpenRoomSnapshot(roomId)
  if (!snapshot) throw new Error('Không có quyền xem phòng.')
  try {
    if (expectedVersion !== undefined && snapshot.version !== expectedVersion) throw new RoomMutationError('version_conflict', 'Phòng vừa thay đổi. Kiểm tra lại cấu hình trước khi gửi.')
    for (const [field, value, name, parameter] of [
      ['play_style', editable.playStyle, 'set_room_play_style', 'p_style'],
      ['allocation_mode', editable.splitTool, 'set_room_allocation_mode', 'p_mode'],
    ] as const) {
      if (snapshot.room[field] === value) continue
      const result = await rpc<OpenRoomRow>(name, { p_room_id: roomId, p_version: snapshot.version, [parameter]: value })
      if (!result.ok) throw result.error
      snapshot = await readOpenRoomSnapshot(roomId)
      if (!snapshot) throw new Error('Không có quyền xem phòng.')
    }
    const config = configFromRoom(snapshot.room)
    if (!config) throw new Error('Phòng này không có cấu hình BO.')
    return { config, configPersisted: true }
  } finally {
    await requestOpenRoomRefetch(roomId)
  }
}
