import type { HomeSlide } from './types'

/** Carousel giới thiệu ở dashboard. Slide 1 đúng theo mock; slide 2–3 suy luận từ tính năng có sẵn. */
export const homeSlides: HomeSlide[] = [
  {
    lead: 'Hỗ trợ phòng custom &',
    line2: 'sự kiện cộng đồng',
    accent: 'Liên Quân',
    desc: ['Tạo phòng, lập đội, tham gia giải đấu mini và kết nối cộng đồng', 'đam mê Custom Liên Quân.'],
  },
  {
    lead: 'Chia đội công bằng,',
    line2: 'random lane & tướng',
    accent: 'chỉ 1 chạm',
    desc: ['Cân bằng trình độ theo chỉ số, rank và lịch sử trận', 'để mỗi kèo custom đều hấp dẫn.'],
  },
  {
    lead: 'Giải đấu mini',
    line2: 'cho cộng đồng',
    accent: 'Custom AOV',
    desc: ['Đăng ký, theo dõi nhánh đấu và lịch thi đấu', 'của các giải cộng đồng mỗi tuần.'],
  },
]

/** Con số cộng đồng (landing) — mock */
export const communityStats: Array<{ label: string; value: string }> = [
  { label: 'Người chơi', value: '12.400+' },
  { label: 'Phòng custom đã tạo', value: '3.800+' },
  { label: 'Giải đấu cộng đồng', value: '45' },
]
