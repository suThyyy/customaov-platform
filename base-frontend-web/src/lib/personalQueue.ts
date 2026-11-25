import type { OpenRoomSnapshot } from '../api'

export function personalQueueMessage(snapshot: OpenRoomSnapshot, userId: string | null | undefined, current: boolean): string {
  if (!current) return 'Đang xác nhận vị trí hàng chờ. Chưa có vị trí cập nhật.'
  const member = snapshot.members.find(m => m.user_id === userId && m.status === 'active')
  if (!userId || !member) return 'Bạn không có tư cách thành viên đang hoạt động trong phòng này.'
  if (snapshot.room.status !== 'open') return 'Phòng đã đóng. Không còn vị trí hàng chờ đang hoạt động.'
  if (snapshot.selected.some(p => p.memberId === member.id)) return 'Bạn đã được chọn vào đội hình; không còn ở hàng chờ.'
  const activeIds = new Set(snapshot.members.filter(m => m.status === 'active').map(m => m.id))
  const waiting = snapshot.waiting.filter(p => activeIds.has(p.memberId)).sort((a,b) => a.queueSeq - b.queueSeq)
  const index = waiting.findIndex(p => p.memberId === member.id)
  return index < 0 ? 'Bạn là thành viên của phòng nhưng hiện không ở hàng chờ.' : `Vị trí của bạn: ${index + 1}/${waiting.length} trong hàng chờ.`
}
