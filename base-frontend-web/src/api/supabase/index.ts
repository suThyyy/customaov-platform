import type { DataAdapter, RoomsAdapter } from '../adapter'
import { supabaseAuthAdapter } from './auth'
import { supabaseProfileAdapter } from './profile'
import { joinOpenRoom } from './roomMutations'
import { configFromRoom, createSeriesRoom, discoverSeriesRooms, updateConfiguredRoom } from './configuration'
import { readOpenRoomSnapshot } from './room'
import type { Room } from '../types'
import { getSupabaseClient } from './client'

const roomCapabilities = {
  readyImmediately: false,
  supportsRealtime: true,
  persistsWrites: true,
  isSampleData: false,
  showsSampleBadge: false,
} as const

/** Discovery exposes only public configured rooms; no private UUID lookup. */
export const supabaseRoomsAdapter: RoomsAdapter = {
  ...roomCapabilities,
  configPersisted: true,
  roomView: 'open-room',
  initial: () => [],
  initialPage: (params) => ({ ...params, items: [], total: 0 }),
  initialRoom: () => undefined,
  async list(params) {
    if (params.mine) {
      const result = await getSupabaseClient().from('rooms').select('*')
      if (result.error) throw result.error
      return (result.data ?? []).map((row) => ({ id: row.id, title: row.room_name ?? 'Open Room', thumbnail: '', host: { id: row.host_user_id, name: '', avatar: '' }, modeLabel: row.play_style === 'fun' ? 'Fun' : 'Tryhard', visibility: row.visibility, playerCount: 0, capacity: 50, status: row.status === 'closed' ? 'finished' : row.current_round_state === 'active' ? 'live' : 'waiting', teams: { blue: [], red: [] }, isMember: true, metadataUnavailable: true } as Room))
    }
    const rows = await discoverSeriesRooms()
    return rows.filter(row => !params.q || row.room_name.toLocaleLowerCase().includes(params.q.toLocaleLowerCase()))
      .filter(row => !params.mode || (row.play_style === 'fun' ? 'friendly' : 'normal') === params.mode)
      .map(row => ({ id: row.room_id, title: `${row.room_name} · BO${row.best_of}`, thumbnail: '', host: { id: '', name: '', avatar: '' }, modeLabel: row.play_style === 'fun' ? 'Fun' : 'Tryhard', visibility: 'public', playerCount: 0, capacity: 50, status: 'unknown', inviteCode: row.invite_code, isMember: false, teams: { blue: [], red: [] }, metadataUnavailable: true } as Room))
  },
  async page(params) {
    const rooms = await this.list(params)
    return { items: rooms.slice((params.page - 1) * params.pageSize, params.page * params.pageSize), total: rooms.length, page: params.page, pageSize: params.pageSize }
  },
  async room(id) {
    const snapshot = await readOpenRoomSnapshot(id)
    if (!snapshot) return undefined
    const room = snapshot.room
    return {
      id: room.id,
      title: room.room_name ?? 'Open Room',
      thumbnail: '',
      host: { id: room.host_user_id, name: '', avatar: '' },
      modeLabel: room.play_style === 'fun' ? 'Fun' : 'Tryhard',
      visibility: room.visibility,
      playerCount: 0,
      capacity: 50,
      status: room.status === 'closed' ? 'finished' : room.current_round_state === 'active' ? 'live' : 'waiting',
      teams: { blue: [], red: [] },
      isMember: snapshot.viewer.isMember,
      metadataUnavailable: true,
    } as Room
  },
  create: async () => { throw new Error('Thao tác phòng sẽ có ở bản sau.') },
  async createRoomWithConfig(config) {
    const result = await createSeriesRoom(config)
    if (!result.ok) throw result.error
    const persisted = configFromRoom(result.data)
    if (!persisted) throw new Error('Server không trả cấu hình phòng.')
    return { roomId: result.data.id, status: 'OPEN', config: persisted, configPersisted: true }
  },
  async getRoomConfig(roomId) {
    const snapshot = await readOpenRoomSnapshot(roomId)
    return { config: snapshot ? configFromRoom(snapshot.room) : null, configPersisted: true }
  },
  updateRoomConfig: (roomId, editable) => updateConfiguredRoom(roomId, editable),
  async join(roomId) {
    const discovered = (await discoverSeriesRooms()).find(room => room.room_id === roomId)
    if (!discovered) throw new Error('Phòng riêng tư cần link mời hợp lệ.')
    const user = await supabaseAuthAdapter.restore()
    if (!user) throw new Error('Bạn cần đăng nhập.')
    const result = await joinOpenRoom(discovered.invite_code, user.displayName)
    if (!result.ok) throw result.error
    return { code: result.data.room_id }
  },
}

export const supabaseAdapter: Pick<DataAdapter, 'auth' | 'profile' | 'rooms'> = {
  auth: supabaseAuthAdapter,
  profile: supabaseProfileAdapter,
  rooms: supabaseRoomsAdapter,
}

export * from './realtime'
export * from './room'
export * from './roomActions'
export * from './roomMutations'
export * from './types'
export * from './series'
