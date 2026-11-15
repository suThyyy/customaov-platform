import { randomUUID } from "node:crypto";
import { isValidSeriesScore, type Series } from "@customaov/contracts";

export interface MatchNode {
  id: string;
  round: number;
  position: number;
  teamA: string | null;
  teamB: string | null;
  scoreA: number | null;
  scoreB: number | null;
  winner: string | null;
  isBye: boolean;
  nextMatchId: string | null;
  nextSlot: "a" | "b" | null;
}

export type BracketErrorCode =
  | "INVALID_TEAM_COUNT"
  | "INVALID_TEAMS"
  | "INVALID_RANDOM"
  | "MATCH_NOT_FOUND"
  | "INVALID_SCORE"
  | "MATCH_NOT_READY"
  | "LOCKED";

export class BracketError extends Error {
  public readonly code: BracketErrorCode;

  public constructor(code: BracketErrorCode, message: string) {
    super(message);
    this.name = "BracketError";
    this.code = code;
  }
}

function validateTeamIds(teamIds: readonly string[]): void {
  if (!Array.isArray(teamIds) || teamIds.length < 2) {
    throw new BracketError(
      "INVALID_TEAM_COUNT",
      `Cần ít nhất 2 đội để tạo nhánh đấu (nhận ${Array.isArray(teamIds) ? teamIds.length : 0})`,
    );
  }

  const seen = new Set<string>();
  for (const id of teamIds) {
    if (typeof id !== "string" || id.trim().length === 0) {
      throw new BracketError("INVALID_TEAMS", "Mã đội không hợp lệ");
    }
    if (seen.has(id)) {
      throw new BracketError("INVALID_TEAMS", `Trùng mã đội: ${id}`);
    }
    seen.add(id);
  }
}

function fisherYatesShuffle(
  values: readonly string[],
  random: () => number,
): string[] {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const r = random();
    if (!Number.isFinite(r) || r < 0 || r >= 1) {
      throw new BracketError(
        "INVALID_RANDOM",
        "Hàm random phải trả về số hữu hạn trong khoảng [0, 1)",
      );
    }
    const j = Math.floor(r * (i + 1));
    const current = result[i]!;
    result[i] = result[j]!;
    result[j] = current;
  }
  return result;
}

function getByePositions(roundOneMatches: number, byeCount: number): Set<number> {
  const positions = new Set<number>();
  for (let k = 0; k < byeCount; k += 1) {
    const pos =
      k % 2 === 0
        ? k / 2
        : roundOneMatches - 1 - Math.floor(k / 2);
    positions.add(pos);
  }
  return positions;
}

/**
 * Tạo nhánh đấu loại trực tiếp từ danh sách đội.
 * P = luỹ thừa của 2 nhỏ nhất ≥ n; số bye b = P − n.
 * Bye đặt ở slot B của các trận vòng 1 theo thứ tự xen kẽ 0, P/2−1, 1, P/2−2, …
 */
export function planBracket(
  teamIds: readonly string[],
  random: () => number = Math.random,
): MatchNode[] {
  validateTeamIds(teamIds);
  const shuffled = fisherYatesShuffle(teamIds, random);

  const n = shuffled.length;
  let bracketSize = 1;
  let totalRounds = 0;
  while (bracketSize < n) {
    bracketSize *= 2;
    totalRounds += 1;
  }

  const rounds: MatchNode[][] = [];
  for (let round = 1; round <= totalRounds; round += 1) {
    const matchCount = bracketSize / 2 ** round;
    const roundNodes: MatchNode[] = [];
    for (let position = 0; position < matchCount; position += 1) {
      roundNodes.push({
        id: randomUUID(),
        round,
        position,
        teamA: null,
        teamB: null,
        scoreA: null,
        scoreB: null,
        winner: null,
        isBye: false,
        nextMatchId: null,
        nextSlot: null,
      });
    }
    rounds.push(roundNodes);
  }

  for (let r = 0; r < totalRounds - 1; r += 1) {
    const currentRound = rounds[r]!;
    const nextRound = rounds[r + 1]!;
    for (let position = 0; position < currentRound.length; position += 1) {
      const node = currentRound[position]!;
      const nextNode = nextRound[Math.floor(position / 2)]!;
      node.nextMatchId = nextNode.id;
      node.nextSlot = position % 2 === 0 ? "a" : "b";
    }
  }

  const roundOne = rounds[0]!;
  const byeCount = bracketSize - n;
  const byePositions = getByePositions(roundOne.length, byeCount);
  const nodeById = new Map<string, MatchNode>();
  for (const roundNodes of rounds) {
    for (const node of roundNodes) {
      nodeById.set(node.id, node);
    }
  }

  let teamIndex = 0;
  for (let position = 0; position < roundOne.length; position += 1) {
    const node = roundOne[position]!;
    const isBye = byePositions.has(position);
    const teamA = shuffled[teamIndex++]!;
    const teamB = isBye ? null : shuffled[teamIndex++]!;

    node.teamA = teamA;
    node.teamB = teamB;
    node.isBye = isBye;

    if (isBye) {
      node.winner = teamA;
      if (node.nextMatchId !== null && node.nextSlot !== null) {
        const nextNode = nodeById.get(node.nextMatchId);
        if (nextNode) {
          if (node.nextSlot === "a") {
            nextNode.teamA = teamA;
          } else {
            nextNode.teamB = teamA;
          }
        }
      }
    }
  }

  return rounds.flat();
}

/**
 * Ghi nhận hoặc cập nhật tỉ số cho một trận trong nhánh đấu.
 * Trả về mảng `MatchNode[]` mới, không sửa mảng hoặc node đầu vào.
 */
export function recordScore(
  nodes: readonly MatchNode[],
  matchId: string,
  scoreA: number,
  scoreB: number,
  series: Series,
): MatchNode[] {
  const cloned = nodes.map((node) => ({ ...node }));
  const byId = new Map<string, MatchNode>(cloned.map((node) => [node.id, node]));

  const match = byId.get(matchId);
  if (!match) {
    throw new BracketError("MATCH_NOT_FOUND", `Không tìm thấy trận ${matchId}`);
  }

  if (match.isBye || match.teamA === null || match.teamB === null) {
    throw new BracketError(
      "MATCH_NOT_READY",
      "Trận đấu chưa đủ hai đội để nhập tỉ số",
    );
  }

  if (match.nextMatchId !== null) {
    const nextMatch = byId.get(match.nextMatchId);
    if (
      nextMatch &&
      (nextMatch.scoreA !== null ||
        nextMatch.scoreB !== null ||
        nextMatch.winner !== null)
    ) {
      throw new BracketError(
        "LOCKED",
        "Không thể sửa tỉ số khi trận vòng sau đã có tỉ số",
      );
    }
  }

  if (!isValidSeriesScore(series, scoreA, scoreB)) {
    throw new BracketError(
      "INVALID_SCORE",
      `Tỉ số ${scoreA}-${scoreB} không hợp lệ với thể thức ${series}`,
    );
  }

  const winner = scoreA > scoreB ? match.teamA : match.teamB;
  match.scoreA = scoreA;
  match.scoreB = scoreB;
  match.winner = winner;

  if (match.nextMatchId !== null && match.nextSlot !== null) {
    const nextMatch = byId.get(match.nextMatchId);
    if (nextMatch) {
      if (match.nextSlot === "a") {
        nextMatch.teamA = winner;
      } else {
        nextMatch.teamB = winner;
      }
    }
  }

  return cloned;
}

/** Trả về `teamId` của nhà vô địch nếu chung kết đã quyết định, ngược lại `null`. */
export function championOf(nodes: readonly MatchNode[]): string | null {
  if (nodes.length === 0) {
    return null;
  }
  let maxRound = -1;
  for (const node of nodes) {
    if (node.round > maxRound) {
      maxRound = node.round;
    }
  }
  const finalMatch =
    nodes.find((node) => node.round === maxRound && node.position === 0) ??
    nodes.find((node) => node.nextMatchId === null);
  return finalMatch?.winner ?? null;
}

/** Kiểm tra nhánh đấu đã kết thúc (trận chung kết đã có đội thắng) hay chưa. */
export function isFinished(nodes: readonly MatchNode[]): boolean {
  return championOf(nodes) !== null;
}

/** Nhãn tiếng Việt cho vòng đấu, khớp định dạng mock (`"Tứ kết (BO3)"`, `"Bán kết"`, `"Chung kết"`...). */
export function roundName(
  round: number,
  totalRounds: number,
  series?: Series,
): string {
  const remaining = totalRounds - round;
  let base: string;
  if (remaining === 0) {
    base = "Chung kết";
  } else if (remaining === 1) {
    base = "Bán kết";
  } else if (remaining === 2) {
    base = "Tứ kết";
  } else if (remaining >= 3) {
    base = `Vòng 1/${2 ** remaining}`;
  } else {
    base = `Vòng ${round}`;
  }
  return series ? `${base} (${series})` : base;
}

/** Nhãn trận đấu trong nhánh (`"Trận 1"` ... `"Chung kết"`). */
export function matchLabel(
  round: number,
  position: number,
  totalRounds: number,
): string {
  if (round === totalRounds) {
    return "Chung kết";
  }
  const bracketSize = 2 ** totalRounds;
  const offset = bracketSize - 2 ** (totalRounds - round + 1);
  return `Trận ${offset + position + 1}`;
}
