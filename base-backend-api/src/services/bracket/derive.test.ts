import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  BracketRoundSchema,
  ScheduledMatchSchema,
  type Series,
  type Team,
} from "@customaov/contracts";

import {
  podium as fePodium,
  standings as feStandings,
} from "../../../../base-frontend-web/src/lib/tournament.js";
import {
  allMatches as feAllMatches,
  getTournamentDetail,
} from "../../../../base-frontend-web/src/mocks/tournaments.js";
import {
  derive,
  planBracket,
  recordScore,
  type MatchNode,
} from "./index.js";

function makeTeams(count: number, useUuid = false): Team[] {
  return Array.from({ length: count }, (_, idx) => ({
    id: useUuid ? randomUUID() : `team-${idx + 1}`,
    name: `Đội ${idx + 1}`,
    logo: `/mock-assets/team-${idx + 1}.png`,
  }));
}

function getMatchesByRound(nodes: readonly MatchNode[]): MatchNode[][] {
  const maxRound = Math.max(...nodes.map((n) => n.round));
  return Array.from({ length: maxRound }, (_, r) =>
    nodes
      .filter((n) => n.round === r + 1)
      .sort((a, b) => a.position - b.position),
  );
}

describe("derive", () => {
  it("trả về nhánh rỗng và trạng thái Đã đăng ký khi chưa bốc thăm", () => {
    const teams = makeTeams(4);
    const result = derive([], teams, {});

    expect(result.bracket).toEqual([]);
    expect(result.upcoming).toEqual([]);
    expect(result.results).toEqual([]);
    expect(result.champion).toBeNull();
    expect(result.teamStanding).toHaveLength(4);
    expect(
      result.teamStanding.every((s) => s.label === "Đã đăng ký" && s.tone === "neutral"),
    ).toBe(true);
  });

  it("xử lý đúng slot bye, TBD, bỏ qua bye/TBD khỏi upcoming/results và định dạng lịch mặc định", () => {
    const teams = makeTeams(5, true); // P = 8, 3 byes ở pos 0, 3, 1
    let nodes = planBracket(
      teams.map((t) => t.id),
      () => 0.999999,
    );
    const rounds = getMatchesByRound(nodes);
    const r1 = rounds[0]!;
    const r2 = rounds[1]!;

    // Chỉ gán lịch cho trận 3 ở vòng 1 (trận thật duy nhất ở vòng 1) và bán kết 1
    const schedule = new Map<string, string | Date | null>([
      [r1[2]!.id, new Date("2026-11-20T19:30:00+07:00")],
      [r2[0]!.id, "2026-11-21T20:00:00+07:00"],
      [r2[1]!.id, null],
    ]);

    const d1 = derive(nodes, teams, schedule, { series: "BO3" });

    // Kiểm tra schema hợp đồng @customaov/contracts
    expect(() => BracketRoundSchema.array().parse(d1.bracket)).not.toThrow();
    expect(() => ScheduledMatchSchema.array().parse(d1.upcoming)).not.toThrow();
    expect(() => ScheduledMatchSchema.array().parse(d1.results)).not.toThrow();

    // Vòng 1 có 3 trận bye (pos 0, 1, 3): slot B phải là { team: null, score: null, bye: true }
    const bR1 = d1.bracket[0]!.matches;
    expect(bR1[0]!.slots[1]).toEqual({ team: null, score: null, bye: true });
    expect(bR1[0]!.slots[0].bye).toBe(false);
    expect(bR1[0]!.slots[0].team?.id).toBe(teams[0]!.id);

    // Vòng 2: pos 0 có đủ 2 đội bye, pos 1 có slot A là TBD ({ team: null, score: null, bye: false })
    const bR2 = d1.bracket[1]!.matches;
    expect(bR2[0]!.slots[0].team?.id).toBe(teams[0]!.id);
    expect(bR2[0]!.slots[1].team?.id).toBe(teams[1]!.id);
    expect(bR2[0]!.time).toBe("21/11 20:00");
    expect(bR2[1]!.slots[0]).toEqual({ team: null, score: null, bye: false });
    expect(bR2[1]!.slots[1].team?.id).toBe(teams[4]!.id);
    expect(bR2[1]!.time).toBe("Chưa xếp lịch");

    // Vòng 3 (Chung kết): cả 2 slot TBD
    const bR3 = d1.bracket[2]!.matches[0]!;
    expect(bR3.slots[0]).toEqual({ team: null, score: null, bye: false });
    expect(bR3.slots[1]).toEqual({ team: null, score: null, bye: false });
    expect(bR3.time).toBe("Chưa xếp lịch");

    // upcoming chỉ gồm các trận đủ 2 đội & không phải bye: r1[2] và r2[0]
    expect(d1.upcoming).toHaveLength(2);
    expect(d1.upcoming.map((m) => m.id)).toEqual([r1[2]!.id, r2[0]!.id]);
    expect(d1.upcoming[0]!.time).toBe("20/11 19:30");
    expect(d1.upcoming[1]!.time).toBe("21/11 20:00");
    expect(d1.results).toHaveLength(0);

    // Đấu trận r1[2]: đội 3 thắng 2-0 -> mở khóa r2[1]
    nodes = recordScore(nodes, r1[2]!.id, 2, 0, "BO3");
    const d2 = derive(nodes, teams, schedule, { series: "BO3" });
    expect(d2.results).toHaveLength(1);
    expect(d2.upcoming).toHaveLength(2); // r2[0] và r2[1]
    expect(d2.upcoming.map((m) => m.id)).toEqual([r2[0]!.id, r2[1]!.id]);
    expect(d2.upcoming[1]!.time).toBe("Chưa xếp lịch");
  });

  it("không làm biến đổi mảng nodes, teams hay schedule đầu vào", () => {
    const teams = makeTeams(4);
    const nodes = planBracket(
      teams.map((t) => t.id),
      () => 0.999999,
    );
    const nodesSnap = structuredClone(nodes);
    const teamsSnap = structuredClone(teams);
    const schedule = { [nodes[0]!.id]: "15/11 19:00" };

    const out = derive(nodes, teams, schedule);
    out.bracket[0]!.matches[0]!.slots[0].team!.name = "Bị sửa";

    expect(nodes).toEqual(nodesSnap);
    expect(teams).toEqual(teamsSnap);
  });

  it("dựng lại 3 giải mẫu từ engine và khớp kết quả với lib/tournament.ts", () => {
    const cases: Array<{
      slug: string;
      roundSeries: (round: number) => Series;
      /** Thứ tự đội vào vòng 1 (nếu khác teamList) */
      entrantsOrder?: string[];
      /** Tỉ số theo từng vòng [ [scoreA, scoreB] | null ] */
      scoresByRound: Array<Array<[number, number] | null>>;
      timesByRound: Array<string[]>;
    }> = [
      {
        slug: "custom-league-3",
        roundSeries: (r) => (r === 3 ? "BO5" : "BO3"),
        scoresByRound: [
          [
            [2, 0],
            [2, 1],
            [1, 2],
            [0, 2],
          ],
          [
            [2, 1],
            [0, 2],
          ],
          [null],
        ],
        timesByRound: [
          ["13/11 19:00", "13/11 20:30", "14/11 19:00", "14/11 20:30"],
          ["15/11 14:00", "15/11 16:00"],
          ["24/11 20:00"],
        ],
      },
      {
        slug: "hoi-lang-keo-vui",
        roundSeries: (r) => (r === 1 ? "BO1" : r === 2 ? "BO3" : "BO5"),
        entrantsOrder: [
          "nguho",
          "shadow",
          "haiphong",
          "rongthan",
          "alpha",
          "xanh",
          "do",
          "aovelite",
        ],
        scoresByRound: [
          [
            [1, 0],
            [0, 1],
            [1, 0],
            [1, 0],
          ],
          [
            [2, 1],
            [1, 2],
          ],
          [[3, 1]],
        ],
        timesByRound: [
          ["08/11 19:00", "08/11 20:00", "09/11 19:00", "09/11 20:00"],
          ["11/11 19:00", "11/11 20:30"],
          ["12/11 20:00"],
        ],
      },
      {
        slug: "cup-mua-thu-2026",
        roundSeries: (r) => (r === 3 ? "BO5" : "BO3"),
        scoresByRound: [
          [
            [2, 0],
            [2, 1],
            [2, 0],
            [1, 2],
          ],
          [
            [2, 0],
            [2, 1],
          ],
          [[3, 0]],
        ],
        timesByRound: [
          ["25/10 19:00", "25/10 20:30", "26/10 19:00", "26/10 20:30"],
          ["01/11 19:00", "01/11 20:30"],
          ["02/11 20:00"],
        ],
      },
    ];

    for (const c of cases) {
      const fe = getTournamentDetail(c.slug);
      if (!fe) throw new Error(`Missing mock tournament: ${c.slug}`);

      const entrants = c.entrantsOrder ?? fe.teamList.map((t) => t.id);
      let nodes = planBracket(entrants, () => 0.999999);
      const schedule: Record<string, string> = {};

      for (let rIdx = 0; rIdx < c.scoresByRound.length; rIdx += 1) {
        const round = rIdx + 1;
        const series = c.roundSeries(round);
        const matches = nodes
          .filter((n) => n.round === round)
          .sort((a, b) => a.position - b.position);

        for (let pos = 0; pos < matches.length; pos += 1) {
          const match = matches[pos]!;
          schedule[match.id] = c.timesByRound[rIdx]![pos]!;
          const score = c.scoresByRound[rIdx]![pos];
          if (score) {
            nodes = recordScore(nodes, match.id, score[0], score[1], series);
          }
        }
      }

      const derived = derive(nodes, fe.teamList, schedule, {
        series: (r) => c.roundSeries(r),
      });

      // Cùng nhà vô địch với podium(fe)
      const expectedChampion = fePodium(fe)?.champion ?? null;
      expect(derived.champion?.id ?? null).toBe(expectedChampion?.id ?? null);
      expect(derived.champion?.name ?? null).toBe(expectedChampion?.name ?? null);

      // Cùng số trận upcoming / results (so với nhánh đấu của frontend)
      const feBracketMatches = feAllMatches(fe);
      const feUpcoming = feBracketMatches.filter((m) => !m.score);
      const feResults = feBracketMatches.filter((m) => m.score).reverse();

      expect(derived.upcoming).toHaveLength(feUpcoming.length);
      expect(derived.results).toHaveLength(feResults.length);
      expect(derived.results).toHaveLength(fe.results.length);

      // Cùng tên vòng và cấu trúc trận
      expect(derived.bracket.map((r) => r.name)).toEqual(
        fe.bracket.map((r) => r.name),
      );

      // Cùng xếp hạng đội (standings)
      const expectedStandings = feStandings(fe).map((s) => ({
        teamId: s.team.id,
        label: s.label,
        tone: s.tone,
      }));
      const actualStandings = derived.teamStanding.map((s) => ({
        teamId: s.team.id,
        label: s.label,
        tone: s.tone,
      }));
      expect(actualStandings).toEqual(expectedStandings);
    }
  });
});
