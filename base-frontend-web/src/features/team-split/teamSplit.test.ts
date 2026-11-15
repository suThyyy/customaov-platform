import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_BALANCE_LEVEL, DEFAULT_TIER_SCORES, splitTeams5v5 } from '@customaov/team-core'
import type { Player, RoomMember } from '../../mocks/types'
import { splitRoomMembers, teamSplitErrorMessage } from './teamSplit'

vi.mock('@customaov/team-core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@customaov/team-core')>()
  return { ...actual, splitTeams5v5: vi.fn(actual.splitTeams5v5) }
})

const LANES = ['TOP', 'JG', 'MID', 'AD', 'SP'] as const

function member(id: string, extra: Partial<Player> = {}, i = 0): RoomMember {
  return {
    player: { id, name: `Player ${id}`, avatar: `/a/${id}.png`, ...extra },
    lane: LANES[i % LANES.length],
    ready: i % 2 === 0,
    captain: i === 0,
  }
}

function tenMembers(extra: (i: number) => Partial<Player> = () => ({})): RoomMember[] {
  return Array.from({ length: 10 }, (_, i) => member(`p${i + 1}`, extra(i), i))
}

function idsOf(list: readonly RoomMember[]): string[] {
  return list.map((m) => m.player.id)
}

beforeEach(() => {
  vi.mocked(splitTeams5v5).mockClear()
})

describe('splitRoomMembers', () => {
  it('random mode: gọi core không kèm score, trả 5v5, giữ nguyên object thành viên', () => {
    const members = tenMembers()
    const outcome = splitRoomMembers(members, { mode: 'random' })

    expect(splitTeams5v5).toHaveBeenCalledTimes(1)
    const [input, options] = vi.mocked(splitTeams5v5).mock.calls[0]
    expect(input.map((e) => e.id)).toEqual(idsOf(members))
    expect(options.mode).toBe('random')
    expect(options).not.toHaveProperty('scores')

    if (!outcome.ok) throw new Error('expected ok outcome')
    expect(outcome.mode).toBe('random')
    expect(outcome.warning).toBe(false)
    expect(outcome.teams.blue).toHaveLength(5)
    expect(outcome.teams.red).toHaveLength(5)

    const all = [...outcome.teams.blue, ...outcome.teams.red]
    expect(new Set(idsOf(all)).size).toBe(10)
    expect([...idsOf(all)].sort()).toEqual([...idsOf(members)].sort())
    // cùng tham chiếu → lane/ready/captain/avatar... không bị mất
    for (const m of all) expect(members).toContain(m)
  })

  it('tier mode: dùng DEFAULT_TIER_SCORES, DEFAULT_BALANCE_LEVEL và player.tier làm key', () => {
    const members = tenMembers((i) => ({ tier: (i % 5) + 1 }))
    const outcome = splitRoomMembers(members, { mode: 'tier' })

    const [input, options] = vi.mocked(splitTeams5v5).mock.calls[0]
    if (options.mode === 'random') throw new Error('expected balanced options')
    expect(options.mode).toBe('tier')
    expect(options.scores).toBe(DEFAULT_TIER_SCORES)
    expect(options.balanceLevel).toBe(DEFAULT_BALANCE_LEVEL)
    expect(input.map((e) => options.getScoreKey(e))).toEqual(members.map((m) => m.player.tier))

    if (!outcome.ok) throw new Error('expected ok outcome')
    expect(outcome.mode).toBe('tier')
    expect(outcome.teams.blue).toHaveLength(5)
    expect(outcome.teams.red).toHaveLength(5)
  })

  it('tier mode thiếu dữ liệu tier → MISSING_SCORE, không tự gán điểm', () => {
    const outcome = splitRoomMembers(tenMembers(), { mode: 'tier' })
    expect(outcome).toEqual({ ok: false, code: 'MISSING_SCORE', message: teamSplitErrorMessage('MISSING_SCORE') })
  })

  it('rank mode: dùng bảng điểm Rank do caller truyền và player.rankTier làm key', () => {
    const rankScores = { A: 3, B: 2, C: 1 }
    const members = tenMembers((i) => ({ rankTier: ['A', 'B', 'C'][i % 3] }))
    const outcome = splitRoomMembers(members, { mode: 'rank', scores: rankScores, balanceLevel: '50-50' })

    const [, options] = vi.mocked(splitTeams5v5).mock.calls[0]
    if (options.mode === 'random') throw new Error('expected balanced options')
    expect(options.mode).toBe('rank')
    expect(options.scores).toBe(rankScores)
    expect(options.balanceLevel).toBe('50-50')
    expect(outcome.ok && outcome.mode).toBe('rank')
  })

  it('thiếu người → INVALID_PLAYER_COUNT với thông báo tiếng Việt', () => {
    const outcome = splitRoomMembers(tenMembers().slice(0, 7), { mode: 'random' })
    expect(outcome).toEqual({
      ok: false,
      code: 'INVALID_PLAYER_COUNT',
      message: 'Cần đúng 10 người chơi để chia đội 5v5 (hiện có 7).',
    })
  })

  it('trùng ID → DUPLICATE_PLAYER_ID với thông báo tiếng Việt, không lộ ID/stack', () => {
    const members = tenMembers()
    members[9] = member('p1', {}, 9)
    const outcome = splitRoomMembers(members, { mode: 'random' })
    if (outcome.ok) throw new Error('expected error outcome')
    expect(outcome.code).toBe('DUPLICATE_PLAYER_ID')
    expect(outcome.message).toBe(teamSplitErrorMessage('DUPLICATE_PLAYER_ID'))
    expect(outcome.message).not.toMatch(/p1|Duplicate|Error/)
  })

  it('lỗi không phải TeamCoreError được ném tiếp', () => {
    const boom = new Error('unexpected')
    vi.mocked(splitTeams5v5).mockImplementationOnce(() => {
      throw boom
    })
    expect(() => splitRoomMembers(tenMembers(), { mode: 'random' })).toThrow(boom)
  })
})
