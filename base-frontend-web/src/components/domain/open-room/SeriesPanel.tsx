import { useEffect, useMemo, useRef, useState } from 'react'
import { TeamReveal } from './TeamReveal'
import { revealKeyOf, type RevealEntry, type RevealVariant } from './revealPlan'
import { assignSeriesGame, assignmentError, readHeroCatalog, reportSeriesResult, startSeriesGame, type GameAssignment, type GameLane, type SeriesGame, type Side } from '../../../api/supabase/series'
import { requestOpenRoomRefetch } from '../../../api/supabase/realtime'
import type { OpenRoomSnapshot } from '../../../api/supabase/types'
import type { RoomMutationResult } from '../../../api/supabase/roomMutations'
import { Button } from '../../ui/Button'
import { Card } from '../../ui/primitives'

const inputClass = 'w-full min-w-0 rounded-btn border border-line bg-surface px-3 py-2 text-sm'

export function SeriesPanel({ snapshot, isHost, canPrepareNext, onPrepareNext, notify, revealVariant = 'roulette' }: {
  snapshot: OpenRoomSnapshot
  isHost: boolean
  canPrepareNext: boolean
  onPrepareNext: () => Promise<RoomMutationResult<unknown>>
  notify: (message: string) => void
  /** Kiểu công bố đội sau START (Random → roulette, Tier/Rank → meteor). Chỉ là trình diễn. */
  revealVariant?: RevealVariant
}) {
  const state = snapshot.seriesState
  const current = state?.series.find(row => !row.complete) ?? state?.series.at(-1)
  const games = state?.games.filter(game => game.series_id === current?.id) ?? []
  const game = games.at(-1)
  const roster = useMemo(() => state?.players.filter(player => player.series_id === current?.id) ?? [], [state?.players, current?.id])
  const [heroes, setHeroes] = useState<string[]>([])
  const [catalogError, setCatalogError] = useState('')
  const [catalogAttempt, setCatalogAttempt] = useState(0)
  const [draft, setDraft] = useState<GameAssignment[]>(game?.assignments ?? [])
  const [editing, setEditing] = useState<SeriesGame | null>(null)
  const [matchId, setMatchId] = useState('')
  const [winner, setWinner] = useState<Side>('a')
  const [confirmed, setConfirmed] = useState(false)
  const [pending, setPending] = useState(false)
  const busy = useRef(false)
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  useEffect(() => {
    let active = true
    void readHeroCatalog().then(rows => { if (active) { setHeroes(rows); setCatalogError('') } }, error => { if (active) setCatalogError(String(error.message ?? error)) })
    return () => { active = false }
  }, [catalogAttempt])
  useEffect(() => {
    setDraft(game?.assignments ?? [])
    setEditing(null)
    setConfirmed(false)
  }, [game, snapshot.version])

  const run = async (operation: () => Promise<RoomMutationResult<unknown>>) => {
    if (!isHost) { notify('Bạn không có quyền quản lý phòng này.'); return }
    if (busy.current) return
    busy.current = true
    setPending(true)
    try {
      const result = await operation()
      if (!result.ok) notify(`${result.error.message}${result.error.kind === 'version_conflict' ? ' Kiểm tra lại dữ liệu trước khi gửi.' : ''}`)
      if (result.ok || !result.ok && result.error.kind === 'version_conflict') await requestOpenRoomRefetch(snapshot.room.id)
    } catch (error) { notify(error instanceof Error ? error.message : String(error)) }
    finally { busy.current = false; if (mounted.current) setPending(false) }
  }
  const editable = isHost && snapshot.room.status === 'open'
  const canPrepareNewSeries = editable && current?.complete === true && canPrepareNext
  const canAssign = editable && game && !game.ended_at
  const assignmentIncomplete = Boolean(game?.assignments.length && (game.assignments.length !== 10 || game.assignments.some(row => !row.hero || !row.lane)))
  const change = (memberId: string, field: 'hero' | 'lane', value: string) => setDraft(rows => {
    const old = rows.find(row => row.member_id === memberId) ?? { member_id: memberId, hero: null, lane: null }
    const next = { ...old, [field]: value || null }
    return [...rows.filter(row => row.member_id !== memberId), next].filter(row => row.hero || row.lane)
  })
  // Reveal chỉ đọc roster bất biến và phân công đã persist của Game hiện tại; không gửi mutation nào.
  const liveGame = game && !game.ended_at ? game : undefined
  const teamEntries = useMemo<RevealEntry[]>(() => liveGame && roster.length === 10
    ? roster.map(player => ({ id: player.member_id, team: player.team, slot: player.slot, primary: player.display_name }))
    : [], [liveGame, roster])
  const heroEntries = useMemo<RevealEntry[]>(() => {
    const rows = liveGame?.assignments ?? []
    if (rows.length !== 10 || rows.some(row => !row.hero || !row.lane)) return []
    return rows.flatMap(row => {
      const player = roster.find(item => item.member_id === row.member_id)
      return player ? [{ id: player.member_id, team: player.team, slot: player.slot, primary: row.hero!, secondary: `${player.display_name} · ${row.lane}` }] : []
    })
  }, [liveGame, roster])
  const teamRevealKey = liveGame ? revealKeyOf(`start:${liveGame.id}`, teamEntries) : null
  const heroRevealKey = liveGame && heroEntries.length === 10 ? revealKeyOf(`heroes:${liveGame.id}`, heroEntries) : null
  const beginReport = (target: SeriesGame) => { setEditing(target); setMatchId(target.match_id ?? ''); setWinner(target.winner ?? 'a'); setConfirmed(false) }

  return <Card className="min-w-0 space-y-4 p-4">
    <h2 className="text-lg font-semibold">Series · BO{snapshot.room.best_of}</h2>
    {!current ? <p>Chọn mười người, lưu đội hình 5v5 rồi bắt đầu Game 1.</p> : <>
      <p className="text-lg">Series {current.round_no}: Xanh {current.blue_wins} – {current.red_wins} Đỏ · {current.complete ? 'Đã hoàn tất' : `Game ${game?.game_no ?? 1}`}</p>
      <p className="text-sm text-fg-muted">Đội hình được khóa trong toàn bộ Series. Kết quả do chủ phòng báo cáo, chưa xác minh với nhà phát hành.</p>
      <TeamReveal entries={teamEntries} revealKey={teamRevealKey} variant={revealVariant} title={`đội hình Game ${liveGame?.game_no ?? ''}`}>
      <TeamReveal entries={heroEntries} revealKey={heroRevealKey} variant="roulette" pool={heroes} title={`tướng và đường Game ${liveGame?.game_no ?? ''}`}>
      <div className="grid min-w-0 gap-4 md:grid-cols-2">
        {(['a', 'b'] as const).map(side => <section key={side} aria-label={side === 'a' ? 'Đội Xanh đã khóa' : 'Đội Đỏ đã khóa'} className="min-w-0 space-y-3 rounded-card border border-line p-3">
          <h3 className={side === 'a' ? 'text-team-blue-fg' : 'text-team-red-fg'}>{side === 'a' ? 'Xanh' : 'Đỏ'}</h3>
          {roster.filter(player => player.team === side).map(player => {
            const row = draft.find(row => row.member_id === player.member_id)
            return <div key={player.member_id} className="min-w-0 space-y-2">
              <p className="break-words text-sm">{player.slot}. {player.display_name}</p>
              {canAssign ? <div className="grid min-w-0 grid-cols-2 gap-2">
                <select className={inputClass} aria-label={`Tướng cho ${player.display_name}`} value={row?.hero ?? ''} disabled={pending || !heroes.length} onChange={event => change(player.member_id, 'hero', event.target.value)}><option value="">Chưa chọn tướng</option>{heroes.map(hero => <option key={hero}>{hero}</option>)}</select>
                <select className={inputClass} aria-label={`Đường cho ${player.display_name}`} value={row?.lane ?? ''} disabled={pending} onChange={event => change(player.member_id, 'lane', event.target.value as GameLane)}><option value="">Chưa chọn đường</option>{['top', 'jungle', 'mid', 'adc', 'support'].map(lane => <option key={lane}>{lane}</option>)}</select>
              </div> : <p className="text-sm text-fg-muted">{row?.hero ?? 'Chưa chọn tướng'} · {row?.lane ?? 'Chưa chọn đường'}</p>}
            </div>
          })}
        </section>)}
      </div>
      </TeamReveal>
      </TeamReveal>
      {catalogError && <p role="alert">{catalogError} <Button variant="outline" onClick={() => setCatalogAttempt(value => value + 1)}>Tải lại danh mục</Button></p>}
      {canAssign && <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={pending || game.auto_generated} onClick={() => void run(() => assignSeriesGame(snapshot.room.id, snapshot.version, game.id, 'automatic'))}>{game.auto_generated ? 'Đã tạo tự động' : 'Tự động chọn tướng / đường'}</Button>
        <Button variant="outline" disabled={pending || !heroes.length} onClick={() => { const error = assignmentError(draft, roster, heroes); if (error) notify(error); else void run(() => assignSeriesGame(snapshot.room.id, snapshot.version, game.id, 'manual', draft)) }}>Lưu bản nháp</Button>
        <Button variant="ghost" disabled={pending} onClick={() => void run(() => assignSeriesGame(snapshot.room.id, snapshot.version, game.id, 'manual', []))}>Xóa bản nháp đã lưu</Button>
      </div>}
      {editable && game && !game.ended_at && <Button variant="outline" disabled={pending || assignmentIncomplete} onClick={() => beginReport(game)}>Báo cáo kết quả / END</Button>}
      {assignmentIncomplete && <p className="text-sm text-fg-muted">Hoàn tất bản nháp đã lưu hoặc xóa bản nháp trước khi END.</p>}
      {editable && !current.complete && game?.ended_at && <Button variant="primary" disabled={pending} onClick={() => void run(() => startSeriesGame(snapshot.room.id, snapshot.version))}>Bắt đầu Game {game.game_no + 1}</Button>}
      {canPrepareNewSeries && <div className="space-y-2">
        <p className="text-sm text-fg-muted">Series đã hoàn tất. Chuẩn bị vòng mới sẽ lấy hàng chờ hiện tại và tạo đội hình Series độc lập.</p>
        <Button variant="outline" disabled={pending} onClick={() => void run(onPrepareNext)}>
          {pending ? 'Đang chuẩn bị Series mới…' : 'Chuẩn bị Series tiếp theo'}
        </Button>
      </div>}
    </>}
    {editing && editable && <form className="space-y-3 rounded-card border border-line p-4" onSubmit={event => { event.preventDefault(); if (!confirmed || !matchId.trim() || pending) return; void run(() => reportSeriesResult(snapshot.room.id, snapshot.version, editing.id, matchId, winner, confirmed, Boolean(editing.ended_at))) }}>
      <h3 className="text-base font-semibold">{editing.ended_at ? 'Hiệu chỉnh' : 'Báo cáo'} Game {editing.game_no}</h3>
      <label className="block text-sm">Match ID<input className={inputClass} required maxLength={128} value={matchId} onChange={event => setMatchId(event.target.value)} /></label>
      <label className="block text-sm">Đội thắng<select className={inputClass} value={winner} onChange={event => setWinner(event.target.value as Side)}><option value="a">A / Xanh</option><option value="b">B / Đỏ</option></select></label>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />Tôi xác nhận Match ID và đội thắng. Kết quả HOST_REPORTED / UNVERIFIED; hiệu chỉnh được ghi lịch sử.</label>
      <div className="flex gap-2"><Button variant="outline" type="submit" disabled={pending || !confirmed || !matchId.trim()}>Xác nhận kết quả</Button><Button variant="ghost" disabled={pending} onClick={() => setEditing(null)}>Hủy</Button></div>
    </form>}
    <h3 className="text-base font-semibold">Lịch sử trận và hiệu chỉnh</h3>
    {!state?.games.length ? <p className="text-sm text-fg-muted">Chưa có trận đấu.</p> : state.series.map(series => <section key={series.id} className="min-w-0 space-y-2">
      <h4>Series {series.round_no} · BO{series.best_of} · {series.blue_wins} – {series.red_wins}</h4>
      {state.games.filter(row => row.series_id === series.id).map(row => <div key={row.id} className="min-w-0 rounded-btn border border-line p-3 text-sm">
        <p className="break-all">Game {row.game_no} · Match ID: {row.match_id ?? 'Chưa báo cáo'} · Thắng: {row.winner === 'a' ? 'Xanh' : row.winner === 'b' ? 'Đỏ' : '—'} · Thua: {row.loser === 'a' ? 'Xanh' : row.loser === 'b' ? 'Đỏ' : '—'}</p>
        {editable && row.ended_at && <Button variant="ghost" disabled={pending} onClick={() => beginReport(row)}>Hiệu chỉnh Game {row.game_no}</Button>}
        <details><summary>Lịch sử báo cáo</summary><ul className="space-y-2">{state.revisions.filter(revision => revision.game_id === row.id).map(revision => <li key={revision.id} className="break-all">{revision.reported_at} · {revision.reporter} · {revision.match_id} · {revision.winner === 'a' ? 'Xanh' : 'Đỏ'} · {revision.provenance} / {revision.verification}</li>)}</ul></details>
      </div>)}
    </section>)}
  </Card>
}
