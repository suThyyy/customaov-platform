import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FakeWebSocket } from '../test/fakeWebSocket'
import { RECONNECT_DELAYS, useRoomChannel, type RoomChannelHandlers } from './realtime'
import { mergeMessages } from './room'

beforeEach(() => {
  FakeWebSocket.instances = []
  vi.stubGlobal('WebSocket', FakeWebSocket)
  vi.useFakeTimers()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const subscribe = (key?: string) => (key ? { type: 'subscribe', room: 'AOV-1024', key } : { type: 'subscribe', room: 'AOV-1024' })

describe('useRoomChannel', () => {
  it('mở /api/ws và gửi subscribe (kèm key) khi kết nối mở', () => {
    renderHook(() => useRoomChannel('AOV-1024', 'abc'))
    const socket = FakeWebSocket.last()
    expect(socket.url).toMatch(/^ws:\/\/[^/]+\/api\/ws$/)
    expect(socket.sent).toEqual([])
    act(() => socket.open())
    expect(socket.sent).toEqual([subscribe('abc')])
  })

  it('kết nối lại sau khi đóng với backoff 1s → 2s → 5s → 10s, mở được thì đặt lại', () => {
    const onReconnect = vi.fn()
    renderHook(() => useRoomChannel('AOV-1024', undefined, { onReconnect }))
    act(() => FakeWebSocket.last().open())
    expect(RECONNECT_DELAYS).toEqual([1000, 2000, 5000, 10000])

    // Đứt kết nối liên tiếp khi chưa mở lại được: 1s, 2s, 5s, 10s, rồi giữ 10s
    for (const delay of [1000, 2000, 5000, 10000, 10000]) {
      const count = FakeWebSocket.instances.length
      act(() => FakeWebSocket.last().drop())
      act(() => vi.advanceTimersByTime(delay - 1))
      expect(FakeWebSocket.instances).toHaveLength(count)
      act(() => vi.advanceTimersByTime(1))
      expect(FakeWebSocket.instances).toHaveLength(count + 1)
    }

    // Mở lại được → subscribe lại, báo onReconnect, bộ đếm về 1s
    act(() => FakeWebSocket.last().open())
    expect(FakeWebSocket.last().sent).toEqual([subscribe()])
    expect(onReconnect).toHaveBeenCalledTimes(1)
    const count = FakeWebSocket.instances.length
    act(() => FakeWebSocket.last().drop())
    act(() => vi.advanceTimersByTime(1000))
    expect(FakeWebSocket.instances).toHaveLength(count + 1)
  })

  it('unmount: gửi unsubscribe, đóng socket và không nối lại', () => {
    const { unmount } = renderHook(() => useRoomChannel('AOV-1024'))
    const socket = FakeWebSocket.last()
    act(() => socket.open())
    unmount()
    expect(socket.sent.at(-1)).toEqual({ type: 'unsubscribe', room: 'AOV-1024' })
    expect(socket.closed).toBe(true)
    act(() => vi.advanceTimersByTime(60_000))
    expect(FakeWebSocket.instances).toHaveLength(1)
  })

  it('đổi phòng: huỷ kết nối cũ, mở kết nối mới cho phòng mới', () => {
    const { rerender } = renderHook(({ code }) => useRoomChannel(code), { initialProps: { code: 'AOV-1024' } })
    const first = FakeWebSocket.last()
    act(() => first.open())
    rerender({ code: 'AOV-2048' })
    expect(first.closed).toBe(true)
    const second = FakeWebSocket.last()
    expect(second).not.toBe(first)
    act(() => second.open())
    expect(second.sent).toEqual([{ type: 'subscribe', room: 'AOV-2048' }])
  })

  it('phân loại tin server: room.updated, chat.message, room.kicked; bỏ qua tin phòng khác / sai schema', () => {
    const handlers: RoomChannelHandlers = { onRoomUpdated: vi.fn(), onChatMessage: vi.fn(), onKicked: vi.fn(), onError: vi.fn() }
    renderHook(() => useRoomChannel('AOV-1024', undefined, handlers))
    const socket = FakeWebSocket.last()
    act(() => socket.open())
    const host = { id: '00000000-0000-4000-8000-000000000001', username: 'suthy', displayName: 'Suthy', avatarUrl: null, level: 1, crowned: false }
    const summary = {
      code: 'AOV-1024', title: 'Phòng', highlight: null, thumbnail: 'x.jpg', host, mode: 'normal', modeLabel: '5v5 · Custom',
      visibility: 'private', playerCount: 3, capacity: 10, status: 'waiting', isMember: false, restricted: true,
    }
    const message = { id: '00000000-0000-4000-8000-000000000900', author: host, text: 'Chào', system: false, at: '2026-11-15T10:00:00.000Z' }
    act(() => {
      socket.emit({ type: 'room.updated', room: summary })
      socket.emit({ type: 'room.updated', room: { ...summary, code: 'AOV-9999' } })
      socket.emit({ type: 'room.updated', room: { nope: true } })
      socket.emit({ type: 'chat.message', room: 'AOV-1024', message })
      socket.emit({ type: 'chat.message', room: 'AOV-9999', message })
      socket.emit({ type: 'error', code: 'FORBIDDEN', room: 'AOV-1024' })
      socket.emit({ type: 'room.kicked', room: 'AOV-1024' })
    })
    expect(handlers.onRoomUpdated).toHaveBeenCalledTimes(1)
    expect(handlers.onChatMessage).toHaveBeenCalledTimes(1)
    expect(handlers.onError).toHaveBeenCalledWith('FORBIDDEN')
    expect(handlers.onKicked).toHaveBeenCalledTimes(1)
  })
})

describe('mergeMessages', () => {
  const msg = (n: number, at: string) => ({
    id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
    author: null,
    text: `tin ${n}`,
    system: true,
    at,
  })

  it('không thêm trùng theo id và giữ thứ tự thời gian', () => {
    const a = msg(1, '2026-11-15T10:00:00.000Z')
    const b = msg(2, '2026-11-15T10:01:00.000Z')
    const list = mergeMessages([b], [a, b, { ...b }])
    expect(list.map((m) => m.id)).toEqual([a.id, b.id])
    expect(mergeMessages(list, [list[0]])).toBe(list)
  })
})
