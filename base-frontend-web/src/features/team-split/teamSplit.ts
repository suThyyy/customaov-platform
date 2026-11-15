/**
 * Lớp tích hợp giữa UI phòng custom và `@customaov/team-core`.
 * Không chứa thuật toán chia đội: mọi phép chia đều do `splitTeams5v5` thực hiện.
 */
import {
  DEFAULT_BALANCE_LEVEL,
  DEFAULT_TIER_SCORES,
  TeamCoreError,
  splitTeams5v5,
  type BalanceLevel,
  type RandomSource,
  type ScoreTable,
  type TeamCoreErrorCode,
  type TeamSplitMode,
} from '@customaov/team-core'
import type { RoomMember } from '../../api'

export type TeamSplitRequest =
  | { readonly mode: 'random'; readonly random?: RandomSource }
  | {
      readonly mode: 'tier'
      /** Mặc định DEFAULT_TIER_SCORES */
      readonly scores?: ScoreTable
      /** Mặc định DEFAULT_BALANCE_LEVEL */
      readonly balanceLevel?: BalanceLevel
      readonly random?: RandomSource
    }
  | {
      readonly mode: 'rank'
      /** Bảng điểm Rank bắt buộc — frontend chưa có nguồn dữ liệu này. */
      readonly scores: ScoreTable
      /** Mặc định DEFAULT_BALANCE_LEVEL */
      readonly balanceLevel?: BalanceLevel
      readonly random?: RandomSource
    }

export interface RoomTeams {
  readonly blue: RoomMember[]
  readonly red: RoomMember[]
}

export type TeamSplitOutcome =
  | { readonly ok: true; readonly mode: TeamSplitMode; readonly warning: boolean; readonly teams: RoomTeams }
  | { readonly ok: false; readonly code: TeamCoreErrorCode; readonly message: string }

/** Wrapper để core nhận `id` mà vẫn trả nguyên object RoomMember (giữ dữ liệu bổ sung). */
interface SplitEntry {
  readonly id: string
  readonly member: RoomMember
}

const ERROR_MESSAGES: Record<TeamCoreErrorCode, string> = {
  INVALID_PLAYER_LIST: 'Danh sách người chơi không hợp lệ.',
  INVALID_PLAYER_COUNT: 'Cần đúng 10 người chơi để chia đội 5v5.',
  INVALID_PLAYER_ID: 'Có người chơi thiếu mã định danh. Vui lòng tải lại phòng.',
  DUPLICATE_PLAYER_ID: 'Có người chơi bị trùng trong phòng. Vui lòng kiểm tra lại danh sách.',
  INVALID_MODE: 'Chế độ chia đội không được hỗ trợ.',
  INVALID_BALANCE_LEVEL: 'Mức cân bằng không hợp lệ.',
  INVALID_SCORE_TABLE: 'Bảng điểm chia đội không hợp lệ.',
  MISSING_SCORE: 'Thiếu dữ liệu Tier/Rank của người chơi để chia đội cân bằng.',
  INVALID_SCORE: 'Bảng điểm có giá trị không hợp lệ.',
  INVALID_RANDOM_SOURCE: 'Không thể tạo kết quả ngẫu nhiên. Vui lòng thử lại.',
  INVARIANT_VIOLATION: 'Kết quả chia đội không hợp lệ. Vui lòng thử lại.',
}

export const MODE_LABEL: Record<TeamSplitMode, string> = {
  random: 'Ngẫu nhiên',
  tier: 'Theo Tier',
  rank: 'Theo Rank',
}

export function teamSplitErrorMessage(code: TeamCoreErrorCode, playerCount?: number): string {
  if (code === 'INVALID_PLAYER_COUNT' && playerCount !== undefined) {
    return `Cần đúng 10 người chơi để chia đội 5v5 (hiện có ${playerCount}).`
  }
  return ERROR_MESSAGES[code]
}

/**
 * Chia các thành viên phòng thành Team Xanh (teamA) / Team Đỏ (teamB).
 * - `TeamCoreError` → `{ ok: false }` với thông báo tiếng Việt (không lộ chi tiết kỹ thuật).
 * - Lỗi khác được ném tiếp để đi qua cơ chế xử lý lỗi chung.
 * Lane/captain/ready của thành viên được giữ nguyên; bước này không gán lane hay tướng.
 */
export function splitRoomMembers(members: readonly RoomMember[], request: TeamSplitRequest): TeamSplitOutcome {
  const entries: SplitEntry[] = members.map((member) => ({ id: member.player.id, member }))

  try {
    // Thiếu tier/rankTier → key rỗng → core báo MISSING_SCORE (không tự bịa điểm).
    const result =
      request.mode === 'random'
        ? splitTeams5v5(entries, { mode: 'random', random: request.random })
        : request.mode === 'tier'
          ? splitTeams5v5(entries, {
              mode: 'tier',
              scores: request.scores ?? DEFAULT_TIER_SCORES,
              balanceLevel: request.balanceLevel ?? DEFAULT_BALANCE_LEVEL,
              getScoreKey: (entry) => entry.member.player.tier ?? '',
              random: request.random,
            })
          : splitTeams5v5(entries, {
              mode: 'rank',
              scores: request.scores,
              balanceLevel: request.balanceLevel ?? DEFAULT_BALANCE_LEVEL,
              getScoreKey: (entry) => entry.member.player.rankTier ?? '',
              random: request.random,
            })

    return {
      ok: true,
      mode: result.mode,
      warning: result.warning,
      teams: {
        blue: result.teamA.map((entry) => entry.member),
        red: result.teamB.map((entry) => entry.member),
      },
    }
  } catch (error) {
    if (error instanceof TeamCoreError) {
      return { ok: false, code: error.code, message: teamSplitErrorMessage(error.code, members.length) }
    }
    throw error
  }
}
