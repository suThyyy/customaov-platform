/**
 * Team Reveal — kế hoạch trình diễn THUẦN (HUY-23).
 *
 * Mọi hàm ở đây chỉ đọc đội hình/phân công đã được server lưu (authoritative) và sắp xếp cách
 * trình diễn. Không hàm nào được quyết định đội, slot, tướng hay đường; không dùng Math.random
 * để kết quả hiển thị và dải "mồi" của reel giống hệt nhau ở mọi client và mỗi lần render.
 */
export type RevealVariant = 'roulette' | 'meteor'
export type RevealSide = 'a' | 'b'

export interface RevealEntry {
  id: string
  team: RevealSide
  slot: number
  /** Chữ lộ diện cuối cùng (tên người chơi hoặc tên tướng). */
  primary: string
  /** Chú thích phụ (Tier/Rank, "Người chơi · đường"…). */
  secondary?: string
  /** Điểm kỹ năng — chỉ dùng để xếp thứ tự meteor (yếu → mạnh). */
  score?: number
}

export interface PlannedEntry extends RevealEntry {
  /** Thứ tự xuất hiện trên toàn sân khấu (0 = đầu tiên). */
  order: number
  /** Dải chữ của reel roulette, phần tử cuối luôn là `primary`. */
  reel: string[]
}

/** Nhịp thời gian (ms) — dùng chung cho CSS (qua biến) và bộ hẹn giờ kết thúc. */
export const REVEAL_TIMING = {
  /** Roulette: cả 10 reel quay cùng lúc, reel thứ i dừng sau duration + i·stagger (máy xèng dừng lần lượt). */
  roulette: { stagger: 150, duration: 1000, settle: 700 },
  /** Meteor: thẻ thứ i bắt đầu rơi sau i·stagger, rơi trong duration rồi va chạm (settle). */
  meteor: { stagger: 200, duration: 420, settle: 800 },
} as const

const bySlot = (a: RevealEntry, b: RevealEntry) => a.slot - b.slot || a.id.localeCompare(b.id)

/** Xen kẽ Xanh/Đỏ theo slot: A1, B1, A2, B2… để hai bên lộ diện song song. */
function interleave(entries: readonly RevealEntry[]): RevealEntry[] {
  const blue = entries.filter(entry => entry.team === 'a').sort(bySlot)
  const red = entries.filter(entry => entry.team === 'b').sort(bySlot)
  const out: RevealEntry[] = []
  for (let i = 0; i < Math.max(blue.length, red.length); i += 1) {
    if (blue[i]) out.push(blue[i])
    if (red[i]) out.push(red[i])
  }
  return out
}

/**
 * Thứ tự lộ diện. Meteor với đủ điểm: điểm thấp rơi trước, mạnh nhất rơi cuối (đỉnh cảm xúc).
 * Thiếu điểm thì quay về xen kẽ theo slot.
 */
export function revealOrder(entries: readonly RevealEntry[], variant: RevealVariant): RevealEntry[] {
  const base = interleave(entries)
  if (variant !== 'meteor' || !entries.length || entries.some(entry => !Number.isFinite(entry.score))) return base
  const rank = new Map(base.map((entry, index) => [entry.id, index]))
  return [...base].sort((a, b) => (a.score as number) - (b.score as number) || rank.get(a.id)! - rank.get(b.id)!)
}

/**
 * Dải reel xác định: xoay vòng bể mồi theo vị trí, bỏ chính đáp án, người lộ diện sau quay dài
 * hơn (hiệu ứng máy xèng dừng lần lượt). Phần tử cuối luôn là đáp án authoritative.
 */
export function reelFor(target: string, pool: readonly string[], order: number): string[] {
  const decoys = [...new Set(pool)].filter(name => name !== target)
  if (!decoys.length) return [target]
  const length = Math.min(6 + order, 16)
  const strip = Array.from({ length }, (_, i) => decoys[(order * 3 + i) % decoys.length])
  return [...strip, target]
}

export function planReveal(entries: readonly RevealEntry[], variant: RevealVariant, pool?: readonly string[]): PlannedEntry[] {
  const names = pool?.length ? pool : entries.map(entry => entry.primary)
  return revealOrder(entries, variant).map((entry, order) => ({ ...entry, order, reel: reelFor(entry.primary, names, order) }))
}

/** Tổng thời lượng (ms) cho `count` mục — bộ hẹn giờ dựa vào đây, không dựa vào animationend. */
export function revealDuration(variant: RevealVariant, count: number): number {
  if (count <= 0) return 0
  const timing = REVEAL_TIMING[variant]
  return (count - 1) * timing.stagger + timing.duration + timing.settle
}

/** Khoá ổn định của một lần lộ diện: cùng dữ liệu authoritative ⇒ cùng khoá ⇒ không phát lại. */
export function revealKeyOf(scope: string, entries: readonly RevealEntry[]): string | null {
  if (!entries.length) return null
  return `${scope}|${[...entries].sort(bySlot).map(entry => `${entry.id}:${entry.team}:${entry.slot}:${entry.primary}`).join(',')}`
}
