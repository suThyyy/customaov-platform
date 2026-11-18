import { getSupabaseClient } from './client'
import { SupabaseAdapterError, throwSupabase } from './errors'
import type {
  CurrentPlayerRow,
  OpenRoomMemberRow,
  OpenRoomParticipant,
  OpenRoomRow,
  OpenRoomSnapshot,
  OpenRoomSnapshotPayload,
  QueueEntryRow,
} from './types'

const missingRpc = (error: { code?: string; message?: string }): boolean =>
  error.code === '42883' || error.code === 'PGRST202' || /function .*read_open_room_state.*not found/i.test(error.message ?? '')

export function mapOpenRoomSnapshot(payload: OpenRoomSnapshotPayload, viewerId?: string | null): OpenRoomSnapshot {
  const members = new Map(payload.members.map((member) => [member.id, member]))
  const participant = (entry: QueueEntryRow, player?: CurrentPlayerRow): OpenRoomParticipant => ({
    memberId: entry.member_id,
    displayName: members.get(entry.member_id)?.display_name || 'Người chơi',
    queueSeq: entry.queue_seq,
    queueStatus: entry.status,
    slot: player?.slot,
    team: player?.team,
    readyState: player?.ready_state,
  })
  const queue = [...payload.queue].sort((a, b) => a.queue_seq - b.queue_seq)
  const entries = new Map(queue.map((entry) => [entry.id, entry]))
  const selected = [...payload.currentPlayers]
    .sort((a, b) => a.slot - b.slot)
    .map((player) => participant(entries.get(player.queue_entry_id) ?? {
      id: player.queue_entry_id,
      room_id: player.room_id,
      member_id: player.member_id,
      queue_seq: Number.MAX_SAFE_INTEGER,
      status: 'selected',
      joined_at: '',
      selected_round_no: player.round_no,
    }, player))
  return {
    room: payload.room,
    members: payload.members,
    waiting: queue.filter((entry) => entry.status === 'waiting').map((entry) => participant(entry)),
    selected,
    version: payload.room.version,
    viewer: {
      isHost: Boolean(viewerId && payload.room.host_user_id === viewerId),
      isMember: Boolean(viewerId && payload.members.some((member) => member.user_id === viewerId && member.status === 'active')),
    },
  }
}

async function readTables(roomId: string): Promise<OpenRoomSnapshotPayload | null> {
  const client = getSupabaseClient()
  const [room, members, queue, currentPlayers] = await Promise.all([
    client.from('rooms').select('*').eq('id', roomId).maybeSingle<OpenRoomRow>(),
    client.from('room_members').select('*').eq('room_id', roomId).order('joined_at', { ascending: true }).returns<OpenRoomMemberRow[]>(),
    client.from('room_queue_entries').select('*').eq('room_id', roomId).order('queue_seq', { ascending: true }).returns<QueueEntryRow[]>(),
    client.from('room_current_players').select('*').eq('room_id', roomId).order('slot', { ascending: true }).returns<CurrentPlayerRow[]>(),
  ])
  const error = room.error || members.error || queue.error || currentPlayers.error
  if (error) throwSupabase(error)
  if (!room.data) return null
  return { room: room.data, members: members.data ?? [], queue: queue.data ?? [], currentPlayers: currentPlayers.data ?? [] }
}

export async function readOpenRoomSnapshot(roomId: string): Promise<OpenRoomSnapshot | null> {
  const normalized = roomId.trim()
  if (!normalized) throw new SupabaseAdapterError('Mã phòng không hợp lệ.', 'INVALID_ROOM_ID', 400)
  const client = getSupabaseClient()
  const session = await client.auth.getSession()
  if (session.error) throwSupabase(session.error)
  const user = session.data.session?.user
  if (!user || user.is_anonymous || user.app_metadata?.is_anonymous === true) {
    throw new SupabaseAdapterError('Bạn cần đăng nhập bằng tài khoản thường để xem phòng.', 'AUTH_REQUIRED', 401)
  }

  const rpc = await client.rpc('read_open_room_state', { p_room_id: normalized })
  let payload: OpenRoomSnapshotPayload | null
  if (rpc.error) {
    if (!missingRpc(rpc.error)) throwSupabase(rpc.error)
    payload = await readTables(normalized)
  } else {
    payload = (rpc.data as OpenRoomSnapshotPayload | null) ?? null
  }
  if (!payload?.room) return null
  return mapOpenRoomSnapshot(payload, user.id)
}
