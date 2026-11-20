export interface ProfileRow {
  id: string
  role: 'player' | 'organizer' | 'admin'
  display_name: string | null
  avatar_url: string | null
  bio: string | null
  created_at: string
}

export interface GameProfileRow {
  id: string
  user_id: string
  ingame_name: string
  game_uid: string | null
  current_tier: string | null
  current_rank: string | null
  main_roles: string[]
  system_mmr: number
  uid_changed_at?: string | null
  uid_change_available_at?: string | null
  created_at: string
}

export interface OpenRoomRow {
  room_name?: string | null
  best_of?: 3 | 5 | 7 | null
  visibility?: 'public' | 'private'
  play_style?: 'fun' | 'tryhard' | null
  allocation_mode?: 'random' | 'tier' | 'rank' | null
  id: string
  host_user_id: string
  invite_code: string
  status: 'open' | 'closed'
  current_round_no: number
  current_round_state: 'idle' | 'preparing' | 'active' | 'ended'
  version: number
  created_at: string
  closed_at: string | null
}

export interface OpenRoomMemberRow {
  id: string
  room_id: string
  user_id: string | null
  member_kind: 'account' | 'guest'
  display_name: string
  status: 'active' | 'left' | 'kicked'
  joined_at: string
  left_at: string | null
}

export interface QueueEntryRow {
  id: string
  room_id: string
  member_id: string
  queue_seq: number
  status: 'waiting' | 'selected' | 'played' | 'removed'
  joined_at: string
  selected_round_no: number | null
}

export interface CurrentPlayerRow {
  room_id: string
  round_no: number
  member_id: string
  queue_entry_id: string
  slot: number
  ready_state: 'pending' | 'ready' | 'not_ready'
  team: 'a' | 'b' | null
  skill_mode: 'random' | 'tier' | 'rank' | null
  skill_value: string | null
  skill_score: number | null
}

export interface OpenRoomSnapshotPayload {
  room: OpenRoomRow
  members: OpenRoomMemberRow[]
  queue: QueueEntryRow[]
  currentPlayers: CurrentPlayerRow[]
}

export interface OpenRoomParticipant {
  memberId: string
  displayName: string
  queueSeq: number
  queueStatus: QueueEntryRow['status']
  slot?: number
  team?: CurrentPlayerRow['team']
  readyState?: CurrentPlayerRow['ready_state']
  skillMode?: CurrentPlayerRow['skill_mode']
  skillValue?: CurrentPlayerRow['skill_value']
  skillScore?: CurrentPlayerRow['skill_score']
}

export interface OpenRoomSnapshot {
  seriesState?: import('./series').SeriesState
  room: OpenRoomRow
  members: OpenRoomMemberRow[]
  waiting: OpenRoomParticipant[]
  selected: OpenRoomParticipant[]
  version: number
  viewer: { isHost: boolean; isMember: boolean }
}
