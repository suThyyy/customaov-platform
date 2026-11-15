import { describe, expect, it } from 'vitest'
import { getTournamentDetail, tournaments } from '../mocks'
import { matchProgress, podium, scheduleOf, standings } from './tournament'

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
