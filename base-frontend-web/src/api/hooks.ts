import { useCallback, useEffect, useRef, useState } from 'react'
import { useMockStatus } from '../lib/mockStatus'
import type { RoomsParams, SearchResult, TournamentsParams } from './adapter'
import { httpAdapter } from './http'
import {
  mockAdapter,
  readMockActivities,
  readMockMessages,
  readMockProfile,
  readMockRoom,
  readMockRooms,
  readMockSearch,
  readMockTournament,
  readMockTournaments,
} from './mock'
import { DATA_SOURCE } from './source'
import type { Activity, ChatMessage, Room, Tournament, TournamentDetail, UserProfile } from './types'

const adapter = DATA_SOURCE === 'api' ? httpAdapter : mockAdapter
const cache = new Map<string, unknown>()

export const clearDataCache = (): void => cache.clear()

export interface HookResult<T> {
  status: 'loading' | 'error' | 'ready'
  data: T
  error?: Error
  retry: () => void
}

export function useResource<T>(
  key: string,
  fallback: T,
  load: (signal: AbortSignal) => Promise<T>,
  readyImmediately = false,
): HookResult<T> {
  const mockStatus = useMockStatus()
  const loadRef = useRef(load)
  loadRef.current = load
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<Omit<HookResult<T>, 'retry'>>(() =>
    cache.has(key)
      ? { status: 'ready', data: cache.get(key) as T }
      : { status: readyImmediately ? mockStatus.status : 'loading', data: fallback },
  )

  useEffect(() => {
    if (DATA_SOURCE === 'mock' && mockStatus.status !== 'ready') {
      setState((current) => ({ ...current, status: mockStatus.status, error: mockStatus.status === 'error' ? new Error('Mock error') : undefined }))
      return
    }
    const cached = cache.get(key) as T | undefined
    if (cached !== undefined && attempt === 0) {
      setState({ status: 'ready', data: cached })
      return
    }
    const controller = new AbortController()
    if (!readyImmediately) setState((current) => ({ ...current, status: 'loading', error: undefined }))
    loadRef.current(controller.signal).then(
      (data) => {
        cache.set(key, data)
        setState({ status: 'ready', data })
      },
      (error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setState((current) => ({ ...current, status: 'error', error: error instanceof Error ? error : new Error(String(error)) }))
      },
    )
    return () => controller.abort()
  }, [key, attempt, mockStatus.status, readyImmediately])

  const retry = useCallback(() => {
    if (DATA_SOURCE === 'mock' && mockStatus.status === 'error') mockStatus.retry()
    cache.delete(key)
    setAttempt((value) => value + 1)
  }, [key, mockStatus])

  return { ...state, retry }
}

const stableKey = (name: string, params?: object) => `${DATA_SOURCE}:${name}:${params ? JSON.stringify(params) : ''}`

export const useRooms = (params: RoomsParams = {}): HookResult<Room[]> => {
  const key = stableKey('rooms', params)
  return useResource(key, DATA_SOURCE === 'mock' ? readMockRooms(params) : [], (signal) => adapter.rooms(params, signal), DATA_SOURCE === 'mock')
}

export const useRoom = (code: string | undefined): HookResult<Room | undefined> =>
  useResource(
    stableKey('room', { code }),
    DATA_SOURCE === 'mock' ? readMockRoom(code) : undefined,
    (signal) => code ? adapter.room(code, signal) : Promise.resolve(undefined),
    DATA_SOURCE === 'mock',
  )

export const useRoomMessages = (code: string | undefined): HookResult<ChatMessage[]> =>
  useResource(
    stableKey('messages', { code }),
    DATA_SOURCE === 'mock' ? readMockMessages(code) : [],
    (signal) => code ? adapter.roomMessages(code, signal) : Promise.resolve([]),
    DATA_SOURCE === 'mock',
  )

export const useTournaments = (params: TournamentsParams = {}): HookResult<Tournament[]> => {
  const key = stableKey('tournaments', params)
  return useResource(key, DATA_SOURCE === 'mock' ? readMockTournaments(params) : [], (signal) => adapter.tournaments(params, signal), DATA_SOURCE === 'mock')
}

export const useTournament = (slug: string | undefined): HookResult<TournamentDetail | undefined> =>
  useResource(
    stableKey('tournament', { slug }),
    DATA_SOURCE === 'mock' ? readMockTournament(slug) : undefined,
    (signal) => slug ? adapter.tournament(slug, signal) : Promise.resolve(undefined),
    DATA_SOURCE === 'mock',
  )

export const useProfile = (username?: string): HookResult<UserProfile | undefined> =>
  useResource(stableKey('profile', { username }), DATA_SOURCE === 'mock' ? readMockProfile(username) : undefined, (signal) => adapter.profile(username, signal), DATA_SOURCE === 'mock')

export const useActivities = (): HookResult<Activity[]> =>
  useResource(stableKey('activities'), DATA_SOURCE === 'mock' ? readMockActivities() : [], (signal) => adapter.activities(signal), DATA_SOURCE === 'mock')

export const useSearch = (q: string): HookResult<SearchResult> =>
  useResource(stableKey('search', { q }), DATA_SOURCE === 'mock' ? readMockSearch(q) : { rooms: [], tournaments: [], players: [] }, (signal) => adapter.search(q, signal), DATA_SOURCE === 'mock')
