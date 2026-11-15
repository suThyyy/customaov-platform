import {
  CreateTournamentBodySchema,
  UpdateMeBodySchema,
  type CreateRoomBody,
  type CreateTournamentBody,
  type UpdateMeBody,
} from '@customaov/contracts'
import { endpoints } from './endpoints'
import { clearDataCache } from './hooks'
import { createMockTournament } from './mock'
import { DATA_SOURCE } from './source'

export { endpoints } from './endpoints'
export { ApiError, apiRequest } from './client'
export { DATA_SOURCE } from './source'
export { timeAgo } from './time'
export type { ActivitiesParams, ActivityPage } from './adapter'
export { mockCommunityStats as communityStats, mockCurrentUser as currentUser, mockPlayers as players } from './mock'
export * from './hooks'
export * from './types'
export type { RoomsPage, RoomsPageParams } from './adapter'
export * from './room'
export * from './realtime'

export async function createTournament(body: CreateTournamentBody, signal?: AbortSignal): Promise<{ slug: string }> {
  const parsed = CreateTournamentBodySchema.parse(body)
  if (DATA_SOURCE === 'api') return endpoints.createTournament(parsed, signal)
  return createMockTournament(parsed, signal)
}

export async function updateProfile(body: UpdateMeBody, signal?: AbortSignal): Promise<void> {
  const parsed = UpdateMeBodySchema.parse(body)
  if (DATA_SOURCE === 'api') await endpoints.updateMe(parsed, signal)
}

/**
 * Vào phòng với vai trò người chơi (`POST /api/rooms/:code/join`), trả về mã phòng để điều hướng.
 * Chế độ mock: không gọi gì (giữ hành vi cũ: điều hướng thẳng).
 * Lỗi (409 phòng đầy / đang ở phòng khác, 403, 429…) ném `ApiError` cho nơi gọi hiện toast.
 */
export async function joinRoom(code: string, signal?: AbortSignal): Promise<{ code: string }> {
  if (DATA_SOURCE !== 'api') return { code }
  const room = await endpoints.joinRoom(code, { as: 'player' }, signal)
  clearDataCache() // danh sách phòng, "phòng của bạn", chi tiết phòng đều đổi
  return { code: room.code }
}

/** Tạo phòng (`POST /api/rooms`, chỉ chế độ api). Trả về mã phòng server sinh. */
export async function createRoom(body: CreateRoomBody, signal?: AbortSignal): Promise<{ code: string }> {
  const room = await endpoints.createRoom(body, signal)
  clearDataCache()
  return { code: room.code }
}
