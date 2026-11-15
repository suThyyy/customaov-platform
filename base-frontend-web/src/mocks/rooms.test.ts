import { describe, expect, it } from 'vitest'
import { rooms } from './rooms'

describe('mock rooms', () => {
  it.each(rooms.map((r) => [r.id, r] as const))('%s: playerCount khớp số người trong 2 đội', (_id, r) => {
    expect(r.playerCount).toBe(r.teams.blue.length + r.teams.red.length)
    expect(r.playerCount).toBeLessThanOrEqual(r.capacity)
  })

  it('phòng live đủ 5v5 (10/10)', () => {
    const live = rooms.filter((r) => r.status === 'live')
    expect(live.length).toBeGreaterThan(0)
    for (const r of live) {
      expect(r.teams.blue).toHaveLength(5)
      expect(r.teams.red).toHaveLength(5)
      expect(r.playerCount).toBe(10)
    }
  })

  it('không người chơi nào xuất hiện hai lần trong cùng một phòng', () => {
    for (const r of rooms) {
      const ids = [...r.teams.blue, ...r.teams.red].map((x) => x.player.id)
      expect(new Set(ids).size).toBe(ids.length)
    }
  })

  it('suthy chỉ là thành viên của AOV-1024', () => {
    const withSuthy = rooms.filter((r) => [...r.teams.blue, ...r.teams.red].some((x) => x.player.id === 'suthy'))
    expect(withSuthy.map((r) => r.id)).toEqual(['AOV-1024'])
  })
})