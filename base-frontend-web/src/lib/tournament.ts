import { UNSCHEDULED_LABEL, type BracketMatch, type ScheduledMatch, type Team, type TournamentDetail } from '../api/types'

/** Trận có slot BYE (nguồn API): tự xong, không tính là trận đấu */
export const isByeMatch = (match: BracketMatch): boolean => match.slots.some((s) => s.placeholder === 'bye')

/** Trận đủ 2 đội thật (không BYE, không "Chưa xác định") */
export const isReadyMatch = (match: BracketMatch): boolean => match.slots.every((s) => !s.placeholder)

/** Giờ dạng "dd/mm HH:mm"; nhãn khác (vd. "Chưa xếp lịch") = chưa có giờ */
export const isScheduled = (time: string): boolean => /^\d{2}\/\d{2}\b/.test(time)

const allMatches = (detail: TournamentDetail): ScheduledMatch[] =>
  detail.bracket.flatMap((round) =>
    round.matches.filter(isReadyMatch).map((match) => {
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

/** "13/11 19:00" → khoá sắp xếp "11-13 19:00" (mock cùng năm 2026). Trận chưa xếp lịch xếp cuối. */
const sortKey = (time: string): string => {
  // localeCompare bỏ qua dấu câu (vd. "~") nên dùng khoá số lớn hơn mọi "mm-dd"
  if (!isScheduled(time)) return '99-99'
  const [date = '', clock = ''] = time.split(' ')
  const [d = '00', m = '00'] = date.split('/')
  return `${m}-${d} ${clock}`
}

/** Ngày "dd/mm" của trận; trận chưa có giờ trả về nhãn "Chưa xếp lịch" */
export const matchDate = (time: string): string => (isScheduled(time) ? (time.split(' ')[0] ?? time) : UNSCHEDULED_LABEL)

/** Giờ "HH:mm" của trận; trận chưa có giờ trả về nhãn "Chưa xếp lịch" */
export const matchClock = (time: string): string => (isScheduled(time) ? (time.split(' ')[1] ?? time) : UNSCHEDULED_LABEL)

/** Các trận đủ 2 đội trong nhánh đấu, theo thứ tự nhánh (BTC nhập tỉ số / xếp lịch) */
export const readyMatches = (d: TournamentDetail): ScheduledMatch[] => allMatches(d)

/** Đã có trận nào được nhập tỉ số chưa (bốc lại chỉ khi chưa có) */
export const hasScoredMatch = (d: TournamentDetail): boolean => allMatches(d).some((m) => m.score)

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
        if (isByeMatch(m)) continue
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
  const matches = d.bracket.flatMap((round) => round.matches)
  // Nhánh có BYE (API, số đội < số chỗ): đếm trận thật trong nhánh thay vì teamCount − 1
  const knockout = matches.some(isByeMatch) ? matches.filter((m) => !isByeMatch(m)).length : d.teamCount - 1
  return { played: all.filter((m) => m.score).length, total: Math.max(knockout, all.length) }
}
