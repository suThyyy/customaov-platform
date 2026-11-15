import { useCallback, useEffect, useRef, useState } from 'react'
import { useMockStatus } from '../lib/mockStatus'
import type {
  ActivitiesParams,
  ActivityPage,
  RoomsPage,
  RoomsPageParams,
  RoomsParams,
  SearchResult,
  TournamentsParams,
} from './adapter'
import { endpoints } from './endpoints'
import { httpAdapter } from './http'
import {
  mockAdapter,
  readMockActivities,
  readMockMessages,
  readMockProfile,
  readMockRoom,
  readMockRooms,
  readMockRoomsPage,
  readMockSearch,
  readMockTournament,
  readMockTournaments,
} from './mock'
import { DATA_SOURCE } from './source'
import type { ChatMessage, Registration, Room, Tournament, TournamentDetail, UserProfile } from './types'

const adapter = DATA_SOURCE === 'api' ? httpAdapter : mockAdapter
const cache = new Map<string, unknown>()

export const clearDataCache = (): void => cache.clear()

export interface HookResult<T> {
  status: 'loading' | 'error' | 'ready'
  data: T
  error?: Error
  retry: () => void
  /**
   * Tải lại ngầm (không về trạng thái loading, không gỡ nội dung đang hiện). Dùng sau thao tác ghi
   * để cập nhật số liệu mà không mất state của trang (hộp thoại, tab…). Lỗi được ném ra cho nơi gọi.
   */
  refresh: () => Promise<void>
  /** Alias của `refresh` (dùng bởi BTC panel). */
  reload: () => Promise<void>
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
  const [state, setState] = useState<Omit<HookResult<T>, 'retry' | 'refresh' | 'reload'>>(() =>
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

  const refresh = useCallback(async () => {
    const data = await loadRef.current(new AbortController().signal)
    cache.set(key, data)
    setState({ status: 'ready', data })
  }, [key])

  return { ...state, retry, refresh, reload: refresh }
}

const stableKey = (name: string, params?: object) => `${DATA_SOURCE}:${name}:${params ? JSON.stringify(params) : ''}`

export const useRooms = (params: RoomsParams = {}): HookResult<Room[]> => {
  const key = stableKey('rooms', params)
  return useResource(key, DATA_SOURCE === 'mock' ? readMockRooms(params) : [], (signal) => adapter.rooms(params, signal), DATA_SOURCE === 'mock')
}

/** Danh sách phòng có lọc/tìm/phân trang ở server (`GET /api/rooms`). Mỗi bộ tham số là một khoá cache. */
export const useRoomsPage = (params: RoomsPageParams): HookResult<RoomsPage> => {
  const key = stableKey('rooms-page', params)
  return useResource(
    key,
    DATA_SOURCE === 'mock' ? readMockRoomsPage(params) : { items: [], total: 0, page: params.page, pageSize: params.pageSize },
    (signal) => adapter.roomsPage(params, signal),
    DATA_SOURCE === 'mock',
  )
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

/** Đơn đăng ký của giải (chỉ BTC, chỉ chế độ api). */
export const useRegistrations = (slug: string): HookResult<Registration[]> =>
  useResource(stableKey('registrations', { slug }), [], (signal) => endpoints.registrations(slug, signal))

export const useProfile = (username?: string): HookResult<UserProfile | undefined> =>
  useResource(stableKey('profile', { username }), DATA_SOURCE === 'mock' ? readMockProfile(username) : undefined, (signal) => adapter.profile(username, signal), DATA_SOURCE === 'mock')

const EMPTY_ACTIVITY_PAGE = (params: ActivitiesParams): ActivityPage => ({
  items: [],
  total: 0,
  page: params.page ?? 1,
  pageSize: params.pageSize ?? 10,
})

/** Feed hoạt động của tôi, phân trang (`{items, total, page, pageSize}`). */
export const useActivities = (params: ActivitiesParams = {}): HookResult<ActivityPage> =>
  useResource(
    stableKey('activities', params),
    DATA_SOURCE === 'mock' ? readMockActivities(params) : EMPTY_ACTIVITY_PAGE(params),
    (signal) => adapter.activities(params, signal),
    DATA_SOURCE === 'mock',
  )

/** Chế độ api: chờ người dùng ngừng gõ 250ms mới gọi `GET /api/search`. */
export const SEARCH_DEBOUNCE_MS = 250
/** Chế độ api: server từ chối `q` ngắn hơn 2 ký tự (400), nên client không gọi. */
export const SEARCH_MIN_LENGTH = 2

const EMPTY_SEARCH: SearchResult = { rooms: [], tournaments: [], players: [] }

/** Trả về `value` sau khi nó đứng yên `delay` ms. `delay <= 0` → trả ngay, không đặt timer. */
export function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    if (delay <= 0) return
    const id = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(id)
  }, [value, delay])
  return delay <= 0 ? value : debounced
}

export interface SearchHookResult extends HookResult<SearchResult> {
  /** Đang chờ debounce (người dùng vừa gõ, chưa gửi request) */
  pending: boolean
  /** Chế độ api: từ khoá (đã trim) ngắn hơn SEARCH_MIN_LENGTH, chưa tìm */
  tooShort: boolean
}

/**
 * Tìm kiếm toàn cục.
 * - mock: lọc đồng bộ trên mock data như trước (không debounce, `q` rỗng → gợi ý).
 * - api: debounce 250ms; mỗi lần từ khoá đổi, `useResource` huỷ request cũ bằng `AbortController`.
 */
export function useSearch(q: string): SearchHookResult {
  const isApi = DATA_SOURCE === 'api'
  const typed = isApi ? q.trim() : q
  const debounced = useDebouncedValue(typed, isApi ? SEARCH_DEBOUNCE_MS : 0)
  const tooShort = isApi && debounced.length < SEARCH_MIN_LENGTH
  const result = useResource(
    stableKey('search', { q: debounced }),
    isApi ? EMPTY_SEARCH : readMockSearch(debounced),
    (signal) => (tooShort ? Promise.resolve(EMPTY_SEARCH) : adapter.search(debounced, signal)),
    !isApi,
  )
  // `tooShort` phản ánh ô nhập hiện tại (không phải giá trị đã debounce), để gợi ý "nhập thêm" hiện ngay.
  if (isApi && typed.length < SEARCH_MIN_LENGTH) {
    return { ...result, status: 'ready', data: EMPTY_SEARCH, error: undefined, pending: false, tooShort: true }
  }
  return { ...result, pending: typed !== debounced, tooShort: false }
}
