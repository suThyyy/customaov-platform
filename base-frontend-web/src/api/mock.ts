import {
  activities,
  communityStats,
  currentUser,
  getTournamentDetail,
  players,
  profile,
  roomMessages,
  rooms,
  tournaments,
} from '../mocks'
import type { CreateTournamentBody } from '@customaov/contracts'
import { normalizeVi } from '../lib/text'
import type { DataAdapter, RoomsParams, SearchResult, TournamentsParams } from './adapter'
import { roomFullTitle } from './types'

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

export const readMockRoom = (code: string | undefined) => rooms.find((room) => room.id === code)
export const readMockMessages = (code: string | undefined) => (code ? roomMessages[code] ?? [] : [])
export const readMockActivities = () => activities
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

export const mockAdapter: DataAdapter = {
  rooms(params: RoomsParams, signal?: AbortSignal) {
    return resolved(readMockRooms(params), signal)
  },
  room(code, signal) {
    return resolved(readMockRoom(code), signal)
  },
  roomMessages(code, signal) {
    return resolved(readMockMessages(code), signal)
  },
  tournaments(params: TournamentsParams, signal?: AbortSignal) {
    return resolved(readMockTournaments(params), signal)
  },
  tournament(slug, signal) {
    return resolved(readMockTournament(slug), signal)
  },
  profile(username, signal) {
    return resolved(readMockProfile(username), signal)
  },
  activities(signal) {
    return resolved(activities, signal)
  },
  search(q, signal) {
    return resolved(readMockSearch(q), signal)
  },
}
