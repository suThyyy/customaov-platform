import { DEFAULT_TIER_SCORES, splitTeams5v5, type TeamSplitMode, type RandomSource } from '@customaov/team-core'

// Exact default RANK_CATALOG from the reference script.js; these are declared weights, not MMR.
export const RANK_CATALOG = [
  ['dong-iii','Đồng III',1],['dong-ii','Đồng II',2],['dong-i','Đồng I',3],
  ['bac-iii','Bạc III',4],['bac-ii','Bạc II',5],['bac-i','Bạc I',6],
  ['vang-iv','Vàng IV',7],['vang-iii','Vàng III',8],['vang-ii','Vàng II',9],['vang-i','Vàng I',10],
  ['bach-kim-v','Bạch Kim V',11],['bach-kim-iv','Bạch Kim IV',12],['bach-kim-iii','Bạch Kim III',13],['bach-kim-ii','Bạch Kim II',14],['bach-kim-i','Bạch Kim I',15],
  ['kim-cuong-v','Kim Cương V',16],['kim-cuong-iv','Kim Cương IV',17],['kim-cuong-iii','Kim Cương III',18],['kim-cuong-ii','Kim Cương II',19],['kim-cuong-i','Kim Cương I',20],
  ['tinh-anh-v','Tinh Anh V',21],['tinh-anh-iv','Tinh Anh IV',22],['tinh-anh-iii','Tinh Anh III',23],['tinh-anh-ii','Tinh Anh II',24],['tinh-anh-i','Tinh Anh I',25],
  ['cao-thu','Cao Thủ',28],['dai-cao-thu-iv','Đại Cao Thủ IV',30],['dai-cao-thu-iii','Đại Cao Thủ III',32],['dai-cao-thu-ii','Đại Cao Thủ II',34],['dai-cao-thu-i','Đại Cao Thủ I',36],['chien-tuong','Chiến Tướng',40],['chien-than','Chiến Thần',45],
] as const
export interface QuickPlayer { id: string; name: string; tier: string; rank: string }
export const emptyPlayers = (): QuickPlayer[] => Array.from({ length: 10 }, (_, i) => ({ id: `quick-${i + 1}`, name: '', tier: '', rank: '' }))
export const cleanName = (name: string) => name.normalize('NFC').trim().replace(/\s+/gu, ' ')
export const MODE_LABEL = { random: 'Ngẫu nhiên', tier: 'Theo Tier', rank: 'Theo Rank' }
export function validate(players: QuickPlayer[], mode: TeamSplitMode): string[] {
  const names = players.map(p => cleanName(p.name).toLocaleLowerCase('vi'))
  return players.map((p, i) => !names[i] ? 'Nhập tên người chơi.' : names.filter(n => n === names[i]).length > 1 ? 'Tên người chơi bị trùng.' : mode === 'tier' && !['1','2','3','4','5'].includes(p.tier) ? 'Chọn Tier.' : mode === 'rank' && !RANK_CATALOG.some(r => r[0] === p.rank) ? 'Chọn Rank.' : '')
}
export function score(p: QuickPlayer, mode: TeamSplitMode): number {
  return mode === 'tier' ? Number(DEFAULT_TIER_SCORES[p.tier]) : mode === 'rank' ? RANK_CATALOG.find(r => r[0] === p.rank)?.[2] ?? 0 : 0
}
export function generate(players: QuickPlayer[], mode: TeamSplitMode, random?: RandomSource) {
  if (players.length !== 10 || validate(players, mode).some(Boolean)) throw new Error('Cần đủ 10 người chơi hợp lệ.')
  const entries = players.map(p => ({ ...p, name: cleanName(p.name) }))
  return splitTeams5v5(entries, mode === 'random' ? { mode, random } : { mode, random, balanceLevel: '60-40', scores: Object.fromEntries(entries.map(p => [p.id, score(p, mode)])), getScoreKey: p => p.id })
}
export type QuickResult = ReturnType<typeof generate>
export function swap(result: QuickResult, blue: string, red: string): QuickResult {
  const a = result.teamA.find(p => p.id === blue), b = result.teamB.find(p => p.id === red)
  if (!a || !b) throw new Error('Chọn một người ở mỗi đội.')
  return { ...result, teamA: result.teamA.map(p => p.id === blue ? b : p), teamB: result.teamB.map(p => p.id === red ? a : p) }
}
export function shareText(result: QuickResult, manual: boolean): string {
  return [`CustomAOV · ${MODE_LABEL[result.mode]}${manual ? ' · Đã điều chỉnh thủ công' : ''}`, 'Đội Xanh', ...result.teamA.map((p,i) => `${i+1}. ${p.name}`), '', 'Đội Đỏ', ...result.teamB.map((p,i) => `${i+1}. ${p.name}`)].join('\n')
}
