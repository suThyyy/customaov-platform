/** Offline browser QA only; never imported by production routes/adapters. */
import type { OpenRoomSnapshot } from '../api/supabase/types'

export function phase3Fixture(phase: 'preparing' | 'active'): OpenRoomSnapshot {
  const members = Array.from({ length: 12 }, (_, i) => ({ id: `member-${i}`, room_id: 'offline-room', user_id: i === 0 ? 'host' : null, member_kind: i === 0 ? 'account' as const : 'guest' as const, display_name: `Người chơi ${i + 1}`, status: 'active' as const, joined_at: '', left_at: null }))
  const selected = members.slice(0, 10).map((member, i) => ({ memberId: member.id, displayName: member.display_name, queueSeq: i + 1, queueStatus: 'selected' as const, slot: i + 1, team: i < 5 ? 'a' as const : 'b' as const, skillMode: 'random' as const, skillValue: null, skillScore: null }))
  return {
    room: { id: 'offline-room', host_user_id: 'host', invite_code: 'offline-invite', status: 'open', current_round_no: 1, current_round_state: phase, version: 7, created_at: '', closed_at: null, room_name: 'Phòng kiểm tra cục bộ', best_of: 5, visibility: 'private', play_style: 'fun', allocation_mode: 'random' },
    members, selected, waiting: members.slice(10).map((member, i) => ({ memberId: member.id, displayName: member.display_name, queueSeq: i + 11, queueStatus: 'waiting' })), version: 7, viewer: { isHost: true, isMember: true },
    seriesState: phase === 'active' ? {
      series: [{ id: 'offline-series', room_id: 'offline-room', round_no: 1, best_of: 5, blue_wins: 0, red_wins: 0, complete: false }],
      players: selected.map(player => ({ series_id: 'offline-series', member_id: player.memberId, display_name: player.displayName, slot: player.slot, team: player.team })),
      games: [{ id: 'offline-game', series_id: 'offline-series', game_no: 1, started_at: '', ended_at: null, match_id: null, winner: null, loser: null, assignments: [], assignment_mode: null, auto_generated: false }], revisions: [],
    } : { series: [], players: [], games: [], revisions: [] },
  }
}
