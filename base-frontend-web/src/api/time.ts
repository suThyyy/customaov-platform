const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

const dateFormat = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

/**
 * Thời gian tương đối kiểu "5 phút trước" cho feed hoạt động.
 * < 1 phút (hoặc thời điểm ở tương lai do lệch đồng hồ) → "Vừa xong"; ≥ 7 ngày → ngày dd/mm/yyyy (giờ VN).
 */
export function timeAgo(iso: string, now: number = Date.now()): string {
  const at = Date.parse(iso)
  if (Number.isNaN(at)) return ''
  const diff = now - at
  if (diff < MINUTE) return 'Vừa xong'
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)} phút trước`
  if (diff < DAY) return `${Math.floor(diff / HOUR)} giờ trước`
  if (diff < 7 * DAY) return `${Math.floor(diff / DAY)} ngày trước`
  return dateFormat.format(at)
}
