import { describe, expect, it } from 'vitest'
import { RoomDetailSchema, TournamentDetailSchema, TournamentSummarySchema, UserProfileSchema } from '@customaov/contracts'
import { mapProfile, mapRoom, mapTournament, mapTournamentDetail } from './map'

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

  it('slot BYE / TBD của nhánh đấu được đánh dấu placeholder; giữ series, myRole, hạn ISO', () => {
    const base = {
      slug: 'giai-mau', name: 'Giải mẫu', titleIcon: 'trophy', cover: '/tour.jpg', status: 'live',
      format: '5v5', organizer: 'CustomAOV', description: 'Mô tả', teamCount: 4,
      registrationDeadline: '2026-11-10T23:59:00+07:00',
      dateStart: '2026-11-12T12:00:00+07:00', dateEnd: '2026-11-20T12:00:00+07:00',
      createdAt: '2026-11-01T12:00:00+07:00', timeLabel: 'Thời gian: 12/11 – 20/11', dateRange: '12/11 – 20/11',
    }
    const team = { id: '00000000-0000-4000-8000-000000000011', name: 'Đội A', logo: '' }
    const matchId = '00000000-0000-4000-8000-000000000021'
    const detail = TournamentDetailSchema.parse({
      ...base, title: 'Giải mẫu', intro: [], mode: '5v5', category: 'Cộng đồng', formatLabel: 'Loại trực tiếp (BO3)',
      series: 'BO3', heroImage: '/tour.jpg', rules: [], prizes: [], teamList: [team],
      bracket: [{ name: 'Bán kết', matches: [{ id: matchId, label: 'Trận 1', time: 'Chưa xếp lịch', slots: [
        { team, score: null, bye: false }, { team: null, score: null, bye: true },
      ] }, { id: '00000000-0000-4000-8000-000000000022', label: 'Trận 2', time: 'Chưa xếp lịch', slots: [
        { team: null, score: null, bye: false }, { team, score: null, bye: false },
      ] }] }],
      upcoming: [], results: [], champion: null, myRole: 'organizer', myRegistration: null,
    })

    const mapped = mapTournamentDetail(detail)
    const [bye, tbd] = mapped.bracket[0].matches
    expect(bye.slots[0]).toEqual({ team, score: null })
    expect(bye.slots[1]).toMatchObject({ placeholder: 'bye', team: { name: 'BYE' }, score: null })
    expect(tbd.slots[0]).toMatchObject({ placeholder: 'tbd', team: { name: 'Chưa xác định' } })
    expect(mapped).toMatchObject({
      champion: null,
      upcoming: [],
      results: [],
      series: 'BO3',
      myRole: 'organizer',
      registrationDeadlineAt: '2026-11-10T23:59:00+07:00',
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

  it('giữ nguyên trạng thái finished khi ánh xạ phòng', () => {
    const room = RoomDetailSchema.parse({
      code: 'AOV-1235', title: 'Kèo đã xong', highlight: null, thumbnail: '/room.jpg', host: user,
      mode: 'normal', modeLabel: '5v5 · Custom', visibility: 'public', playerCount: 10, capacity: 10,
      status: 'finished', isMember: false,
      config: { format: '5v5', pickMode: 'draft', series: 'BO1', tools: ['chat'], notes: '' },
      teams: { blue: [], red: [] },
      spectators: [], myRole: null, lastSplit: null, result: { winner: 'blue', at: '2026-11-15T10:00:00.000Z' },
    })

    expect(mapRoom(room).status).toBe('finished')
  })
})
