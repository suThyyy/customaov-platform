import { getSupabaseClient } from './client'
import { throwSupabase } from './errors'
import { rpc } from './roomMutations'

export type Side = 'a' | 'b'
export type GameLane = 'top' | 'jungle' | 'mid' | 'adc' | 'support'
export interface GameAssignment { member_id: string; hero: string | null; lane: GameLane | null }
export interface SeriesRow { id: string; room_id: string; round_no: number; best_of: 3 | 5 | 7; blue_wins: number; red_wins: number; complete: boolean }
export interface SeriesPlayer { series_id: string; member_id: string; display_name: string; slot: number; team: Side }
export interface SeriesGame { id: string; series_id: string; game_no: number; started_at: string; ended_at: string | null; match_id: string | null; winner: Side | null; loser: Side | null; assignments: GameAssignment[]; assignment_mode: 'manual' | 'automatic' | null; auto_generated: boolean }
export interface ResultRevision { id: number; game_id: string; match_id: string; winner: Side; reporter: string; reported_at: string; provenance: string; verification: string }
export interface PublicGameResult { series_id: string; game_no: number; match_id: string; winner: Side; ended_at: string; provenance: string; verification: string }
export interface SeriesState { series: SeriesRow[]; players: SeriesPlayer[]; games: SeriesGame[]; revisions: ResultRevision[] }

/** Separate RLS-protected reads; never infer history from the legacy snapshot. */
export async function readSeriesState(roomId: string): Promise<SeriesState> {
  const client = getSupabaseClient()
  const series = await client.from('room_series').select('*').eq('room_id', roomId).order('round_no').returns<SeriesRow[]>()
  if (series.error) throwSupabase(series.error)
  const rows = series.data ?? []
  if (!rows.length) return { series: [], players: [], games: [], revisions: [] }
  const ids = rows.map(row => row.id)
  const [players, games] = await Promise.all([
    client.from('series_players').select('*').in('series_id', ids).order('slot').returns<SeriesPlayer[]>(),
    client.from('series_games').select('*').in('series_id', ids).order('game_no').returns<SeriesGame[]>(),
  ])
  if (players.error) throwSupabase(players.error)
  if (games.error) throwSupabase(games.error)
  const gameRows = games.data ?? []
  const revisions = gameRows.length ? await client.from('game_result_revisions').select('*').in('game_id', gameRows.map(game => game.id)).order('id').returns<ResultRevision[]>() : { data: [], error: null }
  if (revisions.error) throwSupabase(revisions.error)
  return { series: rows, players: players.data ?? [], games: gameRows, revisions: revisions.data ?? [] }
}

export async function readHeroCatalog(): Promise<string[]> {
  const result = await getSupabaseClient().from('series_hero_catalog').select('hero').order('hero').returns<{ hero: string }[]>()
  if (result.error) throwSupabase(result.error)
  return (result.data ?? []).map(row => row.hero)
}

export const readPublicGameResults = (roomId: string) => rpc<PublicGameResult[]>('read_public_game_results', { p_room_id: roomId })
export const startSeriesGame = (roomId: string, version: number) => rpc<SeriesGame>('start_series_game', { p_room_id: roomId, p_version: version })
export const reportSeriesResult = (roomId: string, version: number, gameId: string, matchId: string, winner: Side, confirm: boolean, correct = false) =>
  rpc<SeriesRow>('report_series_result', { p_room_id: roomId, p_version: version, p_game_id: gameId, p_match_id: matchId.trim(), p_winner: winner, p_confirm: confirm, p_correct: correct })
export const assignSeriesGame = (roomId: string, version: number, gameId: string, mode: 'automatic' | 'manual', players?: readonly GameAssignment[]) =>
  rpc<SeriesGame>('assign_series_game', { p_room_id: roomId, p_version: version, p_game_id: gameId, p_mode: mode,
    ...(mode === 'manual' ? { p_players: (players ?? []).map(({ member_id, hero, lane }) => ({ member_id, hero, lane })) } : {}),
  })

export function assignmentError(draft: readonly GameAssignment[], roster: readonly SeriesPlayer[], catalog: readonly string[]): string | null {
  const members = new Set<string>()
  const heroes = new Set<string>()
  const lanes = new Set<string>()
  for (const row of draft) {
    const player = roster.find(player => player.member_id === row.member_id)
    if (!player || members.has(row.member_id)) return 'Người chơi không hợp lệ.'
    members.add(row.member_id)
    if (row.hero && (!catalog.includes(row.hero) || heroes.has(`${player.team}:${row.hero}`))) return 'Tướng không hợp lệ hoặc trùng trong đội.'
    if (row.lane && (!['top', 'jungle', 'mid', 'adc', 'support'].includes(row.lane) || lanes.has(`${player.team}:${row.lane}`))) return 'Đường không hợp lệ hoặc trùng trong đội.'
    if (row.hero) heroes.add(`${player.team}:${row.hero}`)
    if (row.lane) lanes.add(`${player.team}:${row.lane}`)
  }
  return null
}
