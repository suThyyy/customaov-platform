import type { PostgrestError, SupabaseClient, User } from '@supabase/supabase-js'
import { isAnonymousSupabaseUser } from './auth'
import { getSupabaseClient } from './client'
import type { OpenRoomMemberRow, OpenRoomRow, QueueEntryRow } from './types'

export type RoomMutationErrorKind =
  | 'version_conflict'
  | 'forbidden'
  | 'not_found'
  | 'invalid_state'
  | 'queue_full'
  | 'not_enough_players'
  | 'incomplete_lineup'
  | 'auth_required'
  | 'invalid_input'
  | 'network'
  | 'unknown'

export class RoomMutationError extends Error {
  readonly kind: RoomMutationErrorKind
  readonly sourceMessage?: string

  constructor(
    kind: RoomMutationErrorKind,
    message: string,
    sourceMessage?: string,
  ) {
    super(message)
    this.name = 'RoomMutationError'
    this.kind = kind
    this.sourceMessage = sourceMessage
  }
}

export type RoomMutationResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: RoomMutationError }

export interface OpenRoomLineupPlayer {
  member_id: string
  team: 'a' | 'b'
  skill_mode: 'random' | 'tier' | 'rank'
  skill_value: string | null
  skill_score: number | null
}

const UI_MESSAGES: Record<RoomMutationErrorKind, string> = {
  version_conflict: 'Phòng vừa thay đổi, đã tải lại.',
  forbidden: 'Bạn không có quyền thực hiện thao tác này.',
  not_found: 'Không tìm thấy phòng hoặc người chơi cần thao tác.',
  invalid_state: 'Thao tác này không phù hợp với trạng thái hiện tại của phòng.',
  queue_full: 'Hàng chờ đã đầy.',
  not_enough_players: 'Chưa đủ người chơi để thực hiện thao tác này.',
  incomplete_lineup: 'Hãy xếp đủ đội hình 5v5 trước khi bắt đầu.',
  auth_required: 'Bạn cần đăng nhập bằng tài khoản thường để thao tác trong phòng.',
  invalid_input: 'Thông tin gửi lên không hợp lệ.',
  network: 'Không thể kết nối tới máy chủ. Vui lòng thử lại.',
  unknown: 'Không thể cập nhật phòng. Vui lòng thử lại.',
}

const messageMatches = (message: string, patterns: readonly string[]): boolean =>
  patterns.some((pattern) => message.toLowerCase().includes(pattern.toLowerCase()))

export function mapRoomMutationError(reason: unknown): RoomMutationError {
  if (reason instanceof RoomMutationError) return reason
  const error = (reason ?? {}) as Partial<PostgrestError> & { status?: number }
  const sourceMessage = typeof error.message === 'string' ? error.message : String(reason ?? '')
  const code = typeof error.code === 'string' ? error.code : ''

  let kind: RoomMutationErrorKind = 'unknown'
  if (code === '40001' || messageMatches(sourceMessage, ['Room changed; refresh and retry', 'Queue changed; refresh and retry'])) {
    kind = 'version_conflict'
  } else if (messageMatches(sourceMessage, [
    'Host only', 'Only the Host', 'Only the Room Host', 'Only the active Room Host',
    'The Room Host cannot kick themselves', 'permission denied',
  ]) || code === '42501') {
    kind = 'forbidden'
  } else if (messageMatches(sourceMessage, [
    'Room not found', 'Room membership not found', 'Active Room membership not found',
    'Room member not found', 'Selected player not found',
  ])) {
    kind = 'not_found'
  } else if (messageMatches(sourceMessage, ['Save a complete active 5v5 lineup before Start'])) {
    kind = 'incomplete_lineup'
  } else if (messageMatches(sourceMessage, ['Ten waiting players required', 'No waiting player available'])) {
    kind = 'not_enough_players'
  } else if (messageMatches(sourceMessage, ['queue full', 'QUEUE_FULL'])) {
    kind = 'queue_full'
  } else if (messageMatches(sourceMessage, [
    'Round is not preparing', 'Current Round must be ended', 'current Round is still in progress',
    'Room is closed', 'already closed', 'already registered in the Queue', 'already in the active Queue',
    'already kicked', 'was kicked from the room',
  ])) {
    kind = 'invalid_state'
  } else if (messageMatches(sourceMessage, [
    'Authentication required', 'Permanent account required', 'Permanent authenticated account required',
    'Permanent authenticated Host required', 'Only a registered authenticated user',
  ]) || code === 'PGRST301' || error.status === 401) {
    kind = 'auth_required'
  } else if (messageMatches(sourceMessage, [
    'Invalid invite code or display name', 'Invalid display name', 'Invalid lineup',
    'Exactly ten selected players required', 'Invalid lineup values', 'Teams must be 5v5',
  ])) {
    kind = 'invalid_input'
  } else if (
    reason instanceof TypeError
    || error.status === 0
    || messageMatches(sourceMessage, ['failed to fetch', 'networkerror', 'network request failed', 'load failed'])
  ) {
    kind = 'network'
  }
  const businessError = code === 'P0001' || code === 'P0002' || [
    'Complete assignments first', 'Already generated', 'Invalid or duplicate assignment',
    'Correction would invalidate later games', 'Subsequent series already prepared',
    'Game in progress', 'Unexpected game state', 'Save selected allocation mode',
  ].includes(sourceMessage)
  return new RoomMutationError(kind, kind === 'unknown' && businessError ? sourceMessage : UI_MESSAGES[kind], sourceMessage || undefined)
}

function requireText(value: unknown, label: string, maxLength = 128): RoomMutationResult<string> {
  const normalized = typeof value === 'string' ? value.trim() : ''
  if (!normalized || normalized.length > maxLength) {
    const sourceMessage = `${label} is required`
    return { ok: false, error: new RoomMutationError('invalid_input', UI_MESSAGES.invalid_input, sourceMessage) }
  }
  return { ok: true, data: normalized }
}

async function currentPermanentUser(client: SupabaseClient): Promise<RoomMutationResult<User>> {
  try {
    const session = await client.auth.getSession()
    if (session.error) return { ok: false, error: mapRoomMutationError(session.error) }
    const user = session.data.session?.user
    if (!user) {
      return { ok: false, error: new RoomMutationError('auth_required', UI_MESSAGES.auth_required, 'Authentication required') }
    }
    if (isAnonymousSupabaseUser(user)) {
      return { ok: false, error: new RoomMutationError('auth_required', UI_MESSAGES.auth_required, 'Permanent account required') }
    }
    return { ok: true, data: user }
  } catch (reason) {
    return { ok: false, error: mapRoomMutationError(reason) }
  }
}

export async function rpc<T>(name: string, args: Record<string, unknown> = {}): Promise<RoomMutationResult<T>> {
  const client = getSupabaseClient()
  const auth = await currentPermanentUser(client)
  if (!auth.ok) return auth
  try {
    const result = await client.rpc(name, args)
    if (result.error) {
      const error = mapRoomMutationError(result.error)
      if (error.kind === 'forbidden') window.dispatchEvent(new Event('customaov:permission-denied'))
      return { ok: false, error }
    }
    return { ok: true, data: result.data as T }
  } catch (reason) {
    return { ok: false, error: mapRoomMutationError(reason) }
  }
}

function oneTextArg<T>(rpcName: string, key: string, value: unknown, label: string): Promise<RoomMutationResult<T>> {
  const text = requireText(value, label)
  return text.ok ? rpc<T>(rpcName, { [key]: text.data }) : Promise.resolve(text)
}

function roomAndMember<T>(rpcName: string, roomId: unknown, memberId: unknown): Promise<RoomMutationResult<T>> {
  const room = requireText(roomId, 'Room id')
  if (!room.ok) return Promise.resolve(room)
  const member = requireText(memberId, 'Member id')
  return member.ok
    ? rpc<T>(rpcName, { p_room_id: room.data, p_member_id: member.data })
    : Promise.resolve(member)
}

export const createOpenRoom = (): Promise<RoomMutationResult<OpenRoomRow>> => rpc('create_open_room')

export const closeOpenRoom = (roomId: string): Promise<RoomMutationResult<OpenRoomRow>> =>
  oneTextArg('close_open_room', 'p_room_id', roomId, 'Room id')

export function joinOpenRoom(inviteCode: string, displayName: string): Promise<RoomMutationResult<OpenRoomMemberRow>> {
  const invite = requireText(inviteCode, 'Invite code')
  if (!invite.ok) return Promise.resolve(invite)
  const name = requireText(displayName, 'Display name', 40)
  return name.ok
    ? rpc('join_open_room', { p_invite_code: invite.data, p_display_name: name.data })
    : Promise.resolve(name)
}

export const leaveOpenRoom = (roomId: string): Promise<RoomMutationResult<null>> =>
  oneTextArg('leave_open_room', 'p_room_id', roomId, 'Room id')

export function hostAddPlayerToRoom(roomId: string, displayName: string): Promise<RoomMutationResult<OpenRoomMemberRow>> {
  const room = requireText(roomId, 'Room id')
  if (!room.ok) return Promise.resolve(room)
  const name = requireText(displayName, 'Display name', 40)
  return name.ok
    ? rpc('host_add_player_to_room', { p_room_id: room.data, p_display_name: name.data })
    : Promise.resolve(name)
}

export const hostKickRoomMember = (roomId: string, memberId: string): Promise<RoomMutationResult<null>> =>
  roomAndMember('host_kick_room_member', roomId, memberId)

export const hostRequeueRoomMember = (roomId: string, memberId: string): Promise<RoomMutationResult<QueueEntryRow>> =>
  roomAndMember('host_requeue_room_member', roomId, memberId)

export const continueOpenRoomQueue = (roomId: string): Promise<RoomMutationResult<QueueEntryRow>> =>
  oneTextArg('continue_open_room_queue', 'p_room_id', roomId, 'Room id')

export const prepareNextOpenRoomRound = (roomId: string): Promise<RoomMutationResult<OpenRoomRow>> =>
  oneTextArg('prepare_next_open_room_round', 'p_room_id', roomId, 'Room id')

export const startOpenRoomRound = (roomId: string): Promise<RoomMutationResult<OpenRoomRow>> =>
  oneTextArg('start_open_room_round', 'p_room_id', roomId, 'Room id')

export const endOpenRoomRound = (roomId: string): Promise<RoomMutationResult<OpenRoomRow>> =>
  oneTextArg('end_open_room_round', 'p_room_id', roomId, 'Room id')

export function saveOpenRoomLineup(
  roomId: string,
  version: number,
  players: readonly OpenRoomLineupPlayer[],
): Promise<RoomMutationResult<OpenRoomRow>> {
  const room = requireText(roomId, 'Room id')
  if (!room.ok) return Promise.resolve(room)
  return rpc('save_open_room_lineup', {
    p_room_id: room.data,
    p_version: version,
    p_players: players.map(({ member_id, team, skill_mode, skill_value, skill_score }) => ({
      member_id, team, skill_mode, skill_value, skill_score,
    })),
  })
}

export function replaceOpenRoomPlayer(
  roomId: string,
  version: number,
  memberId: string,
): Promise<RoomMutationResult<OpenRoomRow>> {
  const room = requireText(roomId, 'Room id')
  if (!room.ok) return Promise.resolve(room)
  const member = requireText(memberId, 'Member id')
  return member.ok
    ? rpc('replace_open_room_player', { p_room_id: room.data, p_version: version, p_member_id: member.data })
    : Promise.resolve(member)
}

export function swapLineupPlayers(
  lineup: readonly OpenRoomLineupPlayer[],
  firstMemberId: string,
  secondMemberId: string,
): OpenRoomLineupPlayer[] {
  const first = lineup.find((player) => player.member_id === firstMemberId)
  const second = lineup.find((player) => player.member_id === secondMemberId)
  if (!first || !second || first.team === second.team) {
    throw new RoomMutationError('invalid_input', 'Chọn hai người chơi thuộc hai đội khác nhau.')
  }
  return lineup.map((player) => {
    if (player.member_id === firstMemberId) return { ...player, team: second.team }
    if (player.member_id === secondMemberId) return { ...player, team: first.team }
    return { ...player }
  })
}
