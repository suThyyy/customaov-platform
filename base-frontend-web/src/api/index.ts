import { CreateTournamentBodySchema, UpdateMeBodySchema, type CreateTournamentBody, type UpdateMeBody } from '@customaov/contracts'
import { endpoints } from './endpoints'
import { createMockTournament } from './mock'
import { DATA_SOURCE } from './source'

export { endpoints } from './endpoints'
export { ApiError, apiRequest } from './client'
export { DATA_SOURCE } from './source'
export { mockCommunityStats as communityStats, mockCurrentUser as currentUser, mockPlayers as players } from './mock'
export * from './hooks'
export * from './types'

export async function createTournament(body: CreateTournamentBody, signal?: AbortSignal): Promise<{ slug: string }> {
  const parsed = CreateTournamentBodySchema.parse(body)
  if (DATA_SOURCE === 'api') return endpoints.createTournament(parsed, signal)
  return createMockTournament(parsed, signal)
}

export async function updateProfile(body: UpdateMeBody, signal?: AbortSignal): Promise<void> {
  const parsed = UpdateMeBodySchema.parse(body)
  if (DATA_SOURCE === 'api') await endpoints.updateMe(parsed, signal)
}
