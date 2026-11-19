import type { RoomMode } from '@customaov/contracts'
import type { LoginBody, Me, RegisterBody, UpdateMeBody, CreateRoomBody, CreateTournamentBody } from '@customaov/contracts'
import type { Activity, ChatMessage, Player, Registration, Room, Tournament, TournamentDetail, UserProfile } from './types'
import type {
  RoomConfig,
  RoomConfigCreateResult,
  RoomConfigEditable,
  RoomConfigReadResult,
  RoomConfigUpdateResult,
} from './roomConfig'

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

export interface AdapterCapabilities {
  readyImmediately: boolean
  supportsRealtime: boolean
  persistsWrites: boolean
  isSampleData: boolean
  /** Hiện nhãn khi mock đang là fallback của chế độ Supabase; mock thuần không hiện. */
  showsSampleBadge?: boolean
}

export interface EmailAuthCapability {
  login(email: string, password: string): Promise<{ user: Me }>
  signUp(email: string, password: string, displayName: string): Promise<{ needsOtp: boolean; user: Me | null }>
  verifyOtp(email: string, token: string): Promise<{ user: Me }>
}

export interface AuthAdapter extends AdapterCapabilities {
  authFlow?: 'sample' | 'platform' | 'supabase'
  emailAuth?: EmailAuthCapability
  initial(): { loggedIn: boolean; user: Me | null }
  restore(signal?: AbortSignal): Promise<Me | null>
  subscribe(onChange: (loggedIn: boolean, user?: Me | null) => void): () => void
  remember(loggedIn: boolean): void
  login(body: LoginBody, signal?: AbortSignal): Promise<{ user: Me }>
  register(body: RegisterBody, signal?: AbortSignal): Promise<{ user: Me }>
  logout(signal?: AbortSignal): Promise<void>
}

export interface ProfileAdapter extends AdapterCapabilities {
  publicProfileIsLimited?: boolean
  initial(username?: string): UserProfile | undefined
  load(username?: string, signal?: AbortSignal): Promise<UserProfile | undefined>
  update(body: UpdateMeBody, signal?: AbortSignal): Promise<void>
  requestGameUidChange?(gameUid: string): Promise<void>
}

export interface RoomsAdapter extends AdapterCapabilities {
  roomView?: 'open-room'
  configPersisted: boolean
  initial(params: RoomsParams): Room[]
  initialPage(params: RoomsPageParams): RoomsPage
  initialRoom(code?: string): Room | undefined
  list(params: RoomsParams, signal?: AbortSignal): Promise<Room[]>
  page(params: RoomsPageParams, signal?: AbortSignal): Promise<RoomsPage>
  room(code: string, signal?: AbortSignal): Promise<Room | undefined>
  create(body: CreateRoomBody, signal?: AbortSignal): Promise<{ code: string }>
  createRoomWithConfig(config: RoomConfig, signal?: AbortSignal): Promise<RoomConfigCreateResult>
  getRoomConfig(roomId: string, signal?: AbortSignal): Promise<RoomConfigReadResult>
  updateRoomConfig(roomId: string, editable: RoomConfigEditable, signal?: AbortSignal): Promise<RoomConfigUpdateResult>
  join(code: string, signal?: AbortSignal): Promise<{ code: string }>
}

export interface ChatAdapter extends AdapterCapabilities {
  initial(code?: string): ChatMessage[]
  messages(code: string, signal?: AbortSignal): Promise<ChatMessage[]>
}

export interface TournamentsAdapter extends AdapterCapabilities {
  initial(params: TournamentsParams): Tournament[]
  initialTournament(slug?: string): TournamentDetail | undefined
  list(params: TournamentsParams, signal?: AbortSignal): Promise<Tournament[]>
  tournament(slug: string, signal?: AbortSignal): Promise<TournamentDetail | undefined>
  create(body: CreateTournamentBody, signal?: AbortSignal): Promise<{ slug: string }>
}

export interface RegistrationsAdapter extends AdapterCapabilities {
  initial(): Registration[]
  list(slug: string, signal?: AbortSignal): Promise<Registration[]>
}

export interface ActivitiesAdapter extends AdapterCapabilities {
  initial(params: ActivitiesParams): ActivityPage
  list(params: ActivitiesParams, signal?: AbortSignal): Promise<ActivityPage>
}

export interface SearchAdapter extends AdapterCapabilities {
  initial(q: string): SearchResult
  search(q: string, signal?: AbortSignal): Promise<SearchResult>
}

export interface DataAdapter {
  auth: AuthAdapter
  profile: ProfileAdapter
  rooms: RoomsAdapter
  chat: ChatAdapter
  tournaments: TournamentsAdapter
  registrations: RegistrationsAdapter
  activities: ActivitiesAdapter
  search: SearchAdapter
}
