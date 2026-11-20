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
import { activitiesAdapter, chatAdapter, profileAdapter, registrationsAdapter, roomsAdapter, searchAdapter, tournamentsAdapter } from './adapters'
import { sourceOf, type Feature } from './sources'
import type { ChatMessage, Registration, Room, Tournament, TournamentDetail, UserProfile } from './types'

const cache = new Map<string, unknown>()
let cacheGeneration = 0

export const clearDataCache = (): void => { cacheGeneration += 1; cache.clear() }

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
  isSampleData = false,
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
    if (isSampleData && mockStatus.status !== 'ready') {
      setState((current) => ({ ...current, status: mockStatus.status, error: mockStatus.status === 'error' ? new Error('Mock error') : undefined }))
      return
    }
    const cached = cache.get(key) as T | undefined
    if (cached !== undefined && attempt === 0) {
      setState({ status: 'ready', data: cached })
      return
    }
    const controller = new AbortController()
    const generation = cacheGeneration
    if (!readyImmediately) setState((current) => ({ ...current, status: 'loading', error: undefined }))
    loadRef.current(controller.signal).then(
      (data) => {
        if (controller.signal.aborted || generation !== cacheGeneration) return
        cache.set(key, data)
        setState({ status: 'ready', data })
      },
      (error: unknown) => {
        if (controller.signal.aborted || generation !== cacheGeneration) return
        if (error instanceof DOMException && error.name === 'AbortError') return
        setState((current) => ({ ...current, status: 'error', error: error instanceof Error ? error : new Error(String(error)) }))
      },
    )
    return () => controller.abort()
  }, [key, attempt, mockStatus.status, readyImmediately, isSampleData])

  const retry = useCallback(() => {
    if (isSampleData && mockStatus.status === 'error') mockStatus.retry()
    cache.delete(key)
    setAttempt((value) => value + 1)
  }, [key, mockStatus, isSampleData])

  const refresh = useCallback(async () => {
    const generation = cacheGeneration
    const data = await loadRef.current(new AbortController().signal)
    if (generation !== cacheGeneration) return
    cache.set(key, data)
    setState({ status: 'ready', data })
  }, [key])

  return { ...state, retry, refresh, reload: refresh }
}

const stableKey = (feature: Feature, name: string, params?: object) => `${sourceOf(feature)}:${name}:${params ? JSON.stringify(params) : ''}`

export const useRooms = (params: RoomsParams = {}): HookResult<Room[]> => {
  const key = stableKey('rooms', 'rooms', params)
  return useResource(key, roomsAdapter.initial(params), (signal) => roomsAdapter.list(params, signal), roomsAdapter.readyImmediately, roomsAdapter.isSampleData)
}

/** Danh sách phòng có lọc/tìm/phân trang ở server (`GET /api/rooms`). Mỗi bộ tham số là một khoá cache. */
export const useRoomsPage = (params: RoomsPageParams): HookResult<RoomsPage> => {
  const key = stableKey('rooms', 'rooms-page', params)
  return useResource(
    key,
    roomsAdapter.initialPage(params),
    (signal) => roomsAdapter.page(params, signal),
    roomsAdapter.readyImmediately,
    roomsAdapter.isSampleData,
  )
}

export const useRoom = (code: string | undefined): HookResult<Room | undefined> =>
  useResource(
    stableKey('rooms', 'room', { code }),
    roomsAdapter.initialRoom(code),
    (signal) => code ? roomsAdapter.room(code, signal) : Promise.resolve(undefined),
    roomsAdapter.readyImmediately,
    roomsAdapter.isSampleData,
  )

export const useRoomMessages = (code: string | undefined): HookResult<ChatMessage[]> =>
  useResource(
    stableKey('chat', 'messages', { code }),
    chatAdapter.initial(code),
    (signal) => code ? chatAdapter.messages(code, signal) : Promise.resolve([]),
    chatAdapter.readyImmediately,
    chatAdapter.isSampleData,
  )

export const useTournaments = (params: TournamentsParams = {}): HookResult<Tournament[]> => {
  const key = stableKey('tournaments', 'tournaments', params)
  return useResource(key, tournamentsAdapter.initial(params), (signal) => tournamentsAdapter.list(params, signal), tournamentsAdapter.readyImmediately, tournamentsAdapter.isSampleData)
}

export const useTournament = (slug: string | undefined): HookResult<TournamentDetail | undefined> =>
  useResource(
    stableKey('tournaments', 'tournament', { slug }),
    tournamentsAdapter.initialTournament(slug),
    (signal) => slug ? tournamentsAdapter.tournament(slug, signal) : Promise.resolve(undefined),
    tournamentsAdapter.readyImmediately,
    tournamentsAdapter.isSampleData,
  )

/** Đơn đăng ký của giải (chỉ BTC, chỉ chế độ api). */
export const useRegistrations = (slug: string): HookResult<Registration[]> =>
  useResource(stableKey('registrations', 'registrations', { slug }), registrationsAdapter.initial(), (signal) => registrationsAdapter.list(slug, signal), registrationsAdapter.readyImmediately, registrationsAdapter.isSampleData)

export const useProfile = (username?: string): HookResult<UserProfile | undefined> =>
  useResource(stableKey('profile', 'profile', { username }), profileAdapter.initial(username), (signal) => profileAdapter.load(username, signal), profileAdapter.readyImmediately, profileAdapter.isSampleData)

/** Feed hoạt động của tôi, phân trang (`{items, total, page, pageSize}`). */
export const useActivities = (params: ActivitiesParams = {}): HookResult<ActivityPage> =>
  useResource(
    stableKey('activities', 'activities', params),
    activitiesAdapter.initial(params),
    (signal) => activitiesAdapter.list(params, signal),
    activitiesAdapter.readyImmediately,
    activitiesAdapter.isSampleData,
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
  const isApi = !searchAdapter.readyImmediately
  const typed = isApi ? q.trim() : q
  const debounced = useDebouncedValue(typed, isApi ? SEARCH_DEBOUNCE_MS : 0)
  const tooShort = isApi && debounced.length < SEARCH_MIN_LENGTH
  const result = useResource(
    stableKey('search', 'search', { q: debounced }),
    searchAdapter.initial(debounced),
    (signal) => (tooShort ? Promise.resolve(EMPTY_SEARCH) : searchAdapter.search(debounced, signal)),
    searchAdapter.readyImmediately,
    searchAdapter.isSampleData,
  )
  // `tooShort` phản ánh ô nhập hiện tại (không phải giá trị đã debounce), để gợi ý "nhập thêm" hiện ngay.
  if (isApi && typed.length < SEARCH_MIN_LENGTH) {
    return { ...result, status: 'ready', data: EMPTY_SEARCH, error: undefined, pending: false, tooShort: true }
  }
  return { ...result, pending: typed !== debounced, tooShort: false }
}
