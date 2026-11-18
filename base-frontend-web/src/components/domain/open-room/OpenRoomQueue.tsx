import { useState, type FormEvent } from 'react'
import { UserPlus } from 'lucide-react'
import type { OpenRoomPending, OpenRoomPermissions, OpenRoomSnapshot } from '../../../api'
import { Button } from '../../ui/Button'
import { Card } from '../../ui/primitives'
import { ParticipantMenu } from './ParticipantMenu'

const PLAYER_NAME_MAX = 40

export function OpenRoomQueue({
  snapshot,
  permissions,
  pending,
  onAddPlayer,
  onKick,
  onRequeue,
  onReplace,
}: {
  snapshot: OpenRoomSnapshot
  permissions: OpenRoomPermissions
  pending: OpenRoomPending
  onAddPlayer: (displayName: string) => Promise<boolean>
  onKick: (memberId: string, displayName: string) => void
  onRequeue: (memberId: string, displayName: string) => void
  onReplace: (memberId: string) => void
}) {
  const [playerName, setPlayerName] = useState('')
  const hostUserId = snapshot.room.host_user_id

  const activeQueueIds = new Set([
    ...snapshot.waiting.map((item) => item.memberId),
    ...snapshot.selected.map((item) => item.memberId),
  ])
  const offQueueMembers = snapshot.members.filter(
    (member) => member.status === 'active' && !activeQueueIds.has(member.id),
  )

  const submitAddPlayer = async (event: FormEvent) => {
    event.preventDefault()
    const trimmed = playerName.trim()
    if (!trimmed || pending.addPlayer) return
    const ok = await onAddPlayer(trimmed)
    if (ok) setPlayerName('')
  }

  return (
    <div className="grid min-w-0 gap-6 lg:grid-cols-2">
      <Card className="flex min-w-0 flex-col gap-4 p-4">
        <h2 className="text-lg font-semibold">Đang chờ ({snapshot.waiting.length})</h2>
        {permissions.addPlayer && (
          <form onSubmit={submitAddPlayer} className="flex min-w-0 flex-wrap gap-2">
              <input
                type="text"
                maxLength={PLAYER_NAME_MAX}
                value={playerName}
                onChange={(event) => setPlayerName(event.target.value)}
                placeholder="Tên người chơi (tối đa 40 ký tự)"
                aria-label="Thêm người chơi"
                className="h-9 min-w-0 flex-1 rounded-btn border border-line-strong bg-surface-2 px-3 text-sm text-fg placeholder:text-fg-subtle focus:border-gold focus:outline-none"
              />
              <Button
                type="submit"
                variant="outline"
                size="sm"
                leftIcon={<UserPlus size={14} aria-hidden />}
                disabled={!playerName.trim() || pending.addPlayer}
              >
                {pending.addPlayer ? 'Đang thêm…' : 'Thêm người chơi'}
              </Button>
            </form>
          )}

        {snapshot.waiting.length ? (
          <ol className="flex min-w-0 flex-col gap-2">
            {snapshot.waiting.map((player, index) => {
              const member = snapshot.members.find((item) => item.id === player.memberId)
              const isHostMember = Boolean(member?.user_id && member.user_id === hostUserId)
              return (
                <li key={player.memberId} className="flex min-w-0 items-center gap-3 rounded-btn border border-line bg-surface-2 p-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-4 text-sm tabular">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium">{player.displayName}</span>
                  <span className="shrink-0 text-xs text-fg-muted tabular">FIFO #{player.queueSeq}</span>
                  <ParticipantMenu
                    memberId={player.memberId}
                    displayName={player.displayName}
                    isHostMember={isHostMember}
                    canKick={permissions.kick}
                    canRequeue={permissions.requeue}
                    canReplace={false}
                    pending={pending}
                    onKick={onKick}
                    onRequeue={onRequeue}
                    onReplace={onReplace}
                  />
                </li>
              )
            })}
          </ol>
        ) : (
          <p className="text-sm text-fg-muted">Hàng chờ đang trống.</p>
        )}

        {offQueueMembers.length > 0 && (
          <div className="border-t border-line pt-3">
            <p className="text-xs font-semibold text-fg-muted uppercase">Ngoài hàng chờ ({offQueueMembers.length})</p>
            <ul className="mt-2 flex min-w-0 flex-col gap-2">
              {offQueueMembers.map((member) => {
                const isHostMember = Boolean(member.user_id && member.user_id === hostUserId)
                return (
                  <li key={member.id} className="flex min-w-0 items-center justify-between gap-2 rounded-btn border border-line bg-surface-2 px-3 py-2">
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{member.display_name}</span>
                    <ParticipantMenu
                      memberId={member.id}
                      displayName={member.display_name}
                      isHostMember={isHostMember}
                      canKick={permissions.kick}
                      canRequeue={permissions.requeue}
                      canReplace={false}
                      pending={pending}
                      onKick={onKick}
                      onRequeue={onRequeue}
                      onReplace={onReplace}
                    />
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </Card>

      <Card className="min-w-0 p-4">
        <h2 className="text-lg font-semibold">Được chọn ({snapshot.selected.length})</h2>
        {snapshot.selected.length ? (
          <div className="relative mt-3 overflow-x-auto">
            <table className="w-full min-w-[420px] text-left text-sm">
              <thead className="text-fg-muted">
                <tr>
                  <th className="p-2">Slot</th>
                  <th className="p-2">Người chơi</th>
                  <th className="p-2">Đội</th>
                  <th className="p-2">Trạng thái</th>
                  {(permissions.kick || permissions.requeue || permissions.replace) && (
                    <th className="p-2 text-right">Thao tác</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {snapshot.selected.map((player) => {
                  const member = snapshot.members.find((item) => item.id === player.memberId)
                  const isHostMember = Boolean(member?.user_id && member.user_id === hostUserId)
                  return (
                    <tr key={player.memberId} className="border-t border-line">
                      <td className="p-2 tabular">{player.slot}</td>
                      <td className="max-w-[160px] truncate p-2 font-medium">{player.displayName}</td>
                      <td className="p-2">{player.team ? player.team.toUpperCase() : '—'}</td>
                      <td className="p-2">{player.readyState === 'ready' ? 'Sẵn sàng' : 'Đang chờ'}</td>
                      {(permissions.kick || permissions.requeue || permissions.replace) && (
                        <td className="p-2 text-right">
                          <div className="inline-flex justify-end">
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
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-3 text-sm text-fg-muted">Chưa có người chơi được chọn.</p>
        )}
      </Card>
    </div>
  )
}
