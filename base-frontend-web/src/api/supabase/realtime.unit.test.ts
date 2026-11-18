import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { subscribeOpenRoom } from './realtime'

function fakeRealtime() {
  const eventCallbacks: Array<() => void> = []
  const statusCallbacks: Array<(status: 'SUBSCRIBED' | 'CHANNEL_ERROR' | 'TIMED_OUT' | 'CLOSED') => void> = []
  const channels: object[] = []
  const client = {
    channel: vi.fn(() => {
      const channel = {
        on: vi.fn((_kind, _filter, callback) => { eventCallbacks.push(callback); return channel }),
        subscribe: vi.fn((callback) => { statusCallbacks.push(callback); return channel }),
      }
      channels.push(channel)
      return channel
    }),
    removeChannel: vi.fn().mockResolvedValue('ok'),
  } as unknown as SupabaseClient
  return { client, eventCallbacks, statusCallbacks, channels }
}

afterEach(() => vi.useRealTimers())

describe('Supabase room realtime (unit)', () => {
  it('debounce event rồi refetch snapshot', async () => {
    vi.useFakeTimers()
    const fake = fakeRealtime()
    const refetch = vi.fn()
    const cleanup = subscribeOpenRoom({ client: fake.client, roomId: 'r1', refetch, setConnection: vi.fn(), reset: vi.fn() })
    fake.eventCallbacks[0]()
    fake.eventCallbacks[1]()
    await vi.advanceTimersByTimeAsync(99)
    expect(refetch).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(refetch).toHaveBeenCalledTimes(1)
    cleanup()
  })

  it('mất kết nối thì backoff, subscribe lại và refetch', async () => {
    vi.useFakeTimers()
    const fake = fakeRealtime()
    const refetch = vi.fn()
    const setConnection = vi.fn()
    const cleanup = subscribeOpenRoom({ client: fake.client, roomId: 'r1', refetch, setConnection, reset: vi.fn() })
    fake.statusCallbacks[0]('CHANNEL_ERROR')
    await vi.advanceTimersByTimeAsync(999)
    expect(fake.client.channel).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(fake.client.channel).toHaveBeenCalledTimes(2)
    fake.statusCallbacks[1]('SUBSCRIBED')
    expect(refetch).toHaveBeenCalledTimes(1)
    expect(setConnection).toHaveBeenLastCalledWith('live')
    cleanup()
  })

  it('cleanup removeChannel và reset snapshot', () => {
    const fake = fakeRealtime()
    const reset = vi.fn()
    const cleanup = subscribeOpenRoom({ client: fake.client, roomId: 'r1', refetch: vi.fn(), setConnection: vi.fn(), reset })
    cleanup()
    expect(fake.client.removeChannel).toHaveBeenCalledWith(fake.channels[0])
    expect(reset).toHaveBeenCalled()
  })
})
