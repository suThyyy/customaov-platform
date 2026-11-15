import type { ScheduledMatch, Team, TournamentDetail } from '../api'

const allMatches = (detail: TournamentDetail): ScheduledMatch[] =>
  detail.bracket.flatMap((round) =>
    round.matches.map((match) => {
      const roundName = round.name.replace(/\s*\(.*\)/, '')
      return {
        id: match.id,
        stage: match.label === roundName ? roundName : `${roundName} · ${match.label}`,
        time: match.time,
        home: match.slots[0].team,
        away: match.slots[1].team,
        ...(match.slots[0].score !== null && match.slots[1].score !== null
          ? { score: [match.slots[0].score, match.slots[1].score] as [number, number] }
          : {}),
      }
    }),
  )

/** "13/11 19:00" → khoá sắp xếp "11-13 19:00" (mock cùng năm 2026) */
const sortKey = (time: string): string => {
  const [date = '', clock = ''] = time.split(' ')
  const [d = '00', m = '00'] = date.split('/')
  return `${m}-${d} ${clock}`
}

export const matchDate = (time: string): string => time.split(' ')[0] ?? time

/** Toàn bộ trận: nhánh đấu + trận ngoài nhánh (vd. tranh hạng ba), theo thời gian tăng dần, không trùng */
export function scheduleOf(d: TournamentDetail): ScheduledMatch[] {
  const list = allMatches(d)
  const same = (a: ScheduledMatch, b: ScheduledMatch) =>
    a.time === b.time && a.home.id === b.home.id && a.away.id === b.away.id
  for (const m of d.upcoming) if (!list.some((x) => same(x, m))) list.push(m)
  return list.sort((a, b) => sortKey(a.time).localeCompare(sortKey(b.time)))
}

/** Nhóm trận theo ngày "dd/mm" (giữ thứ tự) */
export function groupByDate(matches: ScheduledMatch[]): Array<{ date: string; matches: ScheduledMatch[] }> {
  const groups: Array<{ date: string; matches: ScheduledMatch[] }> = []
  for (const m of matches) {
    const date = matchDate(m.time)
    const g = groups.find((x) => x.date === date)
    if (g) g.matches.push(m)
    else groups.push({ date, matches: [m] })
  }
  return groups
}

export const winnerOf = (m: ScheduledMatch): Team | undefined =>
  m.score ? (m.score[0] > m.score[1] ? m.home : m.away) : undefined

/** Nhà vô địch + á quân (khi chung kết đã có tỉ số) */
export function podium(d: TournamentDetail): { champion: Team; runnerUp: Team } | undefined {
  const final = d.bracket[d.bracket.length - 1]?.matches[0]
  if (!final) return undefined
  const [a, b] = final.slots
  if (a.score === null || b.score === null) return undefined
  return a.score > b.score ? { champion: a.team, runnerUp: b.team } : { champion: b.team, runnerUp: a.team }
}

export type StandingTone = 'gold' | 'success' | 'neutral' | 'muted'

export interface Standing {
  team: Team
  label: string
  tone: StandingTone
  /** Thứ tự sắp xếp: nhỏ = đứng trên */
  order: number
}

/**
 * Tình trạng từng đội (tab Danh sách đội), suy ra từ nhánh đấu:
 * Vô địch / Á quân / Dừng ở bán kết / Dừng ở tứ kết / Vào chung kết / Đang thi đấu / Đã đăng ký.
 */
export function standings(d: TournamentDetail): Standing[] {
  const rounds = d.bracket
  const result = d.teamList.map((team, idx): Standing => {
    let label = 'Đã đăng ký'
    let tone: StandingTone = 'neutral'
    let order = 100 + idx
    rounds.forEach((round, r) => {
      for (const m of round.matches) {
        const slot = m.slots.findIndex((s) => s.team.id === team.id)
        if (slot < 0) continue
        const [a, b] = m.slots
        const decided = a.score !== null && b.score !== null
        const isFinal = r === rounds.length - 1
        const roundName = round.name.replace(/\s*\(.*\)/, '').toLowerCase()
        if (!decided) {
          label = isFinal ? 'Vào chung kết' : 'Đang thi đấu'
          tone = 'success'
          order = isFinal ? 2 : 10 + idx
          continue
        }
        const won = (slot === 0 ? a.score! > b.score! : b.score! > a.score!)
        if (isFinal) {
          label = won ? 'Vô địch' : 'Á quân'
          tone = won ? 'gold' : 'success'
          order = won ? 0 : 1
        } else if (!won) {
          label = `Dừng ở ${roundName}`
          tone = 'muted'
          order = 50 - r * 10 + idx / 100
        }
      }
    })
    return { team, label, tone, order }
  })
  return result.sort((x, y) => x.order - y.order)
}

/** Số trận đã đấu / tổng số trận (nhánh loại trực tiếp có teamCount − 1 trận, cộng trận ngoài nhánh như tranh hạng ba) */
export function matchProgress(d: TournamentDetail): { played: number; total: number } {
  const all = scheduleOf(d)
  return { played: all.filter((m) => m.score).length, total: Math.max(d.teamCount - 1, all.length) }
}
