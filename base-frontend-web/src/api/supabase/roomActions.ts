import { useCallback, useState } from 'react'
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
  type OpenRoomLineupPlayer,
  type RoomMutationResult,
} from './roomMutations'
import type { OpenRoomSnapshot } from './types'

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
  const run = useCallback(async <T,>(
    action: OpenRoomActionName,
    mutation: () => Promise<RoomMutationResult<T>>,
  ): Promise<RoomMutationResult<T>> => {
    setPending((current) => ({ ...current, [action]: true }))
    try {
      const result = await mutation()
      if (result.ok || result.error.kind === 'version_conflict') await requestOpenRoomRefetch(roomId)
      return result
    } finally {
      setPending((current) => ({ ...current, [action]: false }))
    }
  }, [roomId])

  const version = snapshot?.version ?? 0
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
    replace: (memberId: string) => run('replace', () => replaceOpenRoomPlayer(roomId, version, memberId)),
    start: () => run('start', () => startOpenRoomRound(roomId)),
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
}

export function openRoomPermissions(snapshot: OpenRoomSnapshot, userId: string | null | undefined): OpenRoomPermissions {
  const isHost = Boolean(userId && snapshot.room.host_user_id === userId)
  const member = userId ? snapshot.members.find((item) => item.user_id === userId && item.status === 'active') : undefined
  const isMember = Boolean(member)
  const role: OpenRoomRole = isHost ? 'host' : isMember ? 'member' : 'spectator'
  const open = snapshot.room.status === 'open'
  const phase = snapshot.room.current_round_state
  const activeQueueMemberIds = new Set([...snapshot.waiting, ...snapshot.selected].map((player) => player.memberId))
  const canContinue = Boolean(member && !activeQueueMemberIds.has(member.id))

  return {
    role,
    join: open && !isMember,
    leave: isMember,
    close: open && isHost,
    addPlayer: open && isHost,
    kick: open && isHost,
    requeue: open && isHost,
    continueQueue: open && isMember && canContinue,
    prepare: open && isHost && (phase === 'idle' || phase === 'ended'),
    saveLineup: open && isHost && phase === 'preparing',
    replace: open && isHost && phase === 'preparing',
    start: open && isHost && phase === 'preparing',
    end: open && isHost && phase === 'active',
  }
}
