export type {
  Achievement,
  Activity,
  ActivityKind,
  BracketMatch,
  BracketRound,
  BracketSlot,
  ChampionStat,
  ChatMessage,
  Lane,
  MatchHistoryItem,
  Player,
  RoleStat,
  RoomMember,
  RoomStatus,
  RoomVisibility,
  ScheduledMatch,
  StageStatus,
  Team,
  Tournament,
  TournamentDetail,
  TournamentStatus,
  UserProfile,
} from '../mocks/types'

import type { RoomMode } from '@customaov/contracts'
import type { Room as MockRoom } from '../mocks/types'

/**
 * Phòng ở UI. `isMember` chỉ có ở chế độ api (`RoomSummary.isMember`): danh sách phòng của server
 * không kèm đội, nên không suy ra thành viên từ `teams` được.
 */
export type Room = MockRoom & { isMember?: boolean }

/** Nhãn ngắn của chế độ phòng, khớp `MODE_LABELS` của server ("5v5 · Căng" → "Căng") */
export const ROOM_MODE_SHORT_LABEL: Record<RoomMode, string> = {
  normal: 'Custom',
  tournament: 'Căng',
  friendly: 'Vui',
  other: 'Khác',
}

export const roomFullTitle = (room: Pick<Room, 'title' | 'highlight'>): string =>
  room.highlight ? `${room.title} – ${room.highlight}` : room.title

export type LoadStatus = 'loading' | 'error' | 'ready'

export interface ResourceState<T> {
  status: LoadStatus
  data: T
  error?: Error
  retry: () => void
}

export const TOURNAMENT_STATUS_LABEL: Record<import('../mocks/types').TournamentStatus, string> = {
  open: 'Đang mở đăng ký',
  live: 'Đang diễn ra',
  finished: 'Đã kết thúc',
}
