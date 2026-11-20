import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { setSupabaseClientForUnitTests } from './client'
import { requestOpenRoomRefetch, useOpenRoom } from './realtime'
import { clearSupabaseRuntime } from './lifecycle'
import type { OpenRoomSnapshot } from './types'

const mocks = vi.hoisted(() => ({ read: vi.fn(), series: vi.fn() }))
vi.mock('./room', () => ({ readOpenRoomSnapshot: mocks.read }))
vi.mock('./series', () => ({ readSeriesState: mocks.series }))
function setup() {
  const channel = { on: vi.fn(() => channel), subscribe: vi.fn(() => channel) }
  const client = { channel: vi.fn(() => channel), removeChannel: vi.fn() }
  setSupabaseClientForUnitTests(client as unknown as SupabaseClient)
  return client
}
function snapshot(version: number, configured = false): OpenRoomSnapshot {
  return { room: { id: 'room', host_user_id: 'host', invite_code: 'code', status: 'open', current_round_no: 1, current_round_state: 'active', version, created_at: '', closed_at: null, best_of: configured ? 3 : null }, version, selected: [], waiting: [], members: [], viewer: { isHost: true, isMember: true } }
}
afterEach(() => { cleanup(); setSupabaseClientForUnitTests(null); vi.resetAllMocks() })

it('ignores an older response that completes after a newer request', async () => {
  setup()
  let first!: (snapshot: OpenRoomSnapshot) => void
  mocks.read.mockReturnValueOnce(new Promise(resolve => { first = resolve })).mockResolvedValue(snapshot(20))
  const { result } = renderHook(() => useOpenRoom('room'))
  await act(async () => { await requestOpenRoomRefetch('room') })
  expect(result.current.snapshot?.version).toBe(20)
  await act(async () => { first(snapshot(10)) })
  expect(result.current.snapshot?.version).toBe(20)
})

it('logout invalidates pending reads and removes subscription', async () => {
  const client = setup()
  let finish!: (snapshot: OpenRoomSnapshot) => void
  mocks.read.mockReturnValueOnce(new Promise(resolve => { finish = resolve }))
  const { result } = renderHook(() => useOpenRoom('room'))
  await act(async () => { await clearSupabaseRuntime(); finish(snapshot(20)) })
  expect(result.current.snapshot).toBeNull()
  expect(client.removeChannel).toHaveBeenCalledOnce()
})

it('publishes room, games, assignments and revisions only at a consistent version', async () => {
  setup()
  mocks.read.mockResolvedValueOnce(snapshot(10, true)).mockResolvedValueOnce(snapshot(11, true)).mockResolvedValue(snapshot(11, true))
  mocks.series.mockResolvedValueOnce({ series: [], games: [{ id: 'stale' }], players: [], revisions: [] }).mockResolvedValue({ series: [], games: [{ id: 'latest' }], players: [], revisions: [] })
  const { result } = renderHook(() => useOpenRoom('room'))
  await waitFor(() => expect(result.current.snapshot?.version).toBe(11))
  expect(result.current.snapshot?.seriesState?.games[0].id).toBe('latest')
  expect(mocks.series).toHaveBeenCalledTimes(2)
})
