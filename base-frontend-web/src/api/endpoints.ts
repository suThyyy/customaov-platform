import {
  ActivitiesResponseSchema,
  AuthResponseSchema,
  ChatMessageSchema,
  CreateMessageBodySchema,
  CreateRegistrationBodySchema,
  CreateRoomBodySchema,
  CreateTournamentBodySchema,
  CsrfResponseSchema,
  DeleteRegistrationResponseSchema,
  ExportTeamsResponseSchema,
  JoinRoomBodySchema,
  KickRoomMemberBodySchema,
  LogoutResponseSchema,
  MeResponseSchema,
  MessagesResponseSchema,
  MoveRoomMemberBodySchema,
  RegistrationResponseSchema,
  RegistrationsResponseSchema,
  RejectRegistrationBodySchema,
  RoomDetailSchema,
  RoomMutationResponseSchema,
  RoomResultBodySchema,
  RoomSummarySchema,
  RoomsResponseSchema,
  ScheduleMatchBodySchema,
  ScoreMatchBodySchema,
  SearchResponseSchema,
  SplitRoomBodySchema,
  TournamentDetailSchema,
  TournamentMutationResponseSchema,
  TournamentsResponseSchema,
  UpdateMeBodySchema,
  UpdateMeResponseSchema,
  UpdateRoomMeBodySchema,
  UpdateTournamentBodySchema,
  UserProfileSchema,
  type ActivitiesQuery,
  type CreateMessageBody,
  type CreateRegistrationBody,
  type CreateRoomBody,
  type CreateTournamentBody,
  type JoinRoomBody,
  type KickRoomMemberBody,
  type LoginBody,
  type MessagesQuery,
  type MoveRoomMemberBody,
  type RegisterBody,
  type RejectRegistrationBody,
  type RoomDetailQuery,
  type RoomResultBody,
  type RoomsQuery,
  type ScheduleMatchBody,
  type ScoreMatchBody,
  type SplitRoomBody,
  type TournamentsQuery,
  type UpdateMeBody,
  type UpdateRoomMeBody,
  type UpdateTournamentBody,
} from '@customaov/contracts'
import { apiRequest } from './client'

const queryString = (query?: Record<string, unknown>): string => {
  if (!query) return ''
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value))
  }
  const value = params.toString()
  return value ? `?${value}` : ''
}

const mutation = <T>(method: 'POST' | 'PATCH' | 'DELETE', body?: T) => ({ method, body })

export const endpoints = {
  csrf: (signal?: AbortSignal) => apiRequest('/api/auth/csrf', CsrfResponseSchema, { signal }),
  register: (body: RegisterBody, signal?: AbortSignal) =>
    apiRequest('/api/auth/register', AuthResponseSchema, { ...mutation('POST', body), signal }),
  login: (body: LoginBody, signal?: AbortSignal) =>
    apiRequest('/api/auth/login', AuthResponseSchema, { ...mutation('POST', body), signal }),
  logout: (signal?: AbortSignal) => apiRequest('/api/auth/logout', LogoutResponseSchema, { method: 'POST', signal }),
  me: (signal?: AbortSignal) => apiRequest('/api/auth/me', MeResponseSchema, { signal }),

  profile: (username: string, signal?: AbortSignal) =>
    apiRequest(`/api/users/${encodeURIComponent(username)}`, UserProfileSchema, { signal }),
  updateMe: (body: UpdateMeBody, signal?: AbortSignal) =>
    apiRequest('/api/users/me', UpdateMeResponseSchema, { ...mutation('PATCH', UpdateMeBodySchema.parse(body)), signal }),

  rooms: (query: Partial<RoomsQuery> = {}, signal?: AbortSignal) =>
    apiRequest(`/api/rooms${queryString(query)}`, RoomsResponseSchema, { signal }),
  createRoom: (body: CreateRoomBody, signal?: AbortSignal) =>
    apiRequest('/api/rooms', RoomDetailSchema, { ...mutation('POST', CreateRoomBodySchema.parse(body)), signal }),
  room: (code: string, query: RoomDetailQuery = {}, signal?: AbortSignal) =>
    apiRequest(`/api/rooms/${encodeURIComponent(code)}${queryString(query)}`, RoomDetailSchema.or(RoomSummarySchema), { signal }),
  joinRoom: (code: string, body: JoinRoomBody, signal?: AbortSignal) =>
    apiRequest(`/api/rooms/${encodeURIComponent(code)}/join`, RoomMutationResponseSchema, {
      ...mutation('POST', JoinRoomBodySchema.parse(body)), signal,
    }),
  leaveRoom: (code: string, signal?: AbortSignal) =>
    apiRequest(`/api/rooms/${encodeURIComponent(code)}/leave`, RoomMutationResponseSchema, { method: 'POST', signal }),
  updateRoomMe: (code: string, body: UpdateRoomMeBody, signal?: AbortSignal) =>
    apiRequest(`/api/rooms/${encodeURIComponent(code)}/me`, RoomMutationResponseSchema, {
      ...mutation('PATCH', UpdateRoomMeBodySchema.parse(body)), signal,
    }),
  splitRoom: (code: string, body: SplitRoomBody, signal?: AbortSignal) =>
    apiRequest(`/api/rooms/${encodeURIComponent(code)}/split`, RoomMutationResponseSchema, {
      ...mutation('POST', SplitRoomBodySchema.parse(body)), signal,
    }),
  moveRoomMember: (code: string, body: MoveRoomMemberBody, signal?: AbortSignal) =>
    apiRequest(`/api/rooms/${encodeURIComponent(code)}/move`, RoomMutationResponseSchema, {
      ...mutation('POST', MoveRoomMemberBodySchema.parse(body)), signal,
    }),
  kickRoomMember: (code: string, body: KickRoomMemberBody, signal?: AbortSignal) =>
    apiRequest(`/api/rooms/${encodeURIComponent(code)}/kick`, RoomMutationResponseSchema, {
      ...mutation('POST', KickRoomMemberBodySchema.parse(body)), signal,
    }),
  randomLanes: (code: string, signal?: AbortSignal) =>
    apiRequest(`/api/rooms/${encodeURIComponent(code)}/random-lanes`, RoomMutationResponseSchema, { method: 'POST', signal }),
  roomResult: (code: string, body: RoomResultBody, signal?: AbortSignal) =>
    apiRequest(`/api/rooms/${encodeURIComponent(code)}/result`, RoomMutationResponseSchema, {
      ...mutation('POST', RoomResultBodySchema.parse(body)), signal,
    }),
  exportRoom: (code: string, signal?: AbortSignal) =>
    apiRequest(`/api/rooms/${encodeURIComponent(code)}/export`, ExportTeamsResponseSchema, { signal }),
  messages: (code: string, query: MessagesQuery = {}, signal?: AbortSignal) =>
    apiRequest(`/api/rooms/${encodeURIComponent(code)}/messages${queryString(query)}`, MessagesResponseSchema, { signal }),
  createMessage: (code: string, body: CreateMessageBody, signal?: AbortSignal) =>
    apiRequest(`/api/rooms/${encodeURIComponent(code)}/messages`, ChatMessageSchema, {
      ...mutation('POST', CreateMessageBodySchema.parse(body)), signal,
    }),

  tournaments: (query: Partial<TournamentsQuery> = {}, signal?: AbortSignal) =>
    apiRequest(`/api/tournaments${queryString(query)}`, TournamentsResponseSchema, { signal }),
  tournament: (slug: string, signal?: AbortSignal) =>
    apiRequest(`/api/tournaments/${encodeURIComponent(slug)}`, TournamentDetailSchema, { signal }),
  createTournament: (body: CreateTournamentBody, signal?: AbortSignal) =>
    apiRequest('/api/tournaments', TournamentMutationResponseSchema, {
      ...mutation('POST', CreateTournamentBodySchema.parse(body)), signal,
    }),
  updateTournament: (slug: string, body: UpdateTournamentBody, signal?: AbortSignal) =>
    apiRequest(`/api/tournaments/${encodeURIComponent(slug)}`, TournamentMutationResponseSchema, {
      ...mutation('PATCH', UpdateTournamentBodySchema.parse(body)), signal,
    }),
  createRegistration: (slug: string, body: CreateRegistrationBody, signal?: AbortSignal) =>
    apiRequest(`/api/tournaments/${encodeURIComponent(slug)}/registrations`, RegistrationResponseSchema, {
      ...mutation('POST', CreateRegistrationBodySchema.parse(body)), signal,
    }),
  registrations: (slug: string, signal?: AbortSignal) =>
    apiRequest(`/api/tournaments/${encodeURIComponent(slug)}/registrations`, RegistrationsResponseSchema, { signal }),
  approveRegistration: (slug: string, id: string, signal?: AbortSignal) =>
    apiRequest(`/api/tournaments/${encodeURIComponent(slug)}/registrations/${encodeURIComponent(id)}/approve`, RegistrationResponseSchema, { method: 'POST', signal }),
  rejectRegistration: (slug: string, id: string, body: RejectRegistrationBody, signal?: AbortSignal) =>
    apiRequest(`/api/tournaments/${encodeURIComponent(slug)}/registrations/${encodeURIComponent(id)}/reject`, RegistrationResponseSchema, {
      ...mutation('POST', RejectRegistrationBodySchema.parse(body)), signal,
    }),
  deleteRegistration: (slug: string, id: string, signal?: AbortSignal) =>
    apiRequest(`/api/tournaments/${encodeURIComponent(slug)}/registrations/${encodeURIComponent(id)}`, DeleteRegistrationResponseSchema, { method: 'DELETE', signal }),
  closeRegistration: (slug: string, signal?: AbortSignal) =>
    apiRequest(`/api/tournaments/${encodeURIComponent(slug)}/close-registration`, TournamentMutationResponseSchema, { method: 'POST', signal }),
  drawTournament: (slug: string, signal?: AbortSignal) =>
    apiRequest(`/api/tournaments/${encodeURIComponent(slug)}/draw`, TournamentMutationResponseSchema, { method: 'POST', signal }),
  scoreMatch: (slug: string, matchId: string, body: ScoreMatchBody, signal?: AbortSignal) =>
    apiRequest(`/api/tournaments/${encodeURIComponent(slug)}/matches/${encodeURIComponent(matchId)}/score`, TournamentMutationResponseSchema, {
      ...mutation('POST', ScoreMatchBodySchema.parse(body)), signal,
    }),
  scheduleMatch: (slug: string, matchId: string, body: ScheduleMatchBody, signal?: AbortSignal) =>
    apiRequest(`/api/tournaments/${encodeURIComponent(slug)}/matches/${encodeURIComponent(matchId)}`, TournamentMutationResponseSchema, {
      ...mutation('PATCH', ScheduleMatchBodySchema.parse(body)), signal,
    }),

  activities: (query: Partial<ActivitiesQuery> = {}, signal?: AbortSignal) =>
    apiRequest(`/api/activities${queryString(query)}`, ActivitiesResponseSchema, { signal }),
  search: (q: string, signal?: AbortSignal) =>
    apiRequest(`/api/search${queryString({ q })}`, SearchResponseSchema, { signal }),
  websocket: () => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    return new WebSocket(`${protocol}//${window.location.host}/api/ws`)
  },
}
