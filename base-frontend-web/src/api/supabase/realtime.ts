import { useCallback, useEffect, useRef, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseClient } from './client'
import { registerSupabaseCleanup } from './lifecycle'
import { readOpenRoomSnapshot } from './room'
import type { OpenRoomSnapshot } from './types'
import { readSeriesState } from './series'

export type OpenRoomConnection = 'connecting' | 'live' | 'reconnecting' | 'offline'
export type OpenRoomStatus = 'loading' | 'ready' | 'error'

const TABLES = ['rooms', 'room_members', 'room_queue_entries', 'room_current_players'] as const
const BACKOFF_MS = [1_000, 2_000, 5_000, 10_000] as const
type OpenRoomRefetchResult = OpenRoomSnapshot | null | undefined
type OpenRoomRefetch = () => OpenRoomRefetchResult | Promise<OpenRoomRefetchResult>

const refetchers = new Map<string, Set<OpenRoomRefetch>>()

export function registerOpenRoomRefetch(roomId: string, refetch: OpenRoomRefetch): () => void {
  const listeners = refetchers.get(roomId) ?? new Set()
  listeners.add(refetch)
  refetchers.set(roomId, listeners)
  return () => {
    listeners.delete(refetch)
    if (!listeners.size) refetchers.delete(roomId)
  }
}

export async function requestOpenRoomRefetch(roomId: string): Promise<OpenRoomRefetchResult> {
  const results = await Promise.all([...refetchers.get(roomId) ?? []].map((refetch) => refetch()))
  for (let index = results.length - 1; index >= 0; index -= 1) {
    if (results[index] !== undefined) return results[index]
  }
  return undefined
}

interface SubscriptionOptions {
  client: SupabaseClient
  roomId: string
  refetch: OpenRoomRefetch
  setConnection: (connection: OpenRoomConnection) => void
  reset: () => void
}

export function subscribeOpenRoom({ client, roomId, refetch, setConnection, reset }: SubscriptionOptions): () => void {
  let channel: ReturnType<SupabaseClient['channel']> | null = null
  let eventTimer: ReturnType<typeof setTimeout> | null = null
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let failedAttempts = 0
  let active = true

  const removeCurrent = () => {
    if (!channel) return
    const current = channel
    channel = null
    void client.removeChannel(current)
  }
  const changed = () => {
    if (eventTimer) clearTimeout(eventTimer)
    eventTimer = setTimeout(() => {
      eventTimer = null
      if (active) void refetch()
    }, 100)
  }
  const connect = () => {
    if (!active) return
    setConnection(failedAttempts ? 'reconnecting' : 'connecting')
    const next = client.channel(`open-room:${roomId}`)
    channel = next
    for (const table of TABLES) {
      next.on('postgres_changes', {
        event: '*', schema: 'public', table, filter: `${table === 'rooms' ? 'id' : 'room_id'}=eq.${roomId}`,
      }, changed)
    }
    next.subscribe((status) => {
      if (!active || channel !== next) return
      if (status === 'SUBSCRIBED') {
        failedAttempts = 0
        setConnection('live')
        void refetch()
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        setConnection('reconnecting')
        removeCurrent()
        const delay = BACKOFF_MS[Math.min(failedAttempts, BACKOFF_MS.length - 1)]
        failedAttempts += 1
        reconnectTimer = setTimeout(connect, delay)
      }
    })
  }

  connect()
  return () => {
    if (!active) return
    active = false
    if (eventTimer) clearTimeout(eventTimer)
    if (reconnectTimer) clearTimeout(reconnectTimer)
    removeCurrent()
    reset()
  }
}

export function useOpenRoom(roomId: string | undefined): {
  snapshot: OpenRoomSnapshot | null
  status: OpenRoomStatus
  connection: OpenRoomConnection
  error?: Error
  retry: () => void
} {
  const [snapshot, setSnapshot] = useState<OpenRoomSnapshot | null>(null)
  const [status, setStatus] = useState<OpenRoomStatus>('loading')
  const [connection, setConnection] = useState<OpenRoomConnection>('connecting')
  const [error, setError] = useState<Error>()
  const [attempt, setAttempt] = useState(0)
  const epoch = useRef(0)
  const retry = useCallback(() => setAttempt((value) => value + 1), [])

  useEffect(() => {
    const token = ++epoch.current
    setSnapshot(null)
    setError(undefined)
    setStatus('loading')
    if (!roomId) {
      setStatus('ready')
      setConnection('offline')
      return
    }
    const reset = () => {
      if (epoch.current === token) {
        epoch.current += 1
        setSnapshot(null)
        setConnection('offline')
      }
    }
    let request = 0
    let latestVersion = -1
    const refetch = async (retries = 0): Promise<OpenRoomRefetchResult> => {
      const sequence = ++request
      try {
        let next = await readOpenRoomSnapshot(roomId)
        if (next?.room.best_of) {
          const seriesState = await readSeriesState(roomId)
          const check = await readOpenRoomSnapshot(roomId)
          // Never publish a mixture of two versions. The next event/refetch reconciles it.
          if (check?.version !== next.version) {
            if (epoch.current === token && sequence === request && retries < 2) return refetch(retries + 1)
            if (epoch.current === token && sequence === request) throw new Error('Phòng đang thay đổi. Hãy tải lại để xem phiên bản mới nhất.')
            return
          }
          next = { ...next, seriesState }
        }
        if (epoch.current !== token || sequence !== request || (next && next.version < latestVersion)) return
        if (next) latestVersion = next.version
        setSnapshot(next)
        setStatus('ready')
        setError(undefined)
        return next
      } catch (reason) {
        if (epoch.current !== token || sequence !== request) return
        setSnapshot(null)
        setStatus('error')
        setError(reason instanceof Error ? reason : new Error(String(reason)))
      }
    }
    const unregisterRefetch = registerOpenRoomRefetch(roomId, refetch)
    const dispose = subscribeOpenRoom({ client: getSupabaseClient(), roomId, refetch, setConnection, reset })
    const unregister = registerSupabaseCleanup(dispose)
    void refetch()
    return () => {
      unregisterRefetch()
      unregister()
      dispose()
      epoch.current += 1
    }
  }, [roomId, attempt])

  return { snapshot, status, connection, error, retry }
}
