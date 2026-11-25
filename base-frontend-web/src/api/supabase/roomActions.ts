import { useCallback, useRef, useState } from 'react'
import { requestOpenRoomRefetch } from './realtime'
import {
  closeOpenRoom,
  continueOpenRoomQueue,
  endOpenRoomRound,
  hostAddPlayerToRoom,
  hostKickRoomMember,
  hostRequeueRoomMember,
  leaveOpenRoom,
  prepareNextOpenRoomRound,
  replaceOpenRoomPlayer,
  saveOpenRoomLineup,
  startOpenRoomRound,
  rpc,
  type OpenRoomLineupPlayer,
  type RoomMutationResult,
} from './roomMutations'
import type { OpenRoomSnapshot } from './types'
import { startSeriesGame } from './series'

export type OpenRoomActionName =
  | 'close' | 'leave' | 'addPlayer' | 'kick' | 'requeue' | 'continueQueue'
  | 'prepare' | 'saveLineup' | 'replace' | 'start' | 'end'

export type OpenRoomPending = Record<OpenRoomActionName, boolean>

const EMPTY_PENDING: OpenRoomPending = {
  close: false,
  leave: false,
  addPlayer: false,
  kick: false,
  requeue: false,
  continueQueue: false,
  prepare: false,
  saveLineup: false,
  replace: false,
  start: false,
  end: false,
}

export function useOpenRoomActions(roomId: string, snapshot: OpenRoomSnapshot | null) {
  const [pending, setPending] = useState<OpenRoomPending>(EMPTY_PENDING)
  const inFlight = useRef<Partial<Record<OpenRoomActionName, Promise<RoomMutationResult<unknown>>>>>({})
  const run = useCallback(<T,>(
    action: OpenRoomActionName,
    mutation: () => Promise<RoomMutationResult<T>>,
  ): Promise<RoomMutationResult<T>> => {
    const current = inFlight.current[action]
    if (current) return current as Promise<RoomMutationResult<T>>

    setPending((current) => ({ ...current, [action]: true }))
    const promise = (async () => {
      try {
        const result = await mutation()
        if (result.ok || result.error.kind === 'version_conflict') await requestOpenRoomRefetch(roomId)
        return result
      } finally {
        delete inFlight.current[action]
        setPending((current) => ({ ...current, [action]: false }))
      }
    })()
    inFlight.current[action] = promise
    return promise
  }, [roomId])

  const version = snapshot?.version ?? 0
  const replace = (memberId: string) => run('replace', () => replaceOpenRoomPlayer(roomId, version, memberId))

  return {
    pending,
    close: () => run('close', () => closeOpenRoom(roomId)),
    leave: () => run('leave', () => leaveOpenRoom(roomId)),
    addPlayer: (displayName: string) => run('addPlayer', () => hostAddPlayerToRoom(roomId, displayName)),
    kick: (memberId: string) => run('kick', () => hostKickRoomMember(roomId, memberId)),
    requeue: (memberId: string) => run('requeue', () => hostRequeueRoomMember(roomId, memberId)),
    continueQueue: () => run('continueQueue', () => continueOpenRoomQueue(roomId)),
    prepare: () => run('prepare', () => prepareNextOpenRoomRound(roomId)),
    saveLineup: (players: readonly OpenRoomLineupPlayer[]) =>
      run('saveLineup', () => saveOpenRoomLineup(roomId, version, players)),
    replace,
    swap: (first: string, second: string) => run('saveLineup', () => rpc('swap_open_room_players', { p_room_id: roomId, p_version: version, p_first: first, p_second: second })),
    start: () => run<unknown>('start', () => snapshot?.room.best_of ? startSeriesGame(roomId, version) : startOpenRoomRound(roomId)),
    end: () => run('end', () => endOpenRoomRound(roomId)),
  }
}

export type OpenRoomRole = 'host' | 'member' | 'spectator'

export interface OpenRoomPermissions {
  role: OpenRoomRole
  join: boolean
  leave: boolean
  close: boolean
  addPlayer: boolean
  kick: boolean
  requeue: boolean
  continueQueue: boolean
  prepare: boolean
  saveLineup: boolean
  replace: boolean
  start: boolean
  end: boolean
  canKickMember: (memberId: string) => boolean
  canRequeueMember: (memberId: string) => boolean
  canReplaceMember: (memberId: string) => boolean
}

export function openRoomPermissions(snapshot: OpenRoomSnapshot, userId: string | null | undefined, canOrganize = false): OpenRoomPermissions {
  const isHost = Boolean(canOrganize && userId && snapshot.room.host_user_id === userId)
  const member = userId ? snapshot.members.find((item) => item.user_id === userId && item.status === 'active') : undefined
  const isMember = Boolean(member)
  const role: OpenRoomRole = isHost ? 'host' : isMember ? 'member' : 'spectator'
  const open = snapshot.room.status === 'open'
  const phase = snapshot.room.current_round_state
  const activeQueueMemberIds = new Set([...snapshot.waiting, ...snapshot.selected].map((player) => player.memberId))
  const canContinue = Boolean(member && !activeQueueMemberIds.has(member.id))
  const hostMemberId = snapshot.members.find((item) => item.user_id === snapshot.room.host_user_id && item.status === 'active')?.id
  const activeMembers = new Map(snapshot.members.filter((item) => item.status === 'active').map((item) => [item.id, item]))
  const selectedMemberIds = new Set(snapshot.selected.map((player) => player.memberId))
  const completeLineup = snapshot.selected.length === 10
    && snapshot.selected.filter((player) => player.team === 'a').length === 5
    && snapshot.selected.filter((player) => player.team === 'b').length === 5
    && snapshot.selected.every((player) => {
      const selectedMember = activeMembers.get(player.memberId)
      const hasValidSkill = !((player.skillMode === 'tier' || player.skillMode === 'rank') && player.skillScore == null)
      const modeMatches = !snapshot.room.best_of || player.skillMode === snapshot.room.allocation_mode
      return Boolean(selectedMember && player.queueStatus === 'selected' && hasValidSkill && modeMatches)
    })
  const kick = open && isHost
  const requeue = open && isHost
  const replace = open && isHost && phase === 'preparing'

  return {
    role,
    join: open && !isMember,
    leave: isMember,
    close: open && isHost && !(snapshot.room.best_of && phase === 'active'),
    addPlayer: open && isHost,
    kick,
    requeue,
    continueQueue: open && isMember && canContinue,
    prepare: open && isHost && (phase === 'idle' || phase === 'ended'),
    saveLineup: open && isHost && phase === 'preparing',
    replace,
    start: open && isHost && phase === 'preparing' && completeLineup,
    end: open && isHost && phase === 'active' && !snapshot.room.best_of,
    canKickMember: (memberId) => kick && activeMembers.has(memberId) && memberId !== hostMemberId,
    canRequeueMember: (memberId) => {
      const target = activeMembers.get(memberId)
      return requeue && target?.member_kind === 'guest' && !activeQueueMemberIds.has(memberId)
    },
    canReplaceMember: (memberId) => replace && selectedMemberIds.has(memberId),
  }
}
