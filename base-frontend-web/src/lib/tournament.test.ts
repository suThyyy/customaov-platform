import { describe, expect, it } from 'vitest'
import { getTournamentDetail, tournaments } from '../mocks'
import type { TournamentDetail } from '../api/types'
import { groupByDate, matchProgress, podium, scheduleOf, standings } from './tournament'

const detail = (slug: string) => {
  const d = getTournamentDetail(slug)
  if (!d) throw new Error(`missing ${slug}`)
  return d
}

describe('mock giải đấu (Phase 4a-b/4c)', () => {
  it('cả 8 giải đều có dữ liệu chi tiết và trạng thái nhất quán', () => {
    expect(tournaments).toHaveLength(8)
    for (const t of tournaments) {
      const d = detail(t.slug)
      if (t.status === 'open') {
        expect(d.bracket).toHaveLength(0)
        expect(t.registeredTeams).toBe(d.teamList.length)
        expect(t.registeredTeams!).toBeLessThan(t.teamCount)
      } else {
        expect(d.bracket).toHaveLength(3)
        expect(d.teamList).toHaveLength(t.teamCount)
      }
      // đã kết thúc ⇔ có nhà vô địch
      expect(!!podium(d)).toBe(t.status === 'finished')
    }
  })

  it('Hội Làng: Ngũ Hổ vô địch, Team Đỏ á quân, đứng đầu danh sách đội', () => {
    const d = detail('hoi-lang-keo-vui')
    expect(podium(d)?.champion.name).toBe('Ngũ Hổ')
    const s = standings(d)
    expect(s[0]).toMatchObject({ label: 'Vô địch' })
    expect(s[0].team.name).toBe('Ngũ Hổ')
    expect(s[1]).toMatchObject({ label: 'Á quân' })
  })

  it('Custom League #3: 2 đội vào chung kết, lịch gộp trận tranh hạng ba, không trùng chung kết', () => {
    const d = detail('custom-league-3')
    const s = standings(d)
    expect(s.filter((x) => x.label === 'Vào chung kết').map((x) => x.team.name).sort()).toEqual(['Team Alpha', 'Team Xanh'])
    const all = scheduleOf(d)
    expect(all.filter((m) => m.stage === 'Chung kết')).toHaveLength(1)
    expect(all.some((m) => m.stage === 'Tranh hạng ba')).toBe(true)
    expect(matchProgress(d)).toEqual({ played: 6, total: 8 })
  })
})

describe('nhánh đấu nguồn API (BYE / TBD / chưa xếp lịch)', () => {
  const t = (id: string) => ({ id, name: id, logo: '' })
  const ph = (id: string, placeholder: 'bye' | 'tbd') => ({ team: t(id), score: null, placeholder })
  const d: TournamentDetail = {
    ...detail('custom-league-3'),
    teamCount: 4,
    teamList: [t('A'), t('B'), t('C')],
    upcoming: [],
    bracket: [
      {
        name: 'Bán kết',
        matches: [
          { id: 'm1', label: 'Trận 1', time: 'Chưa xếp lịch', slots: [{ team: t('A'), score: null }, { team: t('B'), score: null }] },
          { id: 'm2', label: 'Trận 2', time: 'Chưa xếp lịch', slots: [{ team: t('C'), score: null }, ph('m2-b', 'bye')] },
        ],
      },
      {
        name: 'Chung kết',
        matches: [{ id: 'm3', label: 'Chung kết', time: '20/11 19:00', slots: [ph('m3-a', 'tbd'), { team: t('C'), score: null }] }],
      },
    ],
  }

  it('lịch bỏ trận BYE / thiếu đội; nhóm "Chưa xếp lịch" nằm cuối', () => {
    expect(scheduleOf(d).map((m) => m.id)).toEqual(['m1'])
    const withDated = { ...d, upcoming: [{ id: 'x', stage: 'X', time: '19/11 19:00', home: t('A'), away: t('C') }] }
    expect(scheduleOf(withDated).map((m) => m.id)).toEqual(['x', 'm1'])
    expect(groupByDate(scheduleOf(withDated)).map((g) => g.date)).toEqual(['19/11', 'Chưa xếp lịch'])
  })

  it('tiến độ đếm trận thật (n − 1), đội có BYE không bị coi là đang thi đấu ở vòng BYE', () => {
    expect(matchProgress(d)).toEqual({ played: 0, total: 2 })
    expect(standings(d).find((s) => s.team.id === 'C')?.label).toBe('Vào chung kết')
  })
})
