import { describe, expect, it } from 'vitest'
import { isOrganizerRole, parsePlatformRole } from './platformRole'
describe('trusted application role boundary', () => {
  it.each(['user', 'admin', 'super_admin'])('accepts canonical %s', role => expect(parsePlatformRole(role)).toBe(role))
  it.each([null, undefined, 'organizer', 'player', 'guest', '', true])('rejects untrusted/unknown role %s', role => expect(() => parsePlatformRole(role)).toThrow())
  it('does not grant guest/user/unknown organizer capabilities', () => {
    expect(isOrganizerRole(null)).toBe(false)
    expect(isOrganizerRole('guest')).toBe(false)
    expect(isOrganizerRole('user')).toBe(false)
    expect(isOrganizerRole('admin')).toBe(true)
    expect(isOrganizerRole('super_admin')).toBe(true)
  })
})
