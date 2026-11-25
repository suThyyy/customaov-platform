import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { setSupabaseClientForUnitTests } from './client'
import { configFromRoom, createSeriesRoom, discoverSeriesRooms } from './configuration'
import { assignSeriesGame, assignmentError, readPublicGameResults, readSeriesState, reportSeriesResult, startSeriesGame, type SeriesPlayer } from './series'
import { supabaseRoomsAdapter } from './index'
import { mapRoomMutationError } from './roomMutations'
import { openRoomPermissions as permissionsForRole, useOpenRoomActions } from './roomActions'
const openRoomPermissions = (snapshot: Parameters<typeof permissionsForRole>[0], id: string) => permissionsForRole(snapshot, id, true)
import type { OpenRoomSnapshot } from './types'
import { resolveDataSource } from '../source'

const config = { name: 'Friday', series: 'BO5', access: 'private', playStyle: 'fun', splitTool: 'tier' } as const
const snapshot: OpenRoomSnapshot = {
  room: { id: 'room', host_user_id: 'host', invite_code: 'server-code', status: 'open', current_round_no: 1, current_round_state: 'active', version: 71, created_at: '', closed_at: null, room_name: 'Friday', best_of: 5, visibility: 'private', play_style: 'fun', allocation_mode: 'tier' },
  members: [], waiting: [], selected: [], version: 71, viewer: { isHost: true, isMember: false },
}
function client(data: unknown = snapshot.room, error: unknown = null) {
  const rpc = vi.fn().mockResolvedValue({ data, error })
  setSupabaseClientForUnitTests({ auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: 'host' } } } }) }, rpc } as unknown as SupabaseClient)
  return rpc
}
afterEach(() => { setSupabaseClientForUnitTests(null); vi.restoreAllMocks() })

describe('Phase 3 contracts (offline doubles, not hosted acceptance)', () => {
  it.each(['supabase', 'api', 'mock'] as const)('requires explicit %s source', source => expect(resolveDataSource(source)).toBe(source))
  it.each([undefined, '', 'Supabase', 'other'])('fails closed for %s', source => expect(resolveDataSource(source)).toBe('invalid'))
  it.each([3, 5, 7] as const)('creates persisted BO%s with exact configuration', async bestOf => {
    const rpc = client({ ...snapshot.room, best_of: bestOf })
    const result = await createSeriesRoom({ ...config, series: `BO${bestOf}` })
    expect(result.ok).toBe(true)
    expect(rpc).toHaveBeenCalledExactlyOnceWith('create_series_room', { p_name: 'Friday', p_best_of: bestOf, p_visibility: 'private', p_style: 'fun', p_mode: 'tier' })
    expect(configFromRoom({ ...snapshot.room, best_of: bestOf })).toEqual({ ...config, series: `BO${bestOf}` })
  })
  it('supabase has no initial sample rooms and reports persistence truthfully', () => {
    expect(supabaseRoomsAdapter.initial({})).toEqual([])
    expect(supabaseRoomsAdapter.initialPage({ page: 1, pageSize: 10 }).items).toEqual([])
    expect(supabaseRoomsAdapter.isSampleData).toBe(false)
    expect(supabaseRoomsAdapter.configPersisted).toBe(true)
  })
  it('discovery uses only the narrow public RPC', async () => {
    const rpc = client([])
    expect(await discoverSeriesRooms()).toEqual([])
    expect(rpc).toHaveBeenCalledExactlyOnceWith('discover_series_rooms', {})
  })
  it('does not invent host identity or queue counts absent from discovery schema', async () => {
    const row = { room_id: 'public-room', room_name: 'Friday', best_of: 5, play_style: 'fun', allocation_mode: 'random', invite_code: 'public-code' }
    const rpc = client([row])
    const rooms = await supabaseRoomsAdapter.list({})
    expect(rpc).toHaveBeenCalledExactlyOnceWith('discover_series_rooms', {})
    expect(rooms[0]).toMatchObject({ id: 'public-room', title: 'Friday · BO5', metadataUnavailable: true, visibility: 'public', status: 'unknown', inviteCode: 'public-code' })
    expect(rooms[0].playerCount).toBe(0)
    expect(rooms[0].host.name).toBe('')
  })
  it('keeps private Rooms out of the public discovery projection', async () => {
    const rpc = client([])
    const rooms = await supabaseRoomsAdapter.list({})
    expect(rooms).toEqual([])
    expect(rpc).toHaveBeenCalledExactlyOnceWith('discover_series_rooms', {})
    expect(rpc).not.toHaveBeenCalledWith('rooms', expect.anything())
  })
  it('does not fabricate create success after denial', async () => {
    client(null, { message: 'permission denied', code: '42501' })
    await expect(supabaseRoomsAdapter.createRoomWithConfig(config)).rejects.toMatchObject({ kind: 'forbidden' })
  })
  it('public history uses narrow RPC without reading protected tables', async () => {
    const rpc = client([])
    await readPublicGameResults('room')
    expect(rpc).toHaveBeenCalledExactlyOnceWith('read_public_game_results', { p_room_id: 'room' })
  })
  it('START uses series and server version; never re-prepares or balances later games', async () => {
    const rpc = client({ id: 'game', game_no: 2 })
    await startSeriesGame('room', 71)
    expect(rpc).toHaveBeenCalledExactlyOnceWith('start_series_game', { p_room_id: 'room', p_version: 71 })
    const permissions = openRoomPermissions(snapshot, 'host')
    expect(permissions).toMatchObject({ prepare: false, replace: false, saveLineup: false, end: false, close: false })
  })
  it('END and corrections carry explicit confirmation, game UUID and side', async () => {
    const rpc = client({ blue_wins: 2, red_wins: 1 })
    await reportSeriesResult('room', 71, 'game', ' match ', 'b', true, true)
    expect(rpc).toHaveBeenCalledExactlyOnceWith('report_series_result', { p_room_id: 'room', p_version: 71, p_game_id: 'game', p_match_id: 'match', p_winner: 'b', p_confirm: true, p_correct: true })
  })
  it('manual assignment strips team fields; automatic sends no client assignment', async () => {
    const rpc = client()
    await assignSeriesGame('room', 71, 'game', 'manual', [{ member_id: 'member', hero: null, lane: 'mid', team: 'b' } as never])
    expect(rpc).toHaveBeenLastCalledWith('assign_series_game', { p_room_id: 'room', p_version: 71, p_game_id: 'game', p_mode: 'manual', p_players: [{ member_id: 'member', hero: null, lane: 'mid' }] })
    await assignSeriesGame('room', 72, 'game', 'automatic')
    expect(rpc).toHaveBeenLastCalledWith('assign_series_game', { p_room_id: 'room', p_version: 72, p_game_id: 'game', p_mode: 'automatic' })
  })
  it('accepts partial drafts and opposing duplicates, rejects same-team duplicates', () => {
    const roster = [{ member_id: 'one', team: 'a' }, { member_id: 'two', team: 'a' }, { member_id: 'three', team: 'b' }] as SeriesPlayer[]
    expect(assignmentError([{ member_id: 'one', hero: 'Krixi', lane: null }], roster, ['Krixi'])).toBeNull()
    const row = { member_id: 'one', hero: 'Krixi', lane: 'mid' as const }
    expect(assignmentError([row, { ...row, member_id: 'three' }], roster, ['Krixi'])).toBeNull()
    expect(assignmentError([row, { ...row, member_id: 'two' }], roster, ['Krixi'])).toMatch(/trùng/)
  })
  it('same-team and cross-team swap each use one atomic RPC', async () => {
    const rpc = client()
    const { result } = renderHook(() => useOpenRoomActions('room', snapshot))
    await act(async () => { await result.current.swap('one', 'two') })
    expect(rpc).toHaveBeenCalledExactlyOnceWith('swap_open_room_players', { p_room_id: 'room', p_version: 71, p_first: 'one', p_second: 'two' })
  })
  it('maps deployed concurrency and capacity errors', () => {
    expect(mapRoomMutationError({ code: '40001', message: 'stale' }).kind).toBe('version_conflict')
    expect(mapRoomMutationError({ message: 'QUEUE_FULL' }).kind).toBe('queue_full')
    expect(mapRoomMutationError({ message: 'Complete assignments first' }).message).toBe('Complete assignments first')
  })
  it('reads series, ordered games, immutable roster and revisions separately', async () => {
    const tableRows: Record<string, unknown[]> = {
      room_series: [{ id: 'series', room_id: 'room', round_no: 1 }], series_players: [{ series_id: 'series', member_id: 'member' }],
      series_games: [{ id: 'game', series_id: 'series', game_no: 1, assignments: [{ member_id: 'member', hero: 'Krixi', lane: 'mid' }] }], game_result_revisions: [{ id: 1, game_id: 'game' }],
    }
    const from = vi.fn((name: string) => {
      const query = { select: vi.fn(() => query), eq: vi.fn(() => query), in: vi.fn(() => query), order: vi.fn(() => query), returns: vi.fn(async () => ({ data: tableRows[name], error: null })) }
      return query
    })
    setSupabaseClientForUnitTests({ from } as unknown as SupabaseClient)
    const result = await readSeriesState('room')
    expect(from.mock.calls.map(call => call[0])).toEqual(['room_series', 'series_players', 'series_games', 'game_result_revisions'])
    expect(result.games[0].assignments).toEqual([{ member_id: 'member', hero: 'Krixi', lane: 'mid' }])
    expect(result.revisions).toEqual([{ id: 1, game_id: 'game' }])
  })
})
