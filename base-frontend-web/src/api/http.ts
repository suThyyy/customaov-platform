import type { DataAdapter } from './adapter'
import { endpoints } from './endpoints'
import { ApiError } from './client'
import { mapActivity, mapChatMessage, mapPlayer, mapProfile, mapRoom, mapTournament, mapTournamentDetail } from './map'

export const httpAdapter: DataAdapter = {
  async rooms(params, signal) {
    const response = await endpoints.rooms(
      {
        q: params.q,
        mode: params.mode as 'normal' | 'tournament' | 'friendly' | 'other' | undefined,
        status: params.status as 'waiting' | 'live' | 'finished' | undefined,
        mine: params.mine ? '1' : undefined,
        pageSize: 50,
      },
      signal,
    )
    return response.items.map(mapRoom)
  },
  async room(code, signal) {
    return mapRoom(await endpoints.room(code, {}, signal))
  },
  async roomMessages(code, signal) {
    return (await endpoints.messages(code, {}, signal)).map(mapChatMessage)
  },
  async tournaments(params, signal) {
    const response = await endpoints.tournaments(
      {
        q: params.q,
        status: params.status as 'open' | 'live' | 'finished' | undefined,
        sort: params.sort,
        pageSize: 50,
      },
      signal,
    )
    return response.items.map(mapTournament)
  },
  async tournament(slug, signal) {
    return mapTournamentDetail(await endpoints.tournament(slug, signal))
  },
  async profile(username, signal) {
    try {
      if (!username) {
        const session = await endpoints.me(signal)
        if (!session.user) return undefined
        username = session.user.username
      }
      return mapProfile(await endpoints.profile(username, signal))
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return undefined
      throw error
    }
  },
  async activities(signal) {
    return (await endpoints.activities({ pageSize: 50 }, signal)).items.map(mapActivity)
  },
  async search(q, signal) {
    if (q.trim().length < 2) return { rooms: [], tournaments: [], players: [] }
    const result = await endpoints.search(q.trim(), signal)
    return {
      rooms: result.rooms.map(mapRoom),
      tournaments: result.tournaments.map(mapTournament),
      players: result.users.map(mapPlayer),
    }
  },
}
