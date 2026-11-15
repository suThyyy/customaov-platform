import type {
  Activity as ApiActivity,
  ChatMessage as ApiChatMessage,
  RoomDetail as ApiRoomDetail,
  RoomMember as ApiRoomMember,
  RoomSummary as ApiRoomSummary,
  TournamentDetail as ApiTournamentDetail,
  TournamentSummary as ApiTournamentSummary,
  UserProfile as ApiUserProfile,
  UserSummary,
} from '@customaov/contracts'
import type {
  Activity,
  ChatMessage,
  Player,
  Room,
  RoomMember,
  Tournament,
  TournamentDetail,
  UserProfile,
} from './types'

const dateOnly = (value: string | undefined): string | undefined => {
  if (!value) return undefined
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit' }).format(date)
}

const dateTime = (value: string | undefined): string | undefined => {
  if (!value) return undefined
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export const mapPlayer = (user: UserSummary): Player => ({
  id: user.username,
  name: user.displayName,
  avatar: user.avatarUrl ?? '',
  level: user.level,
  crowned: user.crowned,
})

export const mapRoomMember = (member: ApiRoomMember): RoomMember => ({
  player: { ...mapPlayer(member.user), tier: member.tier ?? undefined },
  lane: member.lane ?? 'MID',
  ready: member.ready,
  captain: member.captain || undefined,
})

export const mapRoom = (room: ApiRoomSummary | ApiRoomDetail): Room => ({
  id: room.code,
  title: room.title,
  highlight: room.highlight ?? undefined,
  thumbnail: room.thumbnail,
  host: mapPlayer(room.host),
  modeLabel: room.modeLabel,
  visibility: room.visibility,
  playerCount: room.playerCount,
  capacity: room.capacity,
  status: room.status === 'finished' ? 'live' : room.status,
  teams:
    'teams' in room
      ? { blue: room.teams.blue.map(mapRoomMember), red: room.teams.red.map(mapRoomMember) }
      : { blue: [], red: [] },
})

export const mapTournament = (tournament: ApiTournamentSummary): Tournament => ({
  slug: tournament.slug,
  name: tournament.name,
  titleIcon: tournament.titleIcon,
  cover: tournament.cover,
  status: tournament.status,
  format: tournament.format,
  organizer: tournament.organizer,
  description: tournament.description,
  teamCount: tournament.teamCount,
  timeLabel: tournament.timeLabel,
  dateRange: tournament.dateRange,
  registrationDeadline: dateTime(tournament.registrationDeadline),
  registeredTeams: tournament.registeredTeams,
  drawDate: dateOnly(tournament.drawDate),
  groupStage: tournament.status === 'open' ? 'not-started' : 'finished',
  createdAt: tournament.createdAt,
})

export const mapTournamentDetail = (detail: ApiTournamentDetail): TournamentDetail => ({
  ...mapTournament(detail),
  title: detail.title,
  titleAccent: detail.titleAccent,
  intro: detail.intro,
  mode: detail.mode,
  category: detail.category,
  formatLabel: detail.formatLabel,
  heroImage: detail.heroImage,
  rules: detail.rules,
  prizes: detail.prizes,
  teamList: detail.teamList,
  bracket: detail.bracket,
  upcoming: detail.upcoming,
  results: detail.results,
})

export const mapActivity = (activity: ApiActivity): Activity => ({
  id: activity.id,
  kind: activity.kind,
  text: activity.text,
  emphasis: activity.emphasis,
  timeAgo: new Intl.RelativeTimeFormat('vi', { numeric: 'auto' }).format(
    Math.round((Date.parse(activity.at) - Date.now()) / 60_000),
    'minute',
  ),
})

export const mapChatMessage = (message: ApiChatMessage): ChatMessage => ({
  id: message.id,
  author: message.author ? mapPlayer(message.author) : { id: 'system', name: 'Hệ thống', avatar: '' },
  text: message.text,
  time: new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' }).format(new Date(message.at)),
  system: message.system,
})

export const mapProfile = (value: ApiUserProfile): UserProfile => ({
  player: mapPlayer(value.user),
  publicId: `@${value.user.username}`,
  uid: value.uid,
  achievements: value.achievements.map((item) => ({
    id: item.id,
    title: item.title,
    description: item.description,
    date: new Intl.DateTimeFormat('vi-VN').format(new Date(item.date)),
    icon: item.icon,
  })),
  roleBadge: value.roleBadge,
  playerBadge: value.playerBadge,
  bio: value.bio,
  bioExtra: value.bioExtra,
  stats: {
    totalMatches: value.stats.wins + value.stats.losses,
    winRate: value.stats.winRate,
    customMatches: value.stats.customMatches,
    mvp: 0,
  },
  champions: [],
  roles: [],
  history: [],
})
