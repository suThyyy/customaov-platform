import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SeriesPanel } from './SeriesPanel'
import type { OpenRoomSnapshot } from '../../../api/supabase/types'
import type { SeriesGame } from '../../../api/supabase/series'

const mocks = vi.hoisted(() => ({ assign: vi.fn(), report: vi.fn(), start: vi.fn(), prepare: vi.fn(), refresh: vi.fn() }))
vi.mock('../../../api/supabase/series', async importOriginal => ({
  ...await importOriginal<typeof import('../../../api/supabase/series')>(),
  readHeroCatalog: async () => ['Krixi', 'Valhein'],
  assignSeriesGame: mocks.assign, reportSeriesResult: mocks.report, startSeriesGame: mocks.start,
}))
vi.mock('../../../api/supabase/realtime', () => ({ requestOpenRoomRefetch: mocks.refresh }))

const game: SeriesGame = { id: 'game-1', series_id: 'series-1', game_no: 1, started_at: 'now', ended_at: null, match_id: null, winner: null, loser: null, assignments: [], assignment_mode: null, auto_generated: false }
function fixture(overrides: Partial<SeriesGame> = {}, complete = false): OpenRoomSnapshot {
  return {
    room: { id: 'room-1', host_user_id: 'host', invite_code: 'code', best_of: 3, status: 'open', current_round_state: 'active', current_round_no: 1, version: 12, created_at: '', closed_at: null },
    members: [], waiting: [], selected: [], version: 12, viewer: { isHost: true, isMember: false },
    seriesState: {
      series: [{ id: 'series-1', room_id: 'room-1', round_no: 1, best_of: 3, blue_wins: complete ? 2 : 1, red_wins: 0, complete }],
      players: Array.from({ length: 10 }, (_, i) => ({ member_id: `m${i}`, series_id: 'series-1', display_name: `Player ${i}`, slot: i + 1, team: i < 5 ? 'a' : 'b' })),
      games: [{ ...game, ...overrides }], revisions: [{ id: 1, game_id: 'game-1', match_id: 'reported', winner: 'a', reported_at: 'now', reporter: 'host', provenance: 'HOST_REPORTED', verification: 'UNVERIFIED' }],
    },
  }
}
afterEach(() => { cleanup(); vi.resetAllMocks() })
const renderPanel = (snapshot: OpenRoomSnapshot, isHost = true, canPrepareNext = true, notify = vi.fn()) => render(
  <SeriesPanel snapshot={snapshot} isHost={isHost} canPrepareNext={canPrepareNext} onPrepareNext={mocks.prepare} notify={notify} />,
)

describe('Series UI (offline)', () => {
  it('renders immutable roster, score, provenance and full audit for members', async () => {
    renderPanel(fixture(), false, false)
    expect(screen.getByText(/Xanh 1 – 0 Đỏ/)).toBeTruthy()
    expect(screen.getByText(/HOST_REPORTED \/ UNVERIFIED/)).toBeTruthy()
    expect(screen.getAllByText(/\d\. Player/)).toHaveLength(10)
    expect(screen.queryByRole('button', { name: /END/ })).toBeNull()
    await waitFor(() => expect(mocks.assign).not.toHaveBeenCalled())
  })
  it('requires explicit confirmation and prevents repeated END while pending', async () => {
    let finish!: (value: unknown) => void
    mocks.report.mockReturnValue(new Promise(resolve => { finish = resolve }))
    renderPanel(fixture())
    fireEvent.click(screen.getByRole('button', { name: /END/ }))
    fireEvent.change(screen.getByLabelText('Match ID'), { target: { value: 'match-42' } })
    const submit = screen.getByRole('button', { name: 'Xác nhận kết quả' }) as HTMLButtonElement
    expect(submit.disabled).toBe(true)
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(submit)
    fireEvent.click(submit)
    expect(mocks.report).toHaveBeenCalledExactlyOnceWith('room-1', 12, 'game-1', 'match-42', 'a', true, false)
    finish({ ok: true, data: {} })
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledWith('room-1'))
  })
  it('allows no-assignment END but blocks an incomplete persisted draft', async () => {
    renderPanel(fixture({ assignments: [{ member_id: 'm0', hero: 'Krixi', lane: null }] }))
    expect((screen.getByRole('button', { name: /END/ }) as HTMLButtonElement).disabled).toBe(true)
    await waitFor(() => expect(screen.getByLabelText('Tướng cho Player 0')).toBeTruthy())
  })
  it('restores generated assignments and does not auto-reroll', async () => {
    renderPanel(fixture({ auto_generated: true, assignments: [{ member_id: 'm0', hero: 'Krixi', lane: 'mid' }] }))
    expect((screen.getByRole('button', { name: 'Đã tạo tự động' }) as HTMLButtonElement).disabled).toBe(true)
    await waitFor(() => expect((screen.getByLabelText('Tướng cho Player 0') as HTMLSelectElement).value).toBe('Krixi'))
    expect(mocks.assign).not.toHaveBeenCalled()
  })
  it('starts the next numbered game with no roster payload', async () => {
    mocks.start.mockResolvedValue({ ok: true, data: {} })
    renderPanel(fixture({ ended_at: 'now', winner: 'a', loser: 'b', match_id: 'match' }))
    fireEvent.click(screen.getByRole('button', { name: 'Bắt đầu Game 2' }))
    await waitFor(() => expect(mocks.start).toHaveBeenCalledExactlyOnceWith('room-1', 12))
    expect(screen.queryByLabelText('Tướng cho Player 0')).toBeNull()
  })
  it('correction explicitly appends an audit report and surfaces conflicts', async () => {
    const notify = vi.fn()
    mocks.report.mockResolvedValue({ ok: false, error: { kind: 'version_conflict', message: 'Phòng vừa thay đổi' } })
    renderPanel(fixture({ ended_at: 'now', winner: 'a', loser: 'b', match_id: 'match' }), true, true, notify)
    fireEvent.click(screen.getByRole('button', { name: 'Hiệu chỉnh Game 1' }))
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận kết quả' }))
    await waitFor(() => expect(mocks.report).toHaveBeenCalledExactlyOnceWith('room-1', 12, 'game-1', 'match', 'a', true, true))
    expect(notify).toHaveBeenCalledWith(expect.stringContaining('Kiểm tra lại'))
    expect(mocks.refresh).toHaveBeenCalledOnce()
  })
  it('keeps prepare-new-Series unavailable until the current Series is complete', () => {
    renderPanel(fixture(), true, true)
    expect(screen.queryByRole('button', { name: 'Chuẩn bị Series tiếp theo' })).toBeNull()
  })
  it('lets the authorized Host prepare a fresh Series and refreshes authoritative state', async () => {
    mocks.prepare.mockResolvedValue({ ok: true, data: {} })
    renderPanel(fixture({ ended_at: 'now', winner: 'a', loser: 'b', match_id: 'match' }, true))
    const button = screen.getByRole('button', { name: 'Chuẩn bị Series tiếp theo' })
    fireEvent.click(button)
    fireEvent.click(button)
    await waitFor(() => expect(mocks.prepare).toHaveBeenCalledOnce())
    expect(mocks.refresh).toHaveBeenCalledWith('room-1')
  })
  it('hides prepare-new-Series from non-Hosts', () => {
    renderPanel(fixture({ ended_at: 'now', winner: 'a', loser: 'b', match_id: 'match' }, true), false, false)
    expect(screen.queryByRole('button', { name: 'Chuẩn bị Series tiếp theo' })).toBeNull()
  })
  it('shows prepare rejection and refreshes after a stale-version response', async () => {
    const notify = vi.fn()
    mocks.prepare.mockResolvedValue({ ok: false, error: { kind: 'version_conflict', message: 'Phòng vừa thay đổi' } })
    renderPanel(fixture({ ended_at: 'now', winner: 'a', loser: 'b', match_id: 'match' }, true), true, true, notify)
    fireEvent.click(screen.getByRole('button', { name: 'Chuẩn bị Series tiếp theo' }))
    await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.stringContaining('Phòng vừa thay đổi')))
    expect(mocks.refresh).toHaveBeenCalledWith('room-1')
  })
  it('shows permission and lifecycle rejections without pretending preparation succeeded', async () => {
    const notify = vi.fn()
    mocks.prepare.mockResolvedValue({ ok: false, error: { kind: 'forbidden', message: 'Host only' } })
    renderPanel(fixture({ ended_at: 'now', winner: 'a', loser: 'b', match_id: 'match' }, true), true, true, notify)
    fireEvent.click(screen.getByRole('button', { name: 'Chuẩn bị Series tiếp theo' }))
    await waitFor(() => expect(notify).toHaveBeenCalledWith('Host only'))
    expect(mocks.refresh).not.toHaveBeenCalled()
  })
})
