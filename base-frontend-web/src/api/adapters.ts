import type { DataAdapter } from './adapter'
import { httpAdapter } from './http'
import { mockAdapter } from './mock'
import { sourceOf, type Feature } from './sources'
import { supabaseAdapter } from './supabase'
import { DATA_SOURCE } from './source'

const adapterFor = <K extends Feature>(feature: K): DataAdapter[K] => {
  const source = sourceOf(feature)
  if (source === 'invalid') return new Proxy({} as DataAdapter[K], {
    get: () => { throw new Error('Cần cấu hình VITE_DATA_SOURCE=mock, api hoặc supabase.') },
  })
  if (source === 'api') return httpAdapter[feature]
  if (source === 'supabase') return supabaseAdapter[feature as keyof typeof supabaseAdapter] as DataAdapter[K]
  const adapter = mockAdapter[feature]
  if (DATA_SOURCE === 'supabase' && feature === 'search') return {
    ...mockAdapter.search, showsSampleBadge: true,
    initial: () => ({ rooms: [], tournaments: [], players: [] }),
    search: async () => ({ rooms: [], tournaments: [], players: [] }),
  } as unknown as DataAdapter[K]
  return (DATA_SOURCE === 'supabase' ? { ...adapter, showsSampleBadge: true } : adapter) as DataAdapter[K]
}

export const authAdapter = adapterFor('auth')
export const profileAdapter = adapterFor('profile')
export const roomsAdapter = adapterFor('rooms')
export const chatAdapter = adapterFor('chat')
export const tournamentsAdapter = adapterFor('tournaments')
export const registrationsAdapter = adapterFor('registrations')
export const activitiesAdapter = adapterFor('activities')
export const searchAdapter = adapterFor('search')
