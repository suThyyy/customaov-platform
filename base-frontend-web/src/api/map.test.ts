import { describe, expect, it } from 'vitest'
import { RoomDetailSchema, TournamentSummarySchema, UserProfileSchema } from '@customaov/contracts'
import { mapProfile, mapRoom, mapTournament } from './map'

const user = {
  id: '00000000-0000-4000-8000-000000000001',
  username: 'host_1',
  displayName: 'Chủ phòng',
  avatarUrl: 'https://example.com/avatar.png',
  level: 12,
  crowned: true,
}

describe('contract → UI maps', () => {
  it('ánh xạ một phòng mẫu', () => {
    const room = RoomDetailSchema.parse({
      code: 'AOV-1234', title: 'Kèo tối', highlight: 'BO3', thumbnail: '/room.jpg', host: user,
      mode: 'normal', modeLabel: '5v5 · Custom', visibility: 'public', playerCount: 1, capacity: 10,
      status: 'waiting', isMember: true,
      config: { format: '5v5', pickMode: 'draft', series: 'BO3', tools: ['chat'], notes: '' },
      teams: { blue: [{ user, lane: 'MID', ready: true, captain: true, tier: 4 }], red: [] },
      spectators: [], myRole: 'host', lastSplit: null, result: null,
    })

    expect(mapRoom(room)).toMatchObject({
      id: 'AOV-1234', title: 'Kèo tối', highlight: 'BO3', status: 'waiting',
      host: { id: 'host_1', name: 'Chủ phòng' },
      teams: { blue: [{ player: { tier: 4 }, lane: 'MID', captain: true }], red: [] },
    })
  })

  it('ánh xạ một giải mẫu', () => {
    const tournament = TournamentSummarySchema.parse({
      slug: 'giai-mau', name: 'Giải mẫu', titleIcon: 'trophy', cover: '/tour.jpg', status: 'open',
      format: '5v5', organizer: 'CustomAOV', description: 'Mô tả', teamCount: 8, registeredTeams: 3,
      registrationDeadline: '2026-11-20T23:59:00+07:00', drawDate: '2026-11-21T12:00:00+07:00',
      dateStart: '2026-11-22T12:00:00+07:00', dateEnd: '2026-11-27T12:00:00+07:00',
      createdAt: '2026-11-15T12:00:00+07:00', timeLabel: 'Hạn đăng ký: 20/11, 23:59', dateRange: '22/11 – 27/11',
    })

    expect(mapTournament(tournament)).toMatchObject({
      slug: 'giai-mau', status: 'open', teamCount: 8, registeredTeams: 3,
      groupStage: 'not-started', timeLabel: 'Hạn đăng ký: 20/11, 23:59',
    })
  })

  it('giữ số liệu và lịch sử hồ sơ API, đánh dấu dữ liệu game chưa có', () => {
    const value = UserProfileSchema.parse({
      user,
      uid: '102394',
      bio: 'Custom vui là chính',
      bioExtra: 'Tìm đồng đội',
      roleBadge: 'Chủ phòng',
      playerBadge: 'Người chơi Custom',
      stats: { customMatches: 12, wins: 8, losses: 4, winRate: 66.7, tournamentsJoined: 3, titles: 1 },
      achievements: [],
      history: [{
        id: '00000000-0000-4000-8000-000000000002',
        roomCode: 'AOV-1024',
        roomTitle: 'Phòng mẫu',
        winner: 'blue',
        result: 'win',
        at: '2026-11-15T10:00:00.000Z',
      }],
    })

    expect(mapProfile(value)).toMatchObject({
      stats: { customMatches: 12, wins: 8, losses: 4, winRate: 66.7, tournamentsJoined: 3, titles: 1 },
      hasGameData: false,
      champions: [],
      roles: [],
      history: [],
      recordHistory: [{ roomCode: 'AOV-1024', roomName: 'Phòng mẫu', result: 'win' }],
    })
  })
})
