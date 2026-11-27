import { useEffect, useMemo, useState } from 'react'
import { ArrowLeftRight, Shuffle } from 'lucide-react'
import {
  type OpenRoomLineupPlayer,
  type OpenRoomParticipant,
  type OpenRoomPending,
  type OpenRoomPermissions,
  type OpenRoomSnapshot,
  type RoomSplitTool,
} from '../../../api'
import { cn } from '../../../lib/cn'
import { Button } from '../../ui/Button'
import { Card } from '../../ui/primitives'
import { buildLineupFromSelected, buildRandomLineup } from './helpers'
import { ParticipantMenu } from './ParticipantMenu'
import { TeamReveal } from './TeamReveal'
import { revealKeyOf, type RevealEntry } from './revealPlan'
import { DEFAULT_TIER_SCORES, splitTeams5v5 } from '@customaov/team-core'

export function OpenRoomLineup({
  snapshot,
  permissions,
  pending,
  splitTool = 'random',
  onSaveLineup,
  onSwap,
  onKick,
  onRequeue,
  onReplace,
  onNotify,
}: {
  snapshot: OpenRoomSnapshot
  permissions: OpenRoomPermissions
  pending: OpenRoomPending
  splitTool?: RoomSplitTool
  onSaveLineup: (players: readonly OpenRoomLineupPlayer[]) => Promise<boolean>
  onSwap: (first: string, second: string) => Promise<boolean>
  onKick: (memberId: string, displayName: string) => void
  onRequeue: (memberId: string, displayName: string) => void
  onReplace: (memberId: string) => void
  onNotify: (title: string, description?: string) => void
}) {
  const [selectedA, setSelectedA] = useState<string | null>(null)
  const [selectedB, setSelectedB] = useState<string | null>(null)
  const [skills, setSkills] = useState<Record<string, { value: string; score: string }>>({})
  // Reveal chỉ đọc đội hình đã lưu trên server; nó không quyết định thành viên đội.
  const hasLineup = snapshot.selected.length === 10 && snapshot.selected.every(player => player.team === 'a' || player.team === 'b')
  const revealVariant = splitTool === 'random' ? 'roulette' : 'meteor'
  const revealEntries = useMemo<RevealEntry[]>(() => hasLineup
    ? snapshot.selected.map(player => ({
      id: player.memberId,
      team: player.team as 'a' | 'b',
      slot: player.slot ?? 0,
      primary: player.displayName,
      secondary: revealVariant === 'meteor' && player.skillValue ? String(player.skillValue) : undefined,
      score: revealVariant === 'meteor' && player.skillScore != null ? Number(player.skillScore) : undefined,
    }))
    : [], [hasLineup, snapshot.selected, revealVariant])
  const revealKey = revealKeyOf(`lineup:${snapshot.room.id}:${snapshot.room.current_round_no ?? 0}:${revealVariant}`, revealEntries)

  useEffect(() => {
    setSelectedA(null)
    setSelectedB(null)
  }, [snapshot.version])

  if (snapshot.room.current_round_state !== 'preparing') return null

  const teamA = snapshot.selected.filter((player) => player.team === 'a')
  const teamB = snapshot.selected.filter((player) => player.team === 'b')
  const unassigned = snapshot.selected.filter((player) => player.team !== 'a' && player.team !== 'b')
  const completeLineup = snapshot.selected.length === 10 && teamA.length === 5 && teamB.length === 5
  const canAssignTeam = (team: 'a' | 'b') => unassigned.length === 1
    && (team === 'a' ? teamA.length === 4 && teamB.length === 5 : teamB.length === 4 && teamA.length === 5)
  const canAssignManually = canAssignTeam('a') || canAssignTeam('b')

  const handleSwap = async () => {
    if (!completeLineup || !selectedA || !selectedB || pending.saveLineup) return
    try {
      const ok = await onSwap(selectedA, selectedB)
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
    if (splitTool === 'random') { await onSaveLineup(buildRandomLineup(snapshot.selected)); return }
    try {
      const entries = snapshot.selected.map(player => {
        const value = skills[player.memberId]?.value ?? player.skillValue ?? ''
        const score = splitTool === 'tier' ? Number(DEFAULT_TIER_SCORES[value]) : Number(skills[player.memberId]?.score ?? player.skillScore)
        if (!value.trim() || !Number.isFinite(score) || score <= 0) throw new Error('Nhập Tier/Rank và điểm hợp lệ cho đủ mười người.')
        return { id: player.memberId, value, score }
      })
      // A replacement only needs its skill entered: retain the server's slots/teams.
      const needsRepair = completeLineup && snapshot.selected.some(player => !player.skillMode)
      const teams = splitTeams5v5(entries, { mode: splitTool, balanceLevel: '60-40', scores: Object.fromEntries(entries.map(entry => [entry.id, entry.score])), getScoreKey: entry => entry.id })
      if (teams.warning && !needsRepair) onNotify('Chênh lệch điểm còn cao; hãy kiểm tra đội hình sau khi lưu.')
      const blue = new Set(teams.teamA.map(player => player.id))
      await onSaveLineup(entries.map(entry => ({ member_id: entry.id, team: needsRepair ? snapshot.selected.find(player => player.memberId === entry.id)!.team as 'a' | 'b' : blue.has(entry.id) ? 'a' : 'b', skill_mode: splitTool, skill_value: entry.value, skill_score: entry.score })))
    } catch (error) { onNotify(error instanceof Error ? error.message : String(error)) }
  }

  const handleAssignTeam = async (memberId: string, team: 'a' | 'b') => {
    if (pending.saveLineup || !canAssignTeam(team)) return
    try {
      const assigned = snapshot.selected.map((player) => (
        player.memberId === memberId ? { ...player, team } : player
      ))
      await onSaveLineup(buildLineupFromSelected(assigned))
    } catch (reason) {
      onNotify(reason instanceof Error ? reason.message : 'Không thể xếp đội cho người chơi.')
    }
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
            const picked = activeId === player.memberId || selectedA === player.memberId || selectedB === player.memberId
            return (
              <li
                key={player.memberId}
                className={cn(
                  'flex min-w-0 items-center justify-between gap-2 rounded-btn border px-3 py-2 transition-colors',
                  picked ? 'border-gold bg-gold-tint/40' : 'border-line bg-surface',
                )}
              >
                {permissions.saveLineup && completeLineup ? (
                  <button
                    type="button"
                    aria-pressed={picked}
                    onClick={() => onSelect(picked ? '' : player.memberId)}
                    className="min-w-0 flex-1 break-words text-left text-sm font-medium"
                  >
                    {player.displayName}
                  </button>
                ) : (
                  <span className="min-w-0 flex-1 break-words text-sm font-medium">{player.displayName}</span>
                )}
                <ParticipantMenu
                  memberId={player.memberId}
                  displayName={player.displayName}
                  canKick={permissions.canKickMember(player.memberId)}
                  canRequeue={permissions.canRequeueMember(player.memberId)}
                  canReplace={permissions.canReplaceMember(player.memberId)}
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
          {permissions.saveLineup && completeLineup && (
            <p className="text-xs text-fg-muted">Chọn hai người ở cùng đội hoặc khác đội để đổi chỗ.</p>
          )}
        </div>
        {permissions.saveLineup && (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              leftIcon={<ArrowLeftRight size={14} aria-hidden />}
              disabled={!completeLineup || !selectedA || !selectedB || pending.saveLineup}
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
              {splitTool === 'tier'
                ? 'Chia theo Tier Balance'
                : splitTool === 'rank'
                  ? 'Chia theo Rank Balance'
                  : pending.saveLineup
                    ? 'Đang chia…'
                    : 'Chia ngẫu nhiên'}
            </Button>
          </div>
        )}
      </div>
      {permissions.saveLineup && splitTool !== 'random' && (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-fg-muted">Nhập {splitTool === 'tier' ? 'Tier 1–5 (điểm 8 / 4 / 2 / 1 / 0.5)' : 'Rank và điểm do chủ phòng xác nhận'} cho từng người. Sau Replace, lưu điểm người mới sẽ giữ đội hình.</p>
          {snapshot.selected.map(player => <div key={player.memberId} className="grid min-w-0 gap-2 md:grid-cols-3"><label className="min-w-0 text-sm">{player.displayName}<input aria-label={`${splitTool} cho ${player.displayName}`} className="w-full rounded-btn border border-line bg-surface p-2" value={skills[player.memberId]?.value ?? player.skillValue ?? ''} onChange={event => setSkills(old => ({ ...old, [player.memberId]: { value: event.target.value, score: old[player.memberId]?.score ?? String(player.skillScore ?? '') } }))} /></label>{splitTool === 'rank' && <label className="text-sm">Điểm<input aria-label={`Điểm cho ${player.displayName}`} type="number" min="0.0001" step="any" className="w-full rounded-btn border border-line bg-surface p-2" value={skills[player.memberId]?.score ?? player.skillScore ?? ''} onChange={event => setSkills(old => ({ ...old, [player.memberId]: { value: old[player.memberId]?.value ?? player.skillValue ?? '', score: event.target.value } }))} /></label>}</div>)}
        </div>
      )}

      <div className="mt-4 min-w-0">
        <TeamReveal entries={revealEntries} revealKey={revealKey} variant={revealVariant} title="đội hình 5v5 đã lưu">
          <div className="grid min-w-0 gap-4 md:grid-cols-2">
            {renderTeamColumn('Team A', teamA, 'a', selectedA, (id) => { if (!selectedA || selectedA === id) setSelectedA(id || null); else setSelectedB(id || null) }, 'text-team-blue-fg')}
            {renderTeamColumn('Team B', teamB, 'b', selectedB, (id) => { if (!selectedA || selectedA === id) setSelectedA(id || null); else setSelectedB(id || null) }, 'text-team-red-fg')}
          </div>
        </TeamReveal>
      </div>

      {unassigned.length > 0 && (
        <div className="mt-4 rounded-btn border border-line bg-surface-2 p-3">
          <h3 className="text-sm font-semibold">Chưa xếp đội ({unassigned.length})</h3>
          <ul className="mt-2 flex min-w-0 flex-col gap-2">
            {unassigned.map((player) => (
              <li key={player.memberId} className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-btn border border-line bg-surface px-3 py-2">
                <span className="min-w-0 flex-1 break-words text-sm font-medium">{player.displayName}</span>
                {permissions.saveLineup && (
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      aria-label={`Vào Team A cho ${player.displayName}`}
                      disabled={!canAssignTeam('a') || pending.saveLineup}
                      onClick={() => void handleAssignTeam(player.memberId, 'a')}
                    >
                      Vào Team A
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      aria-label={`Vào Team B cho ${player.displayName}`}
                      disabled={!canAssignTeam('b') || pending.saveLineup}
                      onClick={() => void handleAssignTeam(player.memberId, 'b')}
                    >
                      Vào Team B
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
          {!canAssignManually && (
            <p className="mt-2 text-xs text-fg-muted">Bấm Chia ngẫu nhiên để xếp lại đội hình</p>
          )}
        </div>
      )}
    </Card>
  )
}
