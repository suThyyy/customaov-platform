import { useEffect, useState } from 'react'
import { discoverSeriesRooms, type DiscoveredRoom } from '../../../api/supabase/configuration'
import { readPublicGameResults, type PublicGameResult } from '../../../api/supabase/series'
import { ButtonLink } from '../../ui/Button'

/** Public summaries use the narrow RPC, never protected history tables. */
export function PublicRoomAccess({ roomId }: { roomId: string }) {
  const [room, setRoom] = useState<DiscoveredRoom>()
  const [results, setResults] = useState<PublicGameResult[]>([])
  const [message, setMessage] = useState('Đang kiểm tra quyền truy cập…')
  useEffect(() => {
    let active = true
    void (async () => {
      const rooms = await discoverSeriesRooms()
      const found = rooms.find(room => room.room_id === roomId)
      if (!found) { if (active) setMessage('Phòng không tồn tại hoặc cần link mời hợp lệ. Thành viên đã bị mời ra không thể tham gia lại.'); return }
      const response = await readPublicGameResults(roomId)
      if (!response.ok) throw response.error
      if (active) { setRoom(found); setResults(response.data); setMessage('Tham gia bằng link mời để xem hàng chờ và lịch sử đầy đủ.') }
    })().catch(error => { if (active) setMessage(error instanceof Error ? error.message : String(error)) })
    return () => { active = false }
  }, [roomId])
  return <section className="mt-6 min-w-0 space-y-4">
    <h1 className="text-2xl">{room?.room_name ?? 'Không thể mở phòng'}</h1><p>{message}</p>
    {room && <ButtonLink to="/join/discovery" state={{ inviteCode: room.invite_code }} variant="outline">Tham gia bằng lời mời</ButtonLink>}
    <ButtonLink to="/dashboard" variant="ghost">Về trang chủ</ButtonLink>
    {room && <><h2 className="text-lg">Kết quả công khai</h2>{!results.length && <p>Không có kết quả công khai được phép xem.</p>}<ul className="space-y-3">{results.map(row => <li key={`${row.series_id}:${row.game_no}`} className="break-all rounded-card border border-line p-3 text-sm">Series {row.series_id} · Game {row.game_no} · Match ID {row.match_id} · Thắng: {row.winner === 'a' ? 'Xanh' : 'Đỏ'} · {row.provenance} / {row.verification}</li>)}</ul></>}
  </section>
}
