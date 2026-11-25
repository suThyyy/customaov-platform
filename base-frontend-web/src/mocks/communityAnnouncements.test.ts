import { expect, it } from 'vitest'
import { changeCommunity, communityPersonas, seedCommunities } from './communities'
it('creates, edits and deletes an announcement by stable author identity', () => {
  const owner = communityPersonas[1]
  const created = changeCommunity(seedCommunities()[0], owner, { type: 'announce', title: 'Lịch tập' })
  const post = created.announcements[0]
  expect(post.authorId).toBe(owner.id)
  const edited = changeCommunity(created, owner, { type: 'editAnnouncement', id: post.id, title: 'Lịch tập mới' })
  expect(edited.announcements[0].title).toBe('Lịch tập mới')
  expect(changeCommunity(edited, owner, { type: 'deleteAnnouncement', id: post.id }).announcements.some(p => p.id === post.id)).toBe(false)
})
it('denies nonauthor managers, nonmembers and invalid content', () => {
  const owner = communityPersonas[1], other = communityPersonas[2]
  const created = changeCommunity(seedCommunities()[0], owner, { type: 'announce', title: 'Thông báo' })
  created.members.push({ id: other.id, name: other.name, role: 'manager' })
  const id = created.announcements[0].id
  expect(() => changeCommunity(created, other, { type: 'deleteAnnouncement', id })).toThrow()
  expect(() => changeCommunity(created, communityPersonas[0], { type: 'editAnnouncement', id, title: 'x' })).toThrow()
  expect(() => changeCommunity(created, owner, { type: 'editAnnouncement', id, title: ' ' })).toThrow()
})
