import { describe, expect, it } from "vitest";
import {
  BracketError,
  championOf,
  isFinished,
  matchLabel,
  planBracket,
  recordScore,
  roundName,
  type MatchNode,
} from "./index.js";

function makeRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function makeTeamIds(count: number): string[] {
  return Array.from({ length: count }, (_, idx) => `team-${idx + 1}`);
}

function expectedBracketSize(n: number): { p: number; rounds: number; byes: number } {
  let p = 1;
  let rounds = 0;
  while (p < n) {
    p *= 2;
    rounds += 1;
  }
  return { p, rounds, byes: p - n };
}

function expectedByePositions(roundOneCount: number, byeCount: number): number[] {
  const result: number[] = [];
  for (let k = 0; k < byeCount; k += 1) {
    result.push(
      k % 2 === 0 ? k / 2 : roundOneCount - 1 - Math.floor(k / 2),
    );
  }
  return result;
}

describe("planBracket", () => {
  const sizes = [2, 3, 4, 5, 6, 7, 8, 11, 16] as const;

  it.each(sizes)(
    "tạo đúng số vòng, số bye, không có trận 2 bye và mỗi đội xuất hiện đúng 1 lần (n = %i)",
    (n) => {
      const teamIds = makeTeamIds(n);
      const originalCopy = [...teamIds];
      const { p, rounds, byes } = expectedBracketSize(n);

      const nodes = planBracket(teamIds, makeRng(42 + n));

      // Không sửa input
      expect(teamIds).toEqual(originalCopy);

      // Tổng số trận = P - 1
      expect(nodes).toHaveLength(p - 1);

      // Số vòng chính xác
      const roundSet = new Set(nodes.map((node) => node.round));
      expect(roundSet.size).toBe(rounds);
      expect(Math.max(...roundSet)).toBe(rounds);

      const roundOne = nodes
        .filter((node) => node.round === 1)
        .sort((a, b) => a.position - b.position);
      expect(roundOne).toHaveLength(p / 2);

      // Đúng số bye, không trận nào 2 bye, bye luôn ở slot B theo thứ tự 0, P/2-1, 1, P/2-2...
      const byeMatches = roundOne.filter((node) => node.isBye);
      expect(byeMatches).toHaveLength(byes);
      const expectedByes = new Set(expectedByePositions(p / 2, byes));
      expect(new Set(byeMatches.map((m) => m.position))).toEqual(expectedByes);

      for (const m of roundOne) {
        expect(m.teamA).not.toBeNull();
        if (m.isBye) {
          expect(m.teamB).toBeNull();
          expect(m.winner).toBe(m.teamA);
        } else {
          expect(m.teamB).not.toBeNull();
          expect(m.winner).toBeNull();
        }
      }

      // Mọi đội xuất hiện đúng 1 lần ở vòng 1
      const roundOneTeams: string[] = [];
      for (const m of roundOne) {
        if (m.teamA) roundOneTeams.push(m.teamA);
        if (m.teamB) roundOneTeams.push(m.teamB);
      }
      expect(roundOneTeams).toHaveLength(n);
      expect(new Set(roundOneTeams)).toEqual(new Set(teamIds));

      // Kiểm tra liên kết nextMatchId / nextSlot và đội bye đã vào vòng 2
      const byId = new Map(nodes.map((node) => [node.id, node]));
      for (const node of nodes) {
        if (node.round < rounds) {
          expect(node.nextMatchId).not.toBeNull();
          expect(node.nextSlot).toBe(node.position % 2 === 0 ? "a" : "b");
          const next = byId.get(node.nextMatchId!);
          expect(next).toBeDefined();
          expect(next?.round).toBe(node.round + 1);
          expect(next?.position).toBe(Math.floor(node.position / 2));

          if (node.isBye) {
            expect(node.nextSlot === "a" ? next?.teamA : next?.teamB).toBe(
              node.teamA,
            );
          }
        } else {
          expect(node.nextMatchId).toBeNull();
          expect(node.nextSlot).toBeNull();
        }
      }

      // Không có trận nào từ vòng 2 trở đi bị đánh dấu isBye
      for (const node of nodes.filter((x) => x.round > 1)) {
        expect(node.isBye).toBe(false);
      }
    },
  );

  it("random cố định cho kết quả sắp cặp và vị trí bye xác định", () => {
    const teamIds = makeTeamIds(11);
    const a = planBracket(teamIds, makeRng(12345));
    const b = planBracket(teamIds, makeRng(12345));
    const c = planBracket(teamIds, makeRng(99999));

    const stripIds = (nodes: readonly MatchNode[]) =>
      nodes.map(({ round, position, teamA, teamB, winner, isBye, nextSlot }) => ({
        round,
        position,
        teamA,
        teamB,
        winner,
        isBye,
        nextSlot,
      }));

    expect(stripIds(a)).toEqual(stripIds(b));
    expect(stripIds(a)).not.toEqual(stripIds(c));
  });

  it("báo lỗi khi số đội < 2, trùng đội, rỗng hoặc random không hợp lệ", () => {
    expect(() => planBracket(["only-one"], makeRng(1))).toThrowError(BracketError);
    try {
      planBracket(["only-one"], makeRng(1));
    } catch (err) {
      expect((err as BracketError).code).toBe("INVALID_TEAM_COUNT");
    }

    try {
      planBracket(["a", "a"], makeRng(1));
    } catch (err) {
      expect((err as BracketError).code).toBe("INVALID_TEAMS");
    }

    try {
      planBracket(["a", "  "], makeRng(1));
    } catch (err) {
      expect((err as BracketError).code).toBe("INVALID_TEAMS");
    }

    try {
      planBracket(["a", "b"], () => 1);
    } catch (err) {
      expect((err as BracketError).code).toBe("INVALID_RANDOM");
    }
  });
});

describe("recordScore, championOf, isFinished", () => {
  it("đi hết nhánh 8 đội BO3 tới vô địch, kiểm tra bất biến input", () => {
    const teamIds = makeTeamIds(8);
    // rng trả 0.999999 giữ nguyên thứ tự team-1..team-8
    let nodes = planBracket(teamIds, () => 0.999999);
    const snapshotBefore = structuredClone(nodes);

    expect(championOf(nodes)).toBeNull();
    expect(isFinished(nodes)).toBe(false);

    // Vòng 1 (Tứ kết)
    const r1 = nodes.filter((n) => n.round === 1).sort((a, b) => a.position - b.position);
    nodes = recordScore(nodes, r1[0]!.id, 2, 0, "BO3"); // team-1 thắng
    nodes = recordScore(nodes, r1[1]!.id, 1, 2, "BO3"); // team-4 thắng
    nodes = recordScore(nodes, r1[2]!.id, 2, 1, "BO3"); // team-5 thắng
    nodes = recordScore(nodes, r1[3]!.id, 0, 2, "BO3"); // team-8 thắng

    // Snapshot ban đầu không bị sửa
    expect(snapshotBefore[0]!.scoreA).toBeNull();
    expect(snapshotBefore[0]!.winner).toBeNull();

    // Vòng 2 (Bán kết) đã có đủ đội thắng
    const r2 = nodes.filter((n) => n.round === 2).sort((a, b) => a.position - b.position);
    expect(r2[0]!.teamA).toBe("team-1");
    expect(r2[0]!.teamB).toBe("team-4");
    expect(r2[1]!.teamA).toBe("team-5");
    expect(r2[1]!.teamB).toBe("team-8");

    nodes = recordScore(nodes, r2[0]!.id, 2, 1, "BO3"); // team-1 thắng
    nodes = recordScore(nodes, r2[1]!.id, 2, 0, "BO3"); // team-5 thắng

    expect(championOf(nodes)).toBeNull();
    expect(isFinished(nodes)).toBe(false);

    // Chung kết
    const fin = nodes.find((n) => n.round === 3)!;
    expect(fin.teamA).toBe("team-1");
    expect(fin.teamB).toBe("team-5");
    nodes = recordScore(nodes, fin.id, 1, 2, "BO3"); // team-5 vô địch

    expect(championOf(nodes)).toBe("team-5");
    expect(isFinished(nodes)).toBe(true);
  });

  it("cho phép sửa tỉ số khi trận vòng sau chưa có tỉ số và khoá khi vòng sau đã có tỉ số", () => {
    let nodes = planBracket(makeTeamIds(4), () => 0.999999);
    const r1 = nodes.filter((n) => n.round === 1).sort((a, b) => a.position - b.position);
    const fin = nodes.find((n) => n.round === 2)!;

    // Nhập tỉ số r1[0]: team-1 thắng 2-0
    nodes = recordScore(nodes, r1[0]!.id, 2, 0, "BO3");
    expect(nodes.find((n) => n.id === fin.id)?.teamA).toBe("team-1");

    // Trận r1[1] chưa đấu -> fin chưa đủ 2 đội -> báo MATCH_NOT_READY
    expect(() => recordScore(nodes, fin.id, 2, 0, "BO3")).toThrowError(BracketError);
    try {
      recordScore(nodes, fin.id, 2, 0, "BO3");
    } catch (err) {
      expect((err as BracketError).code).toBe("MATCH_NOT_READY");
    }

    // Sửa tỉ số r1[0] khi fin chưa có tỉ số -> đổi đội thắng sang team-2
    nodes = recordScore(nodes, r1[0]!.id, 1, 2, "BO3");
    expect(nodes.find((n) => n.id === fin.id)?.teamA).toBe("team-2");

    // Nhập tỉ số r1[1] và fin
    nodes = recordScore(nodes, r1[1]!.id, 2, 0, "BO3");
    nodes = recordScore(nodes, fin.id, 2, 1, "BO3");
    expect(championOf(nodes)).toBe("team-2");

    // Bây giờ sửa r1[0] phải báo LOCKED
    try {
      recordScore(nodes, r1[0]!.id, 2, 0, "BO3");
      expect.unreachable("Phải ném lỗi LOCKED");
    } catch (err) {
      expect(err).toBeInstanceOf(BracketError);
      expect((err as BracketError).code).toBe("LOCKED");
    }

    // Chung kết vẫn có thể sửa tỉ số nếu cần
    nodes = recordScore(nodes, fin.id, 0, 2, "BO3");
    expect(championOf(nodes)).toBe("team-3");
  });

  it("từ chối tỉ số sai thể thức BO (INVALID_SCORE), trận bye (MATCH_NOT_READY), trận không tồn tại", () => {
    const nodes = planBracket(makeTeamIds(3), () => 0.999999);
    const byeMatch = nodes.find((n) => n.isBye)!;
    const realMatch = nodes.find((n) => n.round === 1 && !n.isBye)!;

    // Trận bye không thể nhập tỉ số
    try {
      recordScore(nodes, byeMatch.id, 2, 0, "BO3");
      expect.unreachable("Phải ném lỗi MATCH_NOT_READY");
    } catch (err) {
      expect((err as BracketError).code).toBe("MATCH_NOT_READY");
    }

    // Tỉ số sai BO3: 1-0, 2-2, 3-0, -1-2
    for (const [a, b] of [
      [1, 0],
      [2, 2],
      [3, 0],
      [-1, 2],
    ] as const) {
      try {
        recordScore(nodes, realMatch.id, a, b, "BO3");
        expect.unreachable(`Phải báo INVALID_SCORE cho ${a}-${b}`);
      } catch (err) {
        expect((err as BracketError).code).toBe("INVALID_SCORE");
      }
    }

    // Không tìm thấy trận
    try {
      recordScore(nodes, "non-existent-id", 1, 0, "BO1");
      expect.unreachable("Phải báo MATCH_NOT_FOUND");
    } catch (err) {
      expect((err as BracketError).code).toBe("MATCH_NOT_FOUND");
    }
  });
});

describe("roundName và matchLabel", () => {
  it("trả về nhãn tiếng Việt khớp mock", () => {
    expect(roundName(1, 3, "BO3")).toBe("Tứ kết (BO3)");
    expect(roundName(2, 3)).toBe("Bán kết");
    expect(roundName(3, 3)).toBe("Chung kết");
    expect(roundName(3, 3, "BO5")).toBe("Chung kết (BO5)");

    expect(roundName(1, 4, "BO3")).toBe("Vòng 1/8 (BO3)");
    expect(roundName(2, 4)).toBe("Tứ kết");
    expect(roundName(1, 2)).toBe("Bán kết");
    expect(roundName(1, 1)).toBe("Chung kết");

    expect(matchLabel(1, 0, 3)).toBe("Trận 1");
    expect(matchLabel(1, 3, 3)).toBe("Trận 4");
    expect(matchLabel(2, 0, 3)).toBe("Trận 5");
    expect(matchLabel(2, 1, 3)).toBe("Trận 6");
    expect(matchLabel(3, 0, 3)).toBe("Chung kết");
  });
});
