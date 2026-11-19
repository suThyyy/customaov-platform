import type { DataAdapter, RoomsAdapter } from '../adapter'
import { readMockRooms, readMockRoomsPage } from '../mock'
import { supabaseAuthAdapter } from './auth'
import { supabaseProfileAdapter } from './profile'

const roomCapabilities = {
  readyImmediately: true,
  supportsRealtime: true,
  persistsWrites: false,
  isSampleData: true,
  showsSampleBadge: true,
} as const

/** Danh sách Open Room không được RLS cho đọc; chỉ route UUID dùng snapshot Supabase. */
export const supabaseRoomsAdapter: RoomsAdapter = {
  ...roomCapabilities,
  roomView: 'open-room',
  initial: readMockRooms,
  initialPage: readMockRoomsPage,
  initialRoom: () => undefined,
  list: async (params) => readMockRooms(params),
  page: async (params) => readMockRoomsPage(params),
  room: async () => undefined,
  create: async () => { throw new Error('Thao tác phòng sẽ có ở bản sau.') },
  join: async () => { throw new Error('Thao tác phòng sẽ có ở bản sau.') },
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
