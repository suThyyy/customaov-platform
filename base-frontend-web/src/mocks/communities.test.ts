import { describe, expect, it } from 'vitest'
import { canManageCommunity, changeCommunity, communityPersonas, createCommunity, seedCommunities } from './communities'

const [user, owner, other, platform] = communityPersonas
describe('Community demo business rules', () => {
  it('joins public community and updates membership count without duplicates', () => {
    const c = seedCommunities()[2]
    const next = changeCommunity(c, user, { type: 'join' })
    expect(next.members).toHaveLength(2)
    expect(c.members).toHaveLength(1)
    expect(() => changeCommunity(next, user, { type: 'join' })).toThrow()
  })
  it('private request requires approval and blocks duplicate requests', () => {
    const c = seedCommunities()[1]
    expect(() => changeCommunity(c, user, { type: 'join' })).toThrow()
    const next = changeCommunity(c, other, { type: 'review', member: user.id, approve: true })
    expect(next.members).toHaveLength(2)
    expect(next.requests).toHaveLength(0)
  })
  it('rejects requests without granting membership', () => {
    const c = changeCommunity(seedCommunities()[1], other, { type: 'review', member: user.id, approve: false })
    expect(c.requests[0].status).toBe('rejected')
    expect(c.members).toHaveLength(1)
  })
  it('leaves but protects the owner', () => {
    expect(changeCommunity(seedCommunities()[0], user, { type: 'leave' }).members).toHaveLength(1)
    expect(() => changeCommunity(seedCommunities()[0], owner, { type: 'leave' })).toThrow()
  })
  it('blocks unrelated admin, platform identity and guest mutations', () => {
    const c = seedCommunities()[0]
    expect(canManageCommunity(c, other)).toBe(false)
    expect(canManageCommunity(c, platform)).toBe(false)
    expect(() => changeCommunity(c, other, { type: 'announce', title: 'x' })).toThrow()
    expect(() => changeCommunity(c, null, { type: 'join' })).toThrow()
  })
  it('creates, edits and announces under owner permissions', () => {
    const c = createCommunity(owner, { name: 'Đội mới', description: 'Mô tả', rules: 'Nội quy', private: false })
    const edit = changeCommunity(c, owner, { type: 'edit', name: 'Tên mới', description: 'Mô tả mới', rules: 'Nội quy', private: true })
    expect(edit.name).toBe('Tên mới')
    expect(changeCommunity(edit, owner, { type: 'announce', title: 'Lịch tập' }).announcements).toHaveLength(1)
    expect(() => createCommunity(user, edit)).toThrow()
  })
  it('restricts role changes and keeps tournament reference stable', () => {
    const c = seedCommunities()[0]
    const promoted = changeCommunity(c, owner, { type: 'promote', member: user.id })
    expect(canManageCommunity(promoted, user)).toBe(false)
    expect(canManageCommunity(promoted, { ...user, role: 'admin' })).toBe(true)
    expect(() => changeCommunity(promoted, user, { type: 'remove', member: owner.id })).toThrow()
    expect(promoted.tournaments).toEqual(c.tournaments)
  })
})
