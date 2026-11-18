import { describe, expect, it } from 'vitest'
import { FEATURE_SOURCES, sourceOf, SUPABASE_FEATURE_SOURCES, type Feature } from './sources'

describe('feature sources', () => {
  it('maps every feature to the configured source', () => {
    const features: Feature[] = ['auth', 'profile', 'rooms', 'chat', 'tournaments', 'registrations', 'activities', 'search']
    expect(Object.keys(FEATURE_SOURCES)).toEqual(features)
    for (const feature of features) expect(sourceOf(feature)).toBe(FEATURE_SOURCES[feature])
    expect(new Set(Object.values(FEATURE_SOURCES)).size).toBe(1)
  })

  it('chỉ chuyển auth, profile và room detail sang Supabase', () => {
    expect(SUPABASE_FEATURE_SOURCES).toEqual({
      auth: 'supabase', profile: 'supabase', rooms: 'supabase',
      chat: 'mock', tournaments: 'mock', registrations: 'mock', activities: 'mock', search: 'mock',
    })
  })
})
