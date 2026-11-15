import { useCallback, useEffect, useState } from 'react'
import type {
  ChatMessage as ApiChatMessage,
  RoomDetail as ApiRoomDetail,
  RoomSummary as ApiRoomSummary,
} from '@customaov/contracts'
import { ApiError } from './client'
import { endpoints } from './endpoints'

/**
 * Phòng tải từ `GET /api/rooms/:code`: bản đầy đủ (có `teams`) hoặc bản `restricted`
 * (phòng riêng tư, người ngoài không có `key` đúng — API.md 9.1). Zod bỏ field `restricted`,
 * nên phân biệt bằng `isRoomDetail`.
 */
export type LoadedRoom = ApiRoomDetail | ApiRoomSummary

export const isRoomDetail = (room: LoadedRoom): room is ApiRoomDetail => 'teams' in room

export type ApiRoomState =
  | { status: 'loading' }
  | { status: 'error'; error: Error }
  | { status: 'not-found' }
  | { status: 'ready'; room: LoadedRoom }

const toError = (error: unknown): Error => (error instanceof Error ? error : new Error(String(error)))
const isAbort = (error: unknown): boolean => error instanceof DOMException && error.name === 'AbortError'

/** Tải phòng ở chế độ `api` (không cache: dữ liệu phòng đổi liên tục qua realtime). */
export function useApiRoom(code: string | undefined, key?: string | null) {
  const [state, setState] = useState<ApiRoomState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!code) {
      setState({ status: 'not-found' })
      return
    }
    const controller = new AbortController()
    endpoints.room(code, key ? { key } : {}, controller.signal).then(
      (room) => setState({ status: 'ready', room }),
      (error: unknown) => {
        if (isAbort(error)) return
        if (error instanceof ApiError && error.status === 404) setState({ status: 'not-found' })
        else setState((current) => (current.status === 'ready' ? current : { status: 'error', error: toError(error) }))
      },
    )
    return () => controller.abort()
  }, [code, key, attempt])

  /** Ghi đè bằng ảnh chụp mới (phản hồi mutation hoặc `room.updated`). */
  const setRoom = useCallback((room: LoadedRoom) => setState({ status: 'ready', room }), [])
  /** Tải lại; đang có dữ liệu thì giữ nguyên trong lúc chờ. */
  const reload = useCallback(() => {
    setState((current) => (current.status === 'ready' ? current : { status: 'loading' }))
    setAttempt((value) => value + 1)
  }, [])

  return { state, setRoom, reload }
}

/** Thêm/cập nhật tin theo `id`: tin từ phản hồi POST và từ WS `chat.message` không bị trùng. */
export function mergeMessages(list: readonly ApiChatMessage[], incoming: readonly ApiChatMessage[]): ApiChatMessage[] {
  if (incoming.length === 0) return list as ApiChatMessage[]
  const byId = new Map(list.map((message) => [message.id, message]))
  let changed = false
  for (const message of incoming) {
    if (byId.get(message.id) === message) continue
    byId.set(message.id, message)
    changed = true
  }
  if (!changed) return list as ApiChatMessage[]
  return [...byId.values()].sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
}

export type ApiMessagesState = { status: 'idle' | 'loading' | 'ready' | 'error'; messages: ApiChatMessage[] }

/** Tin nhắn phòng ở chế độ `api`. `enabled = false` (chưa là thành viên) thì không gọi API. */
export function useApiRoomMessages(code: string | undefined, enabled: boolean) {
  const [state, setState] = useState<ApiMessagesState>({ status: enabled ? 'loading' : 'idle', messages: [] })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!code || !enabled) {
      setState({ status: 'idle', messages: [] })
      return
    }
    const controller = new AbortController()
    setState((current) => (current.status === 'ready' ? current : { ...current, status: 'loading' }))
    endpoints.messages(code, {}, controller.signal).then(
      (messages) => setState((current) => ({ status: 'ready', messages: mergeMessages(current.messages, messages) })),
      (error: unknown) => {
        if (isAbort(error)) return
        setState((current) => (current.status === 'ready' ? current : { ...current, status: 'error' }))
      },
    )
    return () => controller.abort()
  }, [code, enabled, attempt])

  const add = useCallback(
    (message: ApiChatMessage) => setState((current) => ({ ...current, messages: mergeMessages(current.messages, [message]) })),
    [],
  )
  const reload = useCallback(() => setAttempt((value) => value + 1), [])

  return { state, add, reload }
}
