import { describe, it, expect } from 'vitest'
import { splitTeams5v5 } from '@customaov/team-core'
import { cleanName, emptyPlayers, generate, RANK_CATALOG, score, shareText, swap, validate, type QuickPlayer } from './model'
const roster = (): QuickPlayer[] => emptyPlayers().map((p,i) => ({ ...p, name: `Người ${i}`, tier: String(i%5+1), rank: RANK_CATALOG[i][0] }))
describe('Quick Team core integration', () => {
  it('normalizes whitespace, Unicode and case for duplicate validation', () => {
    const p = roster(); p[0].name = '  MỸ   Anh '; p[1].name = 'mỹ anh'
    expect(cleanName(p[0].name)).toBe('MỸ Anh'); expect(validate(p,'random').filter(Boolean)).toHaveLength(2)
    expect(validate(emptyPlayers(),'random').every(Boolean)).toBe(true)
  })
  it.each(['random','tier','rank'] as const)('delegates %s with deterministic parity and stable identities', mode => {
    const p = roster(), rng = () => 0.25
    const actual = generate(p,mode,rng)
    const expected = splitTeams5v5(p,mode === 'random' ? { mode, random:rng } : { mode, random:rng, balanceLevel:'60-40', scores:Object.fromEntries(p.map(x => [x.id,score(x,mode)])),getScoreKey:x=>x.id })
    expect(actual).toEqual(expected); expect(actual.teamA).toHaveLength(5); expect(actual.teamB).toHaveLength(5)
    expect(new Set([...actual.teamA,...actual.teamB].map(x=>x.id)).size).toBe(10)
    expect(p).toEqual(roster())
  })
  it('rejects wrong counts, duplicate ids, missing attributes and unsupported ranks', () => {
    expect(()=>generate(roster().slice(1),'random')).toThrow()
    const p=roster(); p[1].id=p[0].id; expect(()=>generate(p,'random')).toThrow()
    p[0].tier='6'; p[0].rank='fake'; expect(validate(p,'tier')[0]).toBeTruthy(); expect(validate(p,'rank')[0]).toBeTruthy()
  })
  it('uses exact catalog endpoints and tier weights', () => {
    expect(RANK_CATALOG).toHaveLength(32); expect(score({...roster()[0],rank:'chien-than'},'rank')).toBe(45)
    expect([1,2,3,4,5].map(t=>score({...roster()[0],tier:String(t)},'tier'))).toEqual([8,4,2,1,0.5])
  })
  it('swaps across teams, preserves roster and formats manually adjusted sharing', () => {
    const result=generate(roster(),'tier',()=>0.25), a=result.teamA[0], b=result.teamB[0]
    const next=swap(result,a.id,b.id)
    expect(next.teamA[0]).toEqual(b); expect(next.teamB[0]).toEqual(a)
    expect(()=>swap(result,a.id,result.teamA[1].id)).toThrow()
    expect(shareText(next,true)).toContain('Đã điều chỉnh thủ công')
    expect(shareText(next,true)).toContain('Đội Đỏ')
  })
})
