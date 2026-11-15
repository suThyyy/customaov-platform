import type { Activity } from './types'

export const activities: Activity[] = [
  { id: 'a1', kind: 'join', text: 'Tham gia phòng "Giao lưu cộng đồng #06"', timeAgo: '5 phút trước' },
  { id: 'a2', kind: 'register', text: 'Theo dõi giải "Custom League #3"', timeAgo: '18 phút trước' },
  { id: 'a3', kind: 'invite', text: 'Được mời vào phòng "Kèo giao hữu – Team A vs B"', timeAgo: '32 phút trước' },
  { id: 'a4', kind: 'result', text: 'Trận đấu đã kết thúc', emphasis: 'Thắng', timeAgo: '45 phút trước' },
]
