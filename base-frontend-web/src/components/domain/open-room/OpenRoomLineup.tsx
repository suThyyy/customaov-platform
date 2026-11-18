import { useEffect, useState } from 'react'
import { ArrowLeftRight, Shuffle } from 'lucide-react'
import {
  swapLineupPlayers,
  type OpenRoomLineupPlayer,
  type OpenRoomParticipant,
  type OpenRoomPending,
  type OpenRoomPermissions,
  type OpenRoomSnapshot,
} from '../../../api'
import { cn } from '../../../lib/cn'
import { Button } from '../../ui/Button'
import { Card } from '../../ui/primitives'
import { buildLineupFromSelected, buildRandomLineup } from './helpers'
import { ParticipantMenu } from './ParticipantMenu'

export function OpenRoomLineup({
  snapshot,
  permissions,
  pending,
  onSaveLineup,
  onKick,
  onRequeue,
  onReplace,
  onNotify,
}: {
  snapshot: OpenRoomSnapshot
  permissions: OpenRoomPermissions
  pending: OpenRoomPending
  onSaveLineup: (players: readonly OpenRoomLineupPlayer[]) => Promise<boolean>
  onKick: (memberId: string, displayName: string) => void
  onRequeue: (memberId: string, displayName: string) => void
  onReplace: (memberId: string) => void
  onNotify: (title: string, description?: string) => void
}) {
  const [selectedA, setSelectedA] = useState<string | null>(null)
  const [selectedB, setSelectedB] = useState<string | null>(null)

  useEffect(() => {
    setSelectedA(null)
    setSelectedB(null)
  }, [snapshot.version])

  if (snapshot.room.current_round_state !== 'preparing') return null

  const teamA = snapshot.selected.filter((player) => player.team === 'a')
  const teamB = snapshot.selected.filter((player) => player.team === 'b')
  const unassigned = snapshot.selected.filter((player) => player.team !== 'a' && player.team !== 'b')
  const hostUserId = snapshot.room.host_user_id

  const handleSwap = async () => {
    if (!selectedA || !selectedB || pending.saveLineup) return
    try {
      const lineup = buildLineupFromSelected(snapshot.selected)
      const swapped = swapLineupPlayers(lineup, selectedA, selectedB)
      const ok = await onSaveLineup(swapped)
      if (ok) {
        setSelectedA(null)
        setSelectedB(null)
      }
    } catch (reason) {
      onNotify(reason instanceof Error ? reason.message : 'Không thể đổi chỗ người chơi.')
    }
  }

  const handleRandomSplit = async () => {
    if (pending.saveLineup) return
    await onSaveLineup(buildRandomLineup(snapshot.selected))
  }

  const renderTeamColumn = (
    title: string,
    players: OpenRoomParticipant[],
    side: 'a' | 'b',
    activeId: string | null,
    onSelect: (memberId: string) => void,
    toneClass: string,
  ) => (
    <div className="flex min-w-0 flex-col gap-2 rounded-btn border border-line bg-surface-2 p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className={cn('text-sm font-semibold', toneClass)}>{title} ({players.length}/5)</h3>
      </div>
      {players.length ? (
        <ul className="flex min-w-0 flex-col gap-2">
          {players.map((player) => {
            const member = snapshot.members.find((item) => item.id === player.memberId)
            const isHostMember = Boolean(member?.user_id && member.user_id === hostUserId)
            const picked = activeId === player.memberId
            return (
              <li
                key={player.memberId}
                className={cn(
                  'flex min-w-0 items-center justify-between gap-2 rounded-btn border px-3 py-2 transition-colors',
                  picked ? 'border-gold bg-gold-tint/40' : 'border-line bg-surface',
                )}
              >
                {permissions.saveLineup ? (
                  <button
                    type="button"
                    aria-pressed={picked}
                    onClick={() => onSelect(picked ? '' : player.memberId)}
                    className="min-w-0 flex-1 truncate text-left text-sm font-medium"
                  >
                    {player.displayName}
                  </button>
                ) : (
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{player.displayName}</span>
                )}
                <ParticipantMenu
                  memberId={player.memberId}
                  displayName={player.displayName}
                  isHostMember={isHostMember}
                  canKick={permissions.kick}
                  canRequeue={permissions.requeue}
                  canReplace={permissions.replace}
                  pending={pending}
                  onKick={onKick}
                  onRequeue={onRequeue}
                  onReplace={onReplace}
                />
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="text-xs text-fg-muted">Chưa có người chơi trong {side === 'a' ? 'Team A' : 'Team B'}.</p>
      )}
    </div>
  )

  return (
    <Card className="min-w-0 p-4">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold">Đội hình 5v5</h2>
          {permissions.saveLineup && (
            <p className="text-xs text-fg-muted">Chọn 1 người ở Team A và 1 người ở Team B để đổi chỗ.</p>
          )}
        </div>
        {permissions.saveLineup && (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              leftIcon={<ArrowLeftRight size={14} aria-hidden />}
              disabled={!selectedA || !selectedB || pending.saveLineup}
              onClick={handleSwap}
            >
              {pending.saveLineup ? 'Đang lưu…' : 'Đổi chỗ'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Shuffle size={14} aria-hidden />}
              disabled={snapshot.selected.length !== 10 || pending.saveLineup}
              onClick={handleRandomSplit}
            >
              {pending.saveLineup ? 'Đang chia…' : 'Chia ngẫu nhiên'}
            </Button>
          </div>
        )}
      </div>

      <div className="mt-4 grid min-w-0 gap-4 md:grid-cols-2">
        {renderTeamColumn('Team A', teamA, 'a', selectedA, (id) => setSelectedA(id || null), 'text-team-blue-fg')}
        {renderTeamColumn('Team B', teamB, 'b', selectedB, (id) => setSelectedB(id || null), 'text-team-red-fg')}
      </div>

      {unassigned.length > 0 && (
        <p className="mt-3 text-xs text-fg-muted">
          Chưa phân đội ({unassigned.length}): {unassigned.map((player) => player.displayName).join(', ')}
        </p>
      )}
    </Card>
  )
}
