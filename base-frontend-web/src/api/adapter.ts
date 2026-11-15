import type { Activity, ChatMessage, Player, Room, Tournament, TournamentDetail, UserProfile } from './types'

export interface RoomsParams {
  q?: string
  mode?: string
  status?: string
  mine?: boolean
}

export interface TournamentsParams {
  q?: string
  status?: string
  sort?: 'createdAt' | 'deadline'
}

export interface SearchResult {
  rooms: Room[]
  tournaments: Tournament[]
  players: Player[]
}

export interface DataAdapter {
  rooms(params: RoomsParams, signal?: AbortSignal): Promise<Room[]>
  room(code: string, signal?: AbortSignal): Promise<Room | undefined>
  roomMessages(code: string, signal?: AbortSignal): Promise<ChatMessage[]>
  tournaments(params: TournamentsParams, signal?: AbortSignal): Promise<Tournament[]>
  tournament(slug: string, signal?: AbortSignal): Promise<TournamentDetail | undefined>
  profile(username?: string, signal?: AbortSignal): Promise<UserProfile | undefined>
  activities(signal?: AbortSignal): Promise<Activity[]>
  search(q: string, signal?: AbortSignal): Promise<SearchResult>
}
