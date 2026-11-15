import type { RoomMode } from '@customaov/contracts'
import type { Activity, ChatMessage, Player, Room, Tournament, TournamentDetail, UserProfile } from './types'

export interface RoomsParams {
  q?: string
  mode?: string
  status?: string
  mine?: boolean
}

/** Tham số danh sách phòng có phân trang ở server (`GET /api/rooms`) */
export interface RoomsPageParams {
  q?: string
  mode?: RoomMode
  page: number
  pageSize: number
}

export interface RoomsPage {
  items: Room[]
  total: number
  page: number
  pageSize: number
}

export interface TournamentsParams {
  q?: string
  status?: string
  sort?: 'createdAt' | 'deadline'
  pageSize?: number
}

export interface SearchResult {
  rooms: Room[]
  tournaments: Tournament[]
  players: Player[]
}

export interface ActivitiesParams {
  /** Bắt đầu từ 1 */
  page?: number
  /** 1–50 (theo contracts) */
  pageSize?: number
}

export interface ActivityPage {
  items: Activity[]
  total: number
  page: number
  pageSize: number
}

export interface DataAdapter {
  rooms(params: RoomsParams, signal?: AbortSignal): Promise<Room[]>
  roomsPage(params: RoomsPageParams, signal?: AbortSignal): Promise<RoomsPage>
  room(code: string, signal?: AbortSignal): Promise<Room | undefined>
  roomMessages(code: string, signal?: AbortSignal): Promise<ChatMessage[]>
  tournaments(params: TournamentsParams, signal?: AbortSignal): Promise<Tournament[]>
  tournament(slug: string, signal?: AbortSignal): Promise<TournamentDetail | undefined>
  profile(username?: string, signal?: AbortSignal): Promise<UserProfile | undefined>
  activities(params: ActivitiesParams, signal?: AbortSignal): Promise<ActivityPage>
  search(q: string, signal?: AbortSignal): Promise<SearchResult>
}
