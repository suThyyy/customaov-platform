import type {
  BracketMatch,
  BracketRound,
  BracketSlot,
  ScheduledMatch,
  Series,
  Team,
} from "@customaov/contracts";

import {
  championOf,
  matchLabel,
  roundName,
  type MatchNode,
} from "./engine.js";

export type ScheduleValue = string | Date | null | undefined;
export type ScheduleInput =
  | Readonly<Record<string, ScheduleValue>>
  | ReadonlyMap<string, ScheduleValue>;

export type StandingTone = "gold" | "success" | "neutral" | "muted";

export interface Standing {
  team: Team;
  label: string;
  tone: StandingTone;
  order: number;
}

export interface DeriveOptions {
  series?: Series | ((round: number, totalRounds: number) => Series);
}

export interface DerivedBracket {
  bracket: BracketRound[];
  upcoming: ScheduledMatch[];
  results: ScheduledMatch[];
  champion: Team | null;
  teamStanding: Standing[];
}

const UNSCHEDULED_LABEL = "Chưa xếp lịch";
const ISO_DATETIME_PREFIX_RE = /^\d{4}-\d{2}-\d{2}T/;

function lookupSchedule(
  schedule: ScheduleInput | undefined,
  matchId: string,
): ScheduleValue {
  if (!schedule) {
    return undefined;
  }
  if (schedule instanceof Map) {
    return (schedule as ReadonlyMap<string, ScheduleValue>).get(matchId);
  }
  return (schedule as Readonly<Record<string, ScheduleValue>>)[matchId];
}

function formatVietnamDateTime(date: Date): string {
  if (Number.isNaN(date.getTime())) {
    return UNSCHEDULED_LABEL;
  }
  // Asia/Ho_Chi_Minh cố định UTC+7, không có DST
  const vn = new Date(date.getTime() + 7 * 60 * 60 * 1000);
  const dd = String(vn.getUTCDate()).padStart(2, "0");
  const mm = String(vn.getUTCMonth() + 1).padStart(2, "0");
  const hh = String(vn.getUTCHours()).padStart(2, "0");
  const min = String(vn.getUTCMinutes()).padStart(2, "0");
  return `${dd}/${mm} ${hh}:${min}`;
}

function formatMatchTime(value: ScheduleValue): string {
  if (value === null || value === undefined) {
    return UNSCHEDULED_LABEL;
  }
  if (value instanceof Date) {
    return formatVietnamDateTime(value);
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return UNSCHEDULED_LABEL;
  }
  if (ISO_DATETIME_PREFIX_RE.test(trimmed)) {
    return formatVietnamDateTime(new Date(trimmed));
  }
  return trimmed;
}

function resolveRoundSeries(
  options: DeriveOptions | undefined,
  round: number,
  totalRounds: number,
): Series | undefined {
  if (!options?.series) {
    return undefined;
  }
  return typeof options.series === "function"
    ? options.series(round, totalRounds)
    : options.series;
}

function buildSlot(
  teamId: string | null,
  score: number | null,
  isByeSlot: boolean,
  teamById: ReadonlyMap<string, Team>,
): BracketSlot {
  if (isByeSlot) {
    return { team: null, score: null, bye: true };
  }
  const team = teamId ? (teamById.get(teamId) ?? null) : null;
  return {
    team: team ? { ...team } : null,
    score,
    bye: false,
  };
}

function computeStandings(
  rounds: ReadonlyArray<{ round: number; matches: readonly MatchNode[] }>,
  totalRounds: number,
  teams: readonly Team[],
): Standing[] {
  const result = teams.map((team, idx): Standing => {
    let label = "Đã đăng ký";
    let tone: StandingTone = "neutral";
    let order = 100 + idx;

    for (let r = 0; r < rounds.length; r += 1) {
      const roundGroup = rounds[r]!;
      const isFinal = r === rounds.length - 1;
      const roundBaseLower = roundName(roundGroup.round, totalRounds).toLowerCase();

      for (const node of roundGroup.matches) {
        if (node.teamA !== team.id && node.teamB !== team.id) {
          continue;
        }
        if (node.isBye) {
          continue;
        }
        const decided = node.scoreA !== null && node.scoreB !== null;
        if (!decided) {
          label = isFinal ? "Vào chung kết" : "Đang thi đấu";
          tone = "success";
          order = isFinal ? 2 : 10 + idx;
          continue;
        }
        const won =
          node.winner !== null
            ? node.winner === team.id
            : node.teamA === team.id
              ? node.scoreA! > node.scoreB!
              : node.scoreB! > node.scoreA!;
        if (isFinal) {
          label = won ? "Vô địch" : "Á quân";
          tone = won ? "gold" : "success";
          order = won ? 0 : 1;
        } else if (!won) {
          label = `Dừng ở ${roundBaseLower}`;
          tone = "muted";
          order = 50 - r * 10 + idx / 100;
        }
      }
    }

    return {
      team: { ...team },
      label,
      tone,
      order,
    };
  });

  return result.sort((a, b) => a.order - b.order);
}

/**
 * Suy ra toàn bộ dữ liệu hiển thị (`bracket`, `upcoming`, `results`, `champion`, `teamStanding`)
 * từ danh sách `MatchNode`, danh sách `Team`, và lịch thi đấu.
 * Không sửa bất kỳ đối tượng đầu vào nào.
 */
export function derive(
  nodes: readonly MatchNode[],
  teams: readonly Team[],
  schedule: ScheduleInput = {},
  options?: DeriveOptions,
): DerivedBracket {
  const teamById = new Map<string, Team>(teams.map((t) => [t.id, t]));

  if (nodes.length === 0) {
    return {
      bracket: [],
      upcoming: [],
      results: [],
      champion: null,
      teamStanding: computeStandings([], 0, teams),
    };
  }

  const sortedNodes = [...nodes].sort(
    (a, b) => a.round - b.round || a.position - b.position,
  );
  let totalRounds = 0;
  for (const node of sortedNodes) {
    if (node.round > totalRounds) {
      totalRounds = node.round;
    }
  }

  const roundMap = new Map<number, MatchNode[]>();
  for (const node of sortedNodes) {
    const list = roundMap.get(node.round);
    if (list) {
      list.push(node);
    } else {
      roundMap.set(node.round, [node]);
    }
  }

  const groupedRounds = Array.from(roundMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([round, matches]) => ({ round, matches }));

  const bracket: BracketRound[] = [];
  const upcoming: ScheduledMatch[] = [];
  const results: ScheduledMatch[] = [];

  for (const group of groupedRounds) {
    const series = resolveRoundSeries(options, group.round, totalRounds);
    const rName = roundName(group.round, totalRounds, series);
    const baseRoundName = roundName(group.round, totalRounds);

    const bracketMatches: BracketMatch[] = group.matches.map((node) => {
      const label = matchLabel(node.round, node.position, totalRounds);
      const time = formatMatchTime(lookupSchedule(schedule, node.id));
      const slotABye = node.isBye && node.teamA === null;
      const slotBBye = node.isBye && node.teamB === null;

      const slotA = buildSlot(node.teamA, node.scoreA, slotABye, teamById);
      const slotB = buildSlot(node.teamB, node.scoreB, slotBBye, teamById);

      if (!node.isBye && slotA.team !== null && slotB.team !== null) {
        const stage =
          label === baseRoundName
            ? baseRoundName
            : `${baseRoundName} · ${label}`;
        if (node.scoreA !== null && node.scoreB !== null) {
          results.push({
            id: node.id,
            stage,
            time,
            home: { ...slotA.team },
            away: { ...slotB.team },
            score: [node.scoreA, node.scoreB],
          });
        } else {
          upcoming.push({
            id: node.id,
            stage,
            time,
            home: { ...slotA.team },
            away: { ...slotB.team },
          });
        }
      }

      return {
        id: node.id,
        label,
        time,
        slots: [slotA, slotB],
      };
    });

    bracket.push({
      name: rName,
      matches: bracketMatches,
    });
  }

  results.reverse();

  const champId = championOf(sortedNodes);
  const champTeam = champId ? (teamById.get(champId) ?? null) : null;

  return {
    bracket,
    upcoming,
    results,
    champion: champTeam ? { ...champTeam } : null,
    teamStanding: computeStandings(groupedRounds, totalRounds, teams),
  };
}
