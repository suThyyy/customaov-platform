import {
  activities,
  communityStats,
  currentUser,
  getTournamentDetail,
  createMockRoomWithConfig,
  getMockRoomConfig,
  players,
  profile,
  roomMessages,
  rooms,
  updateMockRoomConfig,
  tournaments,
} from '../mocks'
import type { CreateTournamentBody } from '@customaov/contracts'
import { normalizeVi } from '../lib/text'
import type {
  ActivitiesParams,
  ActivityPage,
  DataAdapter,
  RoomsPage,
  RoomsPageParams,
  RoomsParams,
  SearchResult,
  TournamentsParams,
} from './adapter'
import { ROOM_MODE_SHORT_LABEL, roomFullTitle } from './types'

const resolved = <T>(value: T, signal?: AbortSignal): Promise<T> =>
  signal?.aborted ? Promise.reject(new DOMException('Aborted', 'AbortError')) : Promise.resolve(value)

export const mockCurrentUser = currentUser
export const mockCommunityStats = communityStats
export const mockPlayers = players

export const readMockRooms = (params: RoomsParams = {}) => {
  const q = normalizeVi(params.q?.trim() ?? '')
  return rooms.filter((room) => {
    if (q && !normalizeVi(`${roomFullTitle(room)} ${room.id} ${room.host.name}`).includes(q)) return false
    if (params.status && room.status !== params.status) return false
    if (params.mode && !normalizeVi(room.modeLabel).includes(normalizeVi(params.mode))) return false
    if (params.mine && !room.teams.blue.concat(room.teams.red).some((member) => member.player.id === currentUser.id)) return false
    return true
  })
}

/** Bản mock của `GET /api/rooms` có phân trang (lọc chế độ theo nhãn ngắn trong `modeLabel`) */
export const readMockRoomsPage = (params: RoomsPageParams): RoomsPage => {
  const all = readMockRooms({ q: params.q, mode: params.mode ? ROOM_MODE_SHORT_LABEL[params.mode] : undefined })
  const start = (params.page - 1) * params.pageSize
  return { items: all.slice(start, start + params.pageSize), total: all.length, page: params.page, pageSize: params.pageSize }
}

export const readMockRoom = (code: string | undefined) => rooms.find((room) => room.id === code)
export const readMockMessages = (code: string | undefined) => (code ? roomMessages[code] ?? [] : [])
/** Cắt trang từ `mocks/activity.ts` theo cùng quy ước với API (page ≥ 1, mặc định pageSize 10). */
export const readMockActivities = (params: ActivitiesParams = {}): ActivityPage => {
  const page = Math.max(1, params.page ?? 1)
  const pageSize = params.pageSize ?? 10
  return {
    items: activities.slice((page - 1) * pageSize, page * pageSize),
    total: activities.length,
    page,
    pageSize,
  }
}
export const readMockTournaments = (params: TournamentsParams = {}) => {
  const q = normalizeVi(params.q?.trim() ?? '')
  return tournaments.filter((tournament) => {
    if (params.status && tournament.status !== params.status) return false
    return !q || [tournament.name, tournament.organizer, tournament.format].some((value) => normalizeVi(value).includes(q))
  })
}
export const readMockTournament = (slug: string | undefined) => getTournamentDetail(slug)
export const createMockTournament = (body: CreateTournamentBody, signal?: AbortSignal): Promise<{ slug: string }> => {
  const base =
    normalizeVi(body.name)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'giai-dau-moi'
  return resolved({ slug: `${base}-mock` }, signal)
}
export const readMockProfile = (username?: string) => {
  if (!username || username === currentUser.id || username === profile.publicId.slice(1)) return profile
  const player = Object.values(players).find((item) => item.id === username)
  return player ? { ...profile, player, publicId: `@${player.id}`, achievements: [], champions: [], roles: [], history: [] } : undefined
}
export const readMockSearch = (q: string): SearchResult => {
  const query = normalizeVi(q.trim())
  const match = (...values: string[]) => !query || values.some((value) => normalizeVi(value).includes(query))
  return {
    rooms: rooms.filter((room) => match(roomFullTitle(room), room.id, room.host.name)).slice(0, query ? 5 : 3),
    tournaments: tournaments.filter((tournament) => match(tournament.name, tournament.organizer)).slice(0, query ? 5 : 3),
    players: Object.values(players).filter((player) => match(player.name)).slice(0, query ? 5 : 3),
  }
}

const SESSION_STORAGE_KEY = 'customaov.mockLoggedIn'
const readSession = (): boolean => {
  try { return localStorage.getItem(SESSION_STORAGE_KEY) === '1' } catch { return false }
}
const rememberSession = (loggedIn: boolean): void => {
  try {
    if (loggedIn) localStorage.setItem(SESSION_STORAGE_KEY, '1')
    else localStorage.removeItem(SESSION_STORAGE_KEY)
  } catch { /* session remains in the current tab */ }
}
const capabilities = { readyImmediately: true, supportsRealtime: false, persistsWrites: false, isSampleData: true } as const

export const mockAdapter: DataAdapter = {
  auth: {
    ...capabilities,
    authFlow: 'sample',
    initial: () => ({ loggedIn: readSession(), user: null }),
    restore: (_signal) => resolved(null, _signal),
    subscribe(onChange) {
      const listener = (event: StorageEvent) => {
        if (event.key === SESSION_STORAGE_KEY || event.key === null) onChange(readSession())
      }
      window.addEventListener('storage', listener)
      return () => window.removeEventListener('storage', listener)
    },
    remember: rememberSession,
    login: () => Promise.reject(new Error('Mock auth uses the sample-account flow')),
    register: () => Promise.reject(new Error('Mock auth uses the sample-account flow')),
    logout: () => resolved(undefined),
  },
  profile: {
    ...capabilities,
    initial: readMockProfile,
    load: (username, signal) => resolved(readMockProfile(username), signal),
    update: (_body, signal) => resolved(undefined, signal),
  },
  rooms: {
    ...capabilities,
    configPersisted: true,
    initial: readMockRooms,
    initialPage: readMockRoomsPage,
    initialRoom: readMockRoom,
    list: (params: RoomsParams, signal?: AbortSignal) => resolved(readMockRooms(params), signal),
    page: (params, signal) => resolved(readMockRoomsPage(params), signal),
    room: (code, signal) => resolved(readMockRoom(code), signal),
    create: (_body, signal) => resolved({ code: '' }, signal),
    createRoomWithConfig: (config, signal) => {
      const roomId = createMockRoomWithConfig(config)
      return resolved({ roomId, status: 'OPEN', config: { ...config }, configPersisted: true }, signal)
    },
    getRoomConfig: (roomId, signal) => resolved({ config: getMockRoomConfig(roomId), configPersisted: true }, signal),
    updateRoomConfig: (roomId, editable, signal) => resolved({
      config: updateMockRoomConfig(roomId, editable),
      configPersisted: true,
    }, signal),
    join: (code, signal) => resolved({ code }, signal),
  },
  chat: {
    ...capabilities,
    initial: readMockMessages,
    messages: (code, signal) => resolved(readMockMessages(code), signal),
  },
  tournaments: {
    ...capabilities,
    initial: readMockTournaments,
    initialTournament: readMockTournament,
    list: (params: TournamentsParams, signal?: AbortSignal) => resolved(readMockTournaments(params), signal),
    tournament: (slug, signal) => resolved(readMockTournament(slug), signal),
    create: createMockTournament,
  },
  registrations: {
    ...capabilities,
    initial: () => [],
    list: (_slug, signal) => resolved([], signal),
  },
  activities: {
    ...capabilities,
    initial: readMockActivities,
    list: (params, signal) => resolved(readMockActivities(params), signal),
  },
  search: {
    ...capabilities,
    initial: readMockSearch,
    search: (q, signal) => resolved(readMockSearch(q), signal),
  },
}
