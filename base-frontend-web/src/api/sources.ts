import { DATA_SOURCE } from './source'

export type Source = 'mock' | 'api' | 'supabase' | 'invalid'
export type Feature = 'auth' | 'profile' | 'rooms' | 'chat' | 'tournaments' | 'registrations' | 'activities' | 'search'

export const SUPABASE_FEATURE_SOURCES: Record<Feature, Source> = {
  auth: 'supabase',
  profile: 'supabase',
  rooms: 'supabase',
  chat: 'mock',
  tournaments: 'mock',
  registrations: 'mock',
  activities: 'mock',
  search: 'mock',
}

export const FEATURE_SOURCES: Record<Feature, Source> = DATA_SOURCE === 'supabase'
  ? SUPABASE_FEATURE_SOURCES
  : {
      auth: DATA_SOURCE,
      profile: DATA_SOURCE,
      rooms: DATA_SOURCE,
      chat: DATA_SOURCE,
      tournaments: DATA_SOURCE,
      registrations: DATA_SOURCE,
      activities: DATA_SOURCE,
      search: DATA_SOURCE,
    }

export const sourceOf = (feature: Feature): Source => FEATURE_SOURCES[feature]
