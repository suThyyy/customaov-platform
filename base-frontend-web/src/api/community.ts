import { useSyncExternalStore } from 'react'
import { changeCommunity, createCommunity, seedCommunities, type Community, type CommunityAction, type CommunityActor } from '../mocks/communities'

// Isolated demo service. No network, auth-session keys or Production writes.
let state = seedCommunities()
const STORAGE_KEY = 'customaov.community-demo.v1'
// Reference the existing canonical tournament route.
state.forEach(c => c.tournaments.forEach(t => { if (t.slug === 'ngu-kiet-cup') t.slug = 'ngu-kiet-cup-mua-1' }))
try {
  const saved = localStorage.getItem(STORAGE_KEY) ?? sessionStorage.getItem(STORAGE_KEY)
  if (saved) {
    const parsed: unknown = JSON.parse(saved)
    if (Array.isArray(parsed) && parsed.every(c => c && typeof c.id === 'string' && typeof c.name === 'string' && Array.isArray(c.members) && Array.isArray(c.requests) && Array.isArray(c.announcements) && Array.isArray(c.tournaments))) {
      state = parsed
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    }
  }
} catch { /* Restricted or corrupt session storage starts a fresh demo. */ }
const listeners = new Set<() => void>()
function publish(next: Community[]) {
  state = next
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch { /* In-memory fallback. */ }
  listeners.forEach(listener => listener())
}
export const communityService = {
  resetDemo() {
    const next = seedCommunities()
    next.forEach(c => c.tournaments.forEach(t => { if (t.slug === 'ngu-kiet-cup') t.slug = 'ngu-kiet-cup-mua-1' }))
    publish(next)
  },
  subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } },
  snapshot: () => state,
  change(id: string, actor: CommunityActor | null, action: CommunityAction) {
    const current = state.find(c => c.id === id)
    if (!current) throw new Error('Không tìm thấy cộng đồng.')
    const next = changeCommunity(current, actor, action)
    publish(state.map(c => c.id === id ? next : c))
  },
  create(actor: CommunityActor | null, input: Pick<Community, 'name' | 'description' | 'rules' | 'private'>) {
    const next = createCommunity(actor, input); publish([...state, next]); return next.id
  },
}
export const useCommunities = () => useSyncExternalStore(communityService.subscribe, communityService.snapshot)
