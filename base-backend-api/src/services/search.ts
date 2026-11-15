import { normalizeVi, type SearchResponse } from "@customaov/contracts";
import { asc, sql } from "drizzle-orm";

import type { DbClient } from "../db/client.js";
import { users } from "../db/schema.js";
import { listRooms, toUserSummary } from "./rooms.js";
import { listTournaments } from "./tournaments.js";
import { HttpError } from "./users.js";

/** Số kết quả tối đa mỗi nhóm (API.md mục 6). */
export const SEARCH_LIMIT = 5;
/** Độ dài tối thiểu của `q` sau khi trim + chuẩn hoá. */
export const SEARCH_MIN_LENGTH = 2;

/** Escape ký tự đặc biệt của LIKE (`\`, `%`, `_`) để `q` chỉ được so khớp như chuỗi thường. */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

/**
 * Tìm kiếm toàn cục: tối đa 5 phòng (public + phòng mình là thành viên), 5 giải, 5 người dùng.
 * So khớp không dấu, không phân biệt hoa thường qua cột `search_text` (đã chuẩn hoá bằng `normalizeVi`).
 */
export async function searchAll(
  db: DbClient,
  rawQuery: string,
  currentUserId: string | null,
): Promise<SearchResponse> {
  const normalized = normalizeVi(rawQuery.trim());
  if (normalized.length < SEARCH_MIN_LENGTH) {
    throw new HttpError(400, "VALIDATION", "Từ khoá tìm kiếm cần ít nhất 2 ký tự");
  }

  // Phòng và giải dùng lại hàm liệt kê sẵn có (cùng luật xem phòng private, cùng cách escape LIKE).
  const [roomPage, tournamentPage, userRows] = await Promise.all([
    listRooms(db, { q: normalized, page: 1, pageSize: SEARCH_LIMIT }, currentUserId),
    listTournaments(db, { q: normalized, page: 1, pageSize: SEARCH_LIMIT }),
    db
      .select()
      .from(users)
      .where(sql`${users.searchText} LIKE ${`%${escapeLike(normalized)}%`} ESCAPE '\\'`)
      .orderBy(asc(users.username))
      .limit(SEARCH_LIMIT),
  ]);

  return {
    rooms: roomPage.items,
    tournaments: tournamentPage.items,
    users: userRows.map(toUserSummary),
  };
}
