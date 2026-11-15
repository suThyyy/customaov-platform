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
  BracketSlot,
  ChatMessage,
  Player,
  Room,
  RoomMember,
  Tournament,
  TournamentDetail,
  UserProfile,
} from './types'
import { timeAgo } from './time'

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
  isMember: room.isMember,
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

type ApiBracketSlot = ApiTournamentDetail['bracket'][number]['matches'][number]['slots'][number]

const mapBracketSlot = (slot: ApiBracketSlot, matchId: string, side: 'a' | 'b'): BracketSlot => ({
  team: slot.team ?? {
    id: `${matchId}-${side}-${slot.bye ? 'bye' : 'tbd'}`,
    name: slot.bye ? 'BYE' : 'Chưa xác định',
    logo: '',
  },
  score: slot.score,
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
  // API.md 9.3: slot có thể chưa có đội (TBD) hoặc là BYE. Kiểu UI cũ luôn có đội,
  // nên thay bằng đội giữ chỗ để component nhánh đấu hiển thị nhãn tương ứng.
  bracket: detail.bracket.map((round) => ({
    name: round.name,
    matches: round.matches.map((match) => ({
      id: match.id,
      label: match.label,
      time: match.time,
      slots: [mapBracketSlot(match.slots[0], match.id, 'a'), mapBracketSlot(match.slots[1], match.id, 'b')],
    })),
  })),
  upcoming: detail.upcoming,
  results: detail.results,
  myRole: detail.myRole,
  myRegistration: detail.myRegistration,
})

export const mapActivity = (activity: ApiActivity, now: number = Date.now()): Activity => ({
  id: activity.id,
  kind: activity.kind,
  text: activity.text,
  emphasis: activity.emphasis,
  timeAgo: timeAgo(activity.at, now),
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
    wins: value.stats.wins,
    losses: value.stats.losses,
    tournamentsJoined: value.stats.tournamentsJoined,
    titles: value.stats.titles,
  },
  champions: [],
  roles: [],
  history: [],
  recordHistory: value.history.map((item) => ({
    id: item.id,
    roomCode: item.roomCode,
    roomName: item.roomTitle,
    result: item.result,
    timeAgo: new Intl.RelativeTimeFormat('vi', { numeric: 'auto' }).format(
      Math.round((Date.parse(item.at) - Date.now()) / 60_000),
      'minute',
    ),
  })),
  hasGameData: false,
})
