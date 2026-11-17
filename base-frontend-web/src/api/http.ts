import type { DataAdapter } from './adapter'
import { endpoints } from './endpoints'
import { ApiError } from './client'
import { mapActivity, mapChatMessage, mapPlayer, mapProfile, mapRoom, mapTournament, mapTournamentDetail } from './map'

const capabilities = { readyImmediately: false, supportsRealtime: true, persistsWrites: true, isSampleData: false } as const

export const httpAdapter: DataAdapter = {
  auth: {
    ...capabilities,
    authFlow: 'platform',
    initial: () => ({ loggedIn: false, user: null }),
    async restore(signal) { return (await endpoints.me(signal)).user },
    subscribe: () => () => undefined,
    remember: () => undefined,
    login: (body, signal) => signal ? endpoints.login(body, signal) : endpoints.login(body),
    register: (body, signal) => signal ? endpoints.register(body, signal) : endpoints.register(body),
    async logout(signal) { await endpoints.logout(signal) },
  },
  profile: {
    ...capabilities,
    initial: () => undefined,
    async load(username, signal) {
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
    async update(body, signal) { await endpoints.updateMe(body, signal) },
  },
  rooms: {
    ...capabilities,
    initial: () => [],
    initialPage: (params) => ({ items: [], total: 0, page: params.page, pageSize: params.pageSize }),
    initialRoom: () => undefined,
    async list(params, signal) {
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
    async page(params, signal) {
    const response = await endpoints.rooms(
      { q: params.q?.trim() || undefined, mode: params.mode, page: params.page, pageSize: params.pageSize },
      signal,
    )
    return { items: response.items.map(mapRoom), total: response.total, page: response.page, pageSize: response.pageSize }
    },
    async room(code, signal) { return mapRoom(await endpoints.room(code, {}, signal)) },
    async create(body, signal) { return { code: (await endpoints.createRoom(body, signal)).code } },
    async join(code, signal) { return { code: (await endpoints.joinRoom(code, { as: 'player' }, signal)).code } },
  },
  chat: {
    ...capabilities,
    initial: () => [],
    async messages(code, signal) { return (await endpoints.messages(code, {}, signal)).map(mapChatMessage) },
  },
  tournaments: {
    ...capabilities,
    initial: () => [],
    initialTournament: () => undefined,
    async list(params, signal) {
    const response = await endpoints.tournaments(
      {
        q: params.q,
        status: params.status as 'open' | 'live' | 'finished' | undefined,
        sort: params.sort,
        pageSize: params.pageSize ?? 50,
      },
      signal,
    )
    return response.items.map(mapTournament)
    },
    async tournament(slug, signal) { return mapTournamentDetail(await endpoints.tournament(slug, signal)) },
    create: (body, signal) => endpoints.createTournament(body, signal),
  },
  registrations: {
    ...capabilities,
    initial: () => [],
    list: (slug, signal) => endpoints.registrations(slug, signal),
  },
  activities: {
    ...capabilities,
    initial: (params) => ({ items: [], total: 0, page: params.page ?? 1, pageSize: params.pageSize ?? 10 }),
    async list(params, signal) {
    const response = await endpoints.activities({ page: params.page ?? 1, pageSize: params.pageSize ?? 10 }, signal)
    const now = Date.now()
    return { ...response, items: response.items.map((item) => mapActivity(item, now)) }
    },
  },
  search: {
    ...capabilities,
    initial: () => ({ rooms: [], tournaments: [], players: [] }),
    async search(q, signal) {
    if (q.trim().length < 2) return { rooms: [], tournaments: [], players: [] }
    const result = await endpoints.search(q.trim(), signal)
    return {
      rooms: result.rooms.map(mapRoom),
      tournaments: result.tournaments.map(mapTournament),
      players: result.users.map(mapPlayer),
    }
    },
  },
}
