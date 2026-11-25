import type { OpenRoomSnapshot } from '../../../api'
import { personalQueueMessage } from '../../../lib/personalQueue'

export function PersonalQueueStatus({ snapshot, userId, current }: { snapshot: OpenRoomSnapshot; userId?: string | null; current: boolean }) {
  return <section aria-label="Hàng chờ của bạn" className="rounded-card border border-line bg-surface-2 p-4"><h2 className="text-lg font-semibold">Hàng chờ của bạn</h2><p role="status" className="mt-2 text-sm">{personalQueueMessage(snapshot,userId,current)}</p></section>
}
