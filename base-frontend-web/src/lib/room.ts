import type { Room, RoomMember } from '../api'

/** "5v5 · Căng" → "Căng" */
export const roomMode = (r: Room): string => r.modeLabel.split(' · ')[1] ?? r.modeLabel

export const isRoomMember = (r: Room, userId?: string): boolean =>
  !!userId && [...r.teams.blue, ...r.teams.red].some((m) => m.player.id === userId)

export type RoomAction = 'join' | 'watch' | 'view'

/**
 * Hành động chính cho từng phòng:
 * - Đã kết thúc → "Xem"
 * - Đã ở trong phòng → "Vào phòng" (kể cả khi phòng đã đủ người)
 * - Đang diễn ra → "Theo dõi"
 * - Đang chờ nhưng đủ người → "Xem" (không vào được)
 * - Còn chỗ → "Vào phòng"
 */
export function roomAction(r: Room, userId?: string): RoomAction {
  if (r.status === 'finished') return 'view'
  if (isRoomMember(r, userId)) return 'join'
  if (r.status === 'live') return 'watch'
  if (r.playerCount >= r.capacity) return 'view'
  return 'join'
}

/* ---------------- Vai trò & quyền trong phòng (Phase 4b) ---------------- */

export type RoomRole = 'host' | 'player' | 'spectator'

export const ROOM_ROLE_LABEL: Record<RoomRole, string> = {
  host: 'Chủ phòng',
  player: 'Người chơi',
  spectator: 'Khán giả',
}

export function roomRole(r: Room, userId?: string): RoomRole {
  if (userId && r.host.id === userId) return 'host'
  return isRoomMember(r, userId) ? 'player' : 'spectator'
}

export type RoomPermission = 'split' | 'random' | 'move' | 'kick' | 'chat' | 'export'

/** Ai được làm gì trong phòng. Bảng này cũng được hiển thị ở tab "Cấu hình" của trang phòng. */
export const ROOM_PERMISSIONS: Array<{ id: RoomPermission; label: string; roles: RoomRole[] }> = [
  { id: 'split', label: 'Chia đội / chia lại', roles: ['host'] },
  { id: 'random', label: 'Random lane, tướng, hộp bí ẩn', roles: ['host'] },
  { id: 'move', label: 'Đổi chỗ người chơi giữa hai đội', roles: ['host'] },
  { id: 'kick', label: 'Mời người chơi ra khỏi phòng', roles: ['host'] },
  { id: 'chat', label: 'Chat trong phòng', roles: ['host', 'player'] },
  { id: 'export', label: 'Xuất kết quả chia đội', roles: ['host', 'player'] },
]

export const can = (role: RoomRole, permission: RoomPermission): boolean =>
  ROOM_PERMISSIONS.some((p) => p.id === permission && p.roles.includes(role))

/* ---------------- Sửa đội (kéo thả / menu) ---------------- */

export type Side = 'blue' | 'red'
export interface Teams {
  blue: RoomMember[]
  red: RoomMember[]
}

export const otherSide = (s: Side): Side => (s === 'blue' ? 'red' : 'blue')

export function sideOf(teams: Teams, playerId: string): Side | undefined {
  if (teams.blue.some((m) => m.player.id === playerId)) return 'blue'
  if (teams.red.some((m) => m.player.id === playerId)) return 'red'
  return undefined
}

export type MoveResult = { ok: true; teams: Teams; swapped?: string } | { ok: false; message: string }

/**
 * Chuyển `playerId` sang đội `to`.
 * - Thả lên một người (`targetId`) ở đội kia → đổi chỗ hai người.
 * - Thả vào đội còn chỗ → chuyển sang, xếp cuối danh sách.
 * - Đội kia đã đủ người và không chỉ định người để đổi → báo lỗi.
 */
export function moveMember(teams: Teams, playerId: string, to: Side, perSide: number, targetId?: string): MoveResult {
  const from = sideOf(teams, playerId)
  if (!from) return { ok: false, message: 'Người chơi không còn trong phòng.' }
  if (from === to) return { ok: true, teams }
  const mover = teams[from].find((m) => m.player.id === playerId)!
  const target = targetId ? teams[to].find((m) => m.player.id === targetId) : undefined
  if (target) {
    return {
      ok: true,
      swapped: target.player.name,
      teams: {
        ...teams,
        [from]: teams[from].map((m) => (m.player.id === playerId ? target : m)),
        [to]: teams[to].map((m) => (m.player.id === target.player.id ? mover : m)),
      } as Teams,
    }
  }
  if (teams[to].length >= perSide) {
    return { ok: false, message: 'Đội kia đã đủ người. Thả lên một người chơi để đổi chỗ.' }
  }
  return {
    ok: true,
    teams: {
      ...teams,
      [from]: teams[from].filter((m) => m.player.id !== playerId),
      [to]: [...teams[to], mover],
    } as Teams,
  }
}

export const removeMember = (teams: Teams, playerId: string): Teams => ({
  blue: teams.blue.filter((m) => m.player.id !== playerId),
  red: teams.red.filter((m) => m.player.id !== playerId),
})

const LANE_ORDER = ['TOP', 'JG', 'MID', 'AD', 'SP']

/** Văn bản kết quả chia đội để dán vào Zalo/Discord */
export function formatTeamsText(r: Room, teams: Teams): string {
  const line = (m: RoomMember) => `- ${m.player.name} (${m.lane})${m.captain ? ' ★' : ''}`
  const sorted = (list: RoomMember[]) =>
    [...list].sort((a, b) => LANE_ORDER.indexOf(a.lane) - LANE_ORDER.indexOf(b.lane))
  return [
    `Phòng #${r.id} – ${r.title}${r.highlight ? ` – ${r.highlight}` : ''}`,
    '',
    `Team Xanh (${teams.blue.length})`,
    ...sorted(teams.blue).map(line),
    '',
    `Team Đỏ (${teams.red.length})`,
    ...sorted(teams.red).map(line),
  ].join('\n')
}
