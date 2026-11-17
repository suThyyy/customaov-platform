import { httpAdapter } from './http'
import { mockAdapter } from './mock'
import { sourceOf, type Feature } from './sources'

const adapterFor = <K extends Feature>(feature: K) =>
  sourceOf(feature) === 'api' ? httpAdapter[feature] : mockAdapter[feature]

export const authAdapter = adapterFor('auth')
export const profileAdapter = adapterFor('profile')
export const roomsAdapter = adapterFor('rooms')
export const chatAdapter = adapterFor('chat')
export const tournamentsAdapter = adapterFor('tournaments')
export const registrationsAdapter = adapterFor('registrations')
export const activitiesAdapter = adapterFor('activities')
export const searchAdapter = adapterFor('search')
