import type { Series } from '@customaov/contracts'
import { ApiError } from './client'
import { endpoints } from './endpoints'
import type { TournamentDetail } from './types'

/**
 * Thao tác của ban tổ chức (chỉ nguồn API; API.md mục 5).
 * Kết quả trả về (chi tiết giải mới) bị bỏ qua: nơi gọi tải lại chi tiết bằng `reload()`.
 */
export const organizerActions = {
  closeRegistration: async (slug: string): Promise<void> => {
    await endpoints.closeRegistration(slug)
  },
  draw: async (slug: string): Promise<void> => {
    await endpoints.drawTournament(slug)
  },
  score: async (slug: string, matchId: string, scoreA: number, scoreB: number): Promise<void> => {
    await endpoints.scoreMatch(slug, matchId, { scoreA, scoreB })
  },
  /** `local` là giá trị ô `datetime-local` ("2026-11-20T19:00"), hiểu theo giờ Việt Nam (UTC+7) */
  schedule: async (slug: string, matchId: string, local: string): Promise<void> => {
    await endpoints.scheduleMatch(slug, matchId, { scheduledAt: vietnamIso(local) })
  },
}

/** "2026-11-20T19:00" → "2026-11-20T19:00:00+07:00" */
export const vietnamIso = (local: string): string => `${local.length === 16 ? `${local}:00` : local}+07:00`

export const WINS_NEEDED: Record<Series, number> = { BO1: 1, BO3: 2, BO5: 3, BO7: 4 }

/** Thể thức BO của giải: API có `series`; thiếu thì đọc từ nhãn "Loại trực tiếp (BO3)" */
export const seriesOf = (d: Pick<TournamentDetail, 'series' | 'formatLabel'>): Series =>
  d.series ?? ((/BO[135]/.exec(d.formatLabel)?.[0] as Series | undefined) ?? 'BO3')

/** Thông báo lỗi cho thao tác BTC: 409 (LOCKED / MATCH_NOT_READY / sai trạng thái) dùng thông điệp của server. */
export function organizerErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    if (error.status === 403) return 'Chỉ ban tổ chức mới có quyền thực hiện thao tác này.'
    return error.message || fallback
  }
  return fallback
}
