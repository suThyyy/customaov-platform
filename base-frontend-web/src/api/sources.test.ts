import { describe, expect, it } from 'vitest'
import { FEATURE_SOURCES, sourceOf, type Feature } from './sources'

describe('feature sources', () => {
  it('maps every feature to the configured global source until HUY-14', () => {
    const features: Feature[] = ['auth', 'profile', 'rooms', 'chat', 'tournaments', 'registrations', 'activities', 'search']
    expect(Object.keys(FEATURE_SOURCES)).toEqual(features)
    for (const feature of features) expect(sourceOf(feature)).toBe(FEATURE_SOURCES[feature])
    expect(new Set(Object.values(FEATURE_SOURCES)).size).toBe(1)
  })
})
