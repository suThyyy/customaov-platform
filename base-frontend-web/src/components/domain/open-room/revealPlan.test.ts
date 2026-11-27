import { describe, expect, it } from 'vitest'
import { planReveal, reelFor, revealDuration, revealKeyOf, revealOrder, REVEAL_TIMING, type RevealEntry } from './revealPlan'

const lineup: RevealEntry[] = Array.from({ length: 10 }, (_, i) => ({
  id: `m${i}`, team: i < 5 ? 'a' : 'b', slot: (i % 5) + 1, primary: `Player ${i}`, score: [8, 1, 4, 2, 0.5, 4, 8, 1, 2, 0.5][i],
}))

describe('revealPlan (presentation only)', () => {
  it('interleaves Blue/Red by slot for roulette', () => {
    expect(revealOrder(lineup, 'roulette').map(entry => entry.id)).toEqual(['m0', 'm5', 'm1', 'm6', 'm2', 'm7', 'm3', 'm8', 'm4', 'm9'])
  })
  it('orders meteor weakest → strongest with stable ties, and falls back without scores', () => {
    const order = revealOrder(lineup, 'meteor').map(entry => entry.score)
    expect(order).toEqual([...order].sort((a, b) => a! - b!))
    // Hai người cùng 8 điểm (mạnh nhất) rơi cuối, hoà điểm giữ thứ tự xen kẽ Xanh/Đỏ.
    expect(revealOrder(lineup, 'meteor').slice(-2).map(entry => entry.id)).toEqual(['m0', 'm6'])
    const noScore = lineup.map(entry => ({ ...entry, score: undefined }))
    expect(revealOrder(noScore, 'meteor').map(entry => entry.id)).toEqual(revealOrder(lineup, 'roulette').map(entry => entry.id))
  })
  it('never changes team, slot or the authoritative label', () => {
    for (const variant of ['roulette', 'meteor'] as const) {
      const plan = planReveal(lineup, variant)
      expect(plan).toHaveLength(10)
      for (const entry of plan) {
        const source = lineup.find(item => item.id === entry.id)!
        expect([entry.team, entry.slot, entry.primary]).toEqual([source.team, source.slot, source.primary])
        expect(entry.reel.at(-1)).toBe(source.primary)
      }
    }
  })
  it('builds deterministic reels (no reroll on re-render) that spin longer for later slots', () => {
    const pool = ['Krixi', 'Valhein', 'Violet', 'Nakroth']
    expect(reelFor('Violet', pool, 2)).toEqual(reelFor('Violet', pool, 2))
    expect(reelFor('Violet', pool, 2).slice(0, -1)).not.toContain('Violet')
    expect(reelFor('Violet', pool, 5).length).toBeGreaterThan(reelFor('Violet', pool, 0).length)
    expect(reelFor('Solo', ['Solo'], 3)).toEqual(['Solo'])
  })
  it('computes total duration from shared timing tokens', () => {
    const { stagger, duration, settle } = REVEAL_TIMING.roulette
    expect(revealDuration('roulette', 10)).toBe(9 * stagger + duration + settle)
    expect(revealDuration('meteor', 0)).toBe(0)
  })
  it('keys on authoritative data only, independent of input order', () => {
    expect(revealKeyOf('s', [...lineup].reverse())).toBe(revealKeyOf('s', lineup))
    expect(revealKeyOf('s', lineup.map(entry => entry.id === 'm0' ? { ...entry, team: 'b' as const } : entry))).not.toBe(revealKeyOf('s', lineup))
    expect(revealKeyOf('s', [])).toBeNull()
  })
})
