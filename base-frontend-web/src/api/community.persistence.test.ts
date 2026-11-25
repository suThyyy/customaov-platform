import { beforeEach, expect, it, vi } from 'vitest'
import { communityPersonas, seedCommunities } from '../mocks/communities'
const key = 'customaov.community-demo.v1'
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); vi.resetModules() })
it('preserves created communities when the store reloads', async () => {
  const { communityService } = await import('./community')
  const id = communityService.create(communityPersonas[1], { name: 'Đội kiểm thử', description: 'Cộng đồng mới', rules: 'Tôn trọng nhau', private: true })
  vi.resetModules()
  const reloaded = await import('./community')
  expect(reloaded.communityService.snapshot().find(c => c.id === id)?.owner).toBe('owner')
})
it('migrates existing session data without discarding memberships', async () => {
  const data = seedCommunities()
  data[0].name = 'Dữ liệu phiên đang có'
  sessionStorage.setItem(key, JSON.stringify(data))
  const { communityService } = await import('./community')
  expect(communityService.snapshot()[0].name).toBe(data[0].name)
  expect(JSON.parse(localStorage.getItem(key)!)[0].members).toEqual(data[0].members)
})
