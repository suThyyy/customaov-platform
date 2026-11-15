import { describe, expect, it } from 'vitest'
import { timeAgo } from './time'

const NOW = Date.parse('2026-11-15T10:00:00.000Z')
const ago = (ms: number) => new Date(NOW - ms).toISOString()

describe('timeAgo', () => {
  it('tính tương đối theo phút / giờ / ngày', () => {
    expect(timeAgo(ago(20_000), NOW)).toBe('Vừa xong')
    expect(timeAgo(ago(-5_000), NOW)).toBe('Vừa xong')
    expect(timeAgo(ago(5 * 60_000), NOW)).toBe('5 phút trước')
    expect(timeAgo(ago(59 * 60_000 + 59_000), NOW)).toBe('59 phút trước')
    expect(timeAgo(ago(3 * 3_600_000), NOW)).toBe('3 giờ trước')
    expect(timeAgo(ago(2 * 86_400_000), NOW)).toBe('2 ngày trước')
  })

  it('từ 7 ngày trở lên hiện ngày theo giờ Việt Nam', () => {
    // 2026-11-01T18:00Z = 02/11/2026 01:00 giờ VN
    expect(timeAgo('2026-11-01T18:00:00.000Z', NOW)).toBe('02/11/2026')
  })

  it('chuỗi không hợp lệ trả về rỗng', () => {
    expect(timeAgo('not-a-date', NOW)).toBe('')
  })
})
