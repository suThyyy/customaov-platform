import type { OpenRoomLineupPlayer, OpenRoomParticipant, OpenRoomRow } from '../../../api'

export const OPEN_ROOM_PHASE_LABEL: Record<OpenRoomRow['current_round_state'], string> = {
  idle: 'Chưa bắt đầu',
  preparing: 'Đang chuẩn bị đội hình',
  active: 'Đang thi đấu',
  ended: 'Đã kết thúc vòng',
}

export function buildLineupFromSelected(selected: readonly OpenRoomParticipant[]): OpenRoomLineupPlayer[] {
  return selected.map((player, index) => ({
    member_id: player.memberId,
    team: player.team ?? (index < 5 ? 'a' : 'b'),
    skill_mode: 'random',
    skill_value: null,
    skill_score: null,
  }))
}

export function buildRandomLineup(selected: readonly OpenRoomParticipant[]): OpenRoomLineupPlayer[] {
  const shuffled = [...selected]
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    const current = shuffled[i]
    shuffled[i] = shuffled[j]
    shuffled[j] = current
  }
  return shuffled.map((player, index) => ({
    member_id: player.memberId,
    team: index < 5 ? 'a' : 'b',
    skill_mode: 'random',
    skill_value: null,
    skill_score: null,
  }))
}
