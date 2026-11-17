import { DATA_SOURCE } from './source'

export type Source = 'mock' | 'api'
export type Feature = 'auth' | 'profile' | 'rooms' | 'chat' | 'tournaments' | 'registrations' | 'activities' | 'search'

export const FEATURE_SOURCES: Record<Feature, Source> = {
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
