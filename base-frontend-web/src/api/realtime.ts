import { useEffect, useRef, useState } from 'react'
import {
  ChatMessageSchema,
  RoomDetailSchema,
  RoomSummarySchema,
  type ChatMessage as ApiChatMessage,
} from '@customaov/contracts'
import { endpoints } from './endpoints'
import type { LoadedRoom } from './room'

/** Độ trễ kết nối lại (ms) theo số lần thử liên tiếp; hết mảng thì giữ mức cuối. */
export const RECONNECT_DELAYS = [1000, 2000, 5000, 10000] as const

export type RoomChannelStatus = 'connecting' | 'open' | 'closed'

export interface RoomChannelHandlers {
  /** `room` là bản đầy đủ hoặc bản `restricted` (không có `teams`), theo góc nhìn người nhận (API.md 9.5b). */
  onRoomUpdated?: (room: LoadedRoom) => void
  onChatMessage?: (message: ApiChatMessage) => void
  onKicked?: () => void
  /** Server từ chối subscribe (vd. FORBIDDEN với phòng riêng tư) hoặc báo lỗi khác. */
  onError?: (code: string) => void
  /** Kết nối lại thành công sau khi bị đứt: có thể đã lỡ sự kiện, nên tải lại dữ liệu. */
  onReconnect?: () => void
}

export interface RoomChannel {
  status: RoomChannelStatus
  /** Gửi lại `subscribe` (vd. sau khi vào phòng riêng tư, lúc trước bị từ chối). */
  resubscribe: () => void
}

const RoomPayloadSchema = RoomDetailSchema.or(RoomSummarySchema)

/**
 * Kênh realtime của một phòng qua `GET /api/ws` (API.md 4, 9.1, 9.5b).
 * - Mở kết nối, gửi `{type:'subscribe', room, key?}`.
 * - Đứt kết nối thì tự nối lại với backoff 1s → 2s → 5s → 10s; mở lại được thì đặt lại bộ đếm.
 * - Đổi `code`/`key` hoặc unmount: gửi `unsubscribe`, đóng socket, huỷ hẹn giờ.
 * Handler đọc qua ref nên không cần ổn định (đổi handler không mở lại kết nối).
 */
export function useRoomChannel(
  code: string | undefined,
  key?: string | null,
  handlers: RoomChannelHandlers = {},
  enabled = true,
): RoomChannel {
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers
  const [status, setStatus] = useState<RoomChannelStatus>('connecting')
  const resubscribeRef = useRef<() => void>(() => {})

  useEffect(() => {
    if (!code || !enabled || typeof WebSocket === 'undefined') return
    let socket: WebSocket | undefined
    let timer: ReturnType<typeof setTimeout> | undefined
    let attempt = 0
    let opened = false
    let disposed = false

    const subscribe = () => {
      if (socket?.readyState !== WebSocket.OPEN) return
      socket.send(JSON.stringify(key ? { type: 'subscribe', room: code, key } : { type: 'subscribe', room: code }))
    }
    resubscribeRef.current = subscribe

    const onMessage = (event: MessageEvent) => {
      let data: unknown
      try {
        data = JSON.parse(String(event.data))
      } catch {
        return
      }
      if (!data || typeof data !== 'object') return
      const msg = data as { type?: unknown; room?: unknown; message?: unknown; code?: unknown }
      const h = handlersRef.current
      if (msg.type === 'room.updated') {
        const parsed = RoomPayloadSchema.safeParse(msg.room)
        if (parsed.success && parsed.data.code === code) h.onRoomUpdated?.(parsed.data)
      } else if (msg.type === 'chat.message') {
        if (msg.room !== code) return
        const parsed = ChatMessageSchema.safeParse(msg.message)
        if (parsed.success) h.onChatMessage?.(parsed.data)
      } else if (msg.type === 'room.kicked') {
        if (msg.room === code) h.onKicked?.()
      } else if (msg.type === 'error') {
        if (msg.room === undefined || msg.room === code) h.onError?.(String(msg.code))
      }
    }

    const connect = () => {
      if (disposed) return
      setStatus('connecting')
      let ws: WebSocket
      try {
        ws = endpoints.websocket()
      } catch {
        scheduleReconnect()
        return
      }
      socket = ws
      ws.onopen = () => {
        if (disposed || socket !== ws) return
        const reconnected = opened
        opened = true
        attempt = 0
        setStatus('open')
        subscribe()
        if (reconnected) handlersRef.current.onReconnect?.()
      }
      ws.onmessage = onMessage
      ws.onclose = () => {
        if (disposed || socket !== ws) return
        socket = undefined
        setStatus('closed')
        scheduleReconnect()
      }
      // Lỗi luôn đi kèm sự kiện close; xử lý nối lại ở onclose.
      ws.onerror = () => {}
    }

    const scheduleReconnect = () => {
      if (disposed) return
      const delay = RECONNECT_DELAYS[Math.min(attempt, RECONNECT_DELAYS.length - 1)]
      attempt += 1
      timer = setTimeout(connect, delay)
    }

    connect()

    return () => {
      disposed = true
      resubscribeRef.current = () => {}
      if (timer) clearTimeout(timer)
      const ws = socket
      socket = undefined
      if (!ws) return
      ws.onopen = ws.onmessage = ws.onclose = ws.onerror = null
      try {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'unsubscribe', room: code }))
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) ws.close()
      } catch {
        /* socket đã đóng */
      }
    }
  }, [code, key, enabled])

  return { status, resubscribe: () => resubscribeRef.current() }
}
