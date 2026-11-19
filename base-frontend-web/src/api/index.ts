import {
  CreateTournamentBodySchema,
  UpdateMeBodySchema,
  type CreateRoomBody,
  type CreateTournamentBody,
  type UpdateMeBody,
} from '@customaov/contracts'
import { profileAdapter, roomsAdapter, tournamentsAdapter } from './adapters'
import { clearDataCache } from './hooks'
import {
  RoomConfigValidationError,
  parseRoomConfig,
  validateRoomConfigEditable,
  type RoomConfig,
  type RoomConfigCreateResult,
  type RoomConfigEditable,
  type RoomConfigReadResult,
  type RoomConfigUpdateResult,
} from './roomConfig'

export { ApiError, apiRequest } from './client'
export { authAdapter, profileAdapter, roomsAdapter, chatAdapter, tournamentsAdapter, registrationsAdapter, activitiesAdapter, searchAdapter } from './adapters'
export { registrationActions, roomActions } from './actions'
export { timeAgo } from './time'
export type { ActivitiesParams, ActivityPage } from './adapter'
export { WINS_NEEDED, organizerActions, organizerErrorMessage, seriesOf, vietnamIso } from './organizer'
export { mockCommunityStats as communityStats, mockCurrentUser as currentUser, mockPlayers as players } from './mock'
export * from './hooks'
export * from './types'
export type { RoomsPage, RoomsPageParams } from './adapter'
export * from './room'
export * from './roomConfig'
export * from './realtime'
export * from './supabase'

export async function createTournament(body: CreateTournamentBody, signal?: AbortSignal): Promise<{ slug: string }> {
  const parsed = CreateTournamentBodySchema.parse(body)
  return tournamentsAdapter.create(parsed, signal)
}

export async function updateProfile(body: UpdateMeBody, signal?: AbortSignal): Promise<void> {
  const parsed = UpdateMeBodySchema.parse(body)
  await profileAdapter.update(parsed, signal)
}

/**
 * Vào phòng với vai trò người chơi (`POST /api/rooms/:code/join`), trả về mã phòng để điều hướng.
 * Chế độ mock: không gọi gì (giữ hành vi cũ: điều hướng thẳng).
 * Lỗi (409 phòng đầy / đang ở phòng khác, 403, 429…) ném `ApiError` cho nơi gọi hiện toast.
 */
export async function joinRoom(code: string, signal?: AbortSignal): Promise<{ code: string }> {
  const room = await roomsAdapter.join(code, signal)
  clearDataCache() // danh sách phòng, "phòng của bạn", chi tiết phòng đều đổi
  return { code: room.code }
}

/** Tạo phòng (`POST /api/rooms`, chỉ chế độ api). Trả về mã phòng server sinh. */
export async function createRoom(body: CreateRoomBody, signal?: AbortSignal): Promise<{ code: string }> {
  const room = await roomsAdapter.create(body, signal)
  clearDataCache()
  return { code: room.code }
}

export const createRoomWithConfig = (config: RoomConfig, signal?: AbortSignal): Promise<RoomConfigCreateResult> =>
  roomsAdapter.createRoomWithConfig(parseRoomConfig(config), signal)

export const getRoomConfig = (roomId: string, signal?: AbortSignal): Promise<RoomConfigReadResult> =>
  roomsAdapter.getRoomConfig(roomId, signal)

export function updateRoomConfig(
  roomId: string,
  editable: RoomConfigEditable,
  signal?: AbortSignal,
): Promise<RoomConfigUpdateResult> {
  const errors = validateRoomConfigEditable(editable)
  if (Object.keys(errors).length) throw new RoomConfigValidationError(errors)
  return roomsAdapter.updateRoomConfig(roomId, editable, signal)
}
