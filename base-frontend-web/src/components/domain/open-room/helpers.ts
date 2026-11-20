import type { OpenRoomLineupPlayer, OpenRoomParticipant, OpenRoomRow } from '../../../api'

export const OPEN_ROOM_PHASE_LABEL: Record<OpenRoomRow['current_round_state'], string> = {
  idle: 'Chưa bắt đầu',
  preparing: 'Đang chuẩn bị đội hình',
  active: 'Đang thi đấu',
  ended: 'Đã kết thúc vòng',
}

export function buildLineupFromSelected(selected: readonly OpenRoomParticipant[]): OpenRoomLineupPlayer[] {
  const teamA = selected.filter((player) => player.team === 'a').length
  const teamB = selected.filter((player) => player.team === 'b').length
  if (selected.length !== 10 || teamA !== 5 || teamB !== 5) {
    throw new Error('Đội hình phải đủ 5v5 trước khi lưu.')
  }
  return selected.map((player) => {
    if (player.team !== 'a' && player.team !== 'b') throw new Error('Đội hình phải đủ 5v5 trước khi lưu.')
    return {
      member_id: player.memberId,
      team: player.team,
      skill_mode: player.skillMode ?? 'random',
      skill_value: player.skillValue ?? null,
      skill_score: player.skillScore ?? null,
    }
  })
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
