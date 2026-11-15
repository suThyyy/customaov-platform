import { TeamCoreError } from "./errors.js";
import type {
  BalanceLevel,
  BalancedSplitOptions,
  BalancedTeamSplitResult,
  IdentifiablePlayer,
  RandomSource,
  ScoreKey,
  ScoreTable,
  SplitTeams5v5Options,
  TeamSplit5v5Result,
  TeamSplitMode,
  TeamSplitResult,
} from "./types.js";

const BALANCE_RANGES = {
  "50-50": [48, 52],
  "60-40": [40, 60],
  "70-30": [30, 70],
} as const satisfies Record<BalanceLevel, readonly [number, number]>;

function randomIndex(size: number, random: RandomSource): number {
  return Math.floor(random() * size);
}

function shuffle<T>(values: readonly T[], random: RandomSource): T[] {
  const result = [...values];

  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    const current = result[index]!;
    result[index] = result[swapIndex]!;
    result[swapIndex] = current;
  }

  return result;
}

function generateCombinations<T>(values: readonly T[], size: number): T[][] {
  const combinations: T[][] = [];

  function visit(start: number, current: T[]): void {
    if (current.length === size) {
      combinations.push([...current]);
      return;
    }

    for (
      let index = start;
      index <= values.length - (size - current.length);
      index += 1
    ) {
      current.push(values[index]!);
      visit(index + 1, current);
      current.pop();
    }
  }

  visit(0, []);
  return combinations;
}

function legacyEffectiveScore(scores: ScoreTable, key: ScoreKey): number {
  return Number(scores[String(key)]) || 1;
}

/**
 * Low-level parity API. It intentionally accepts any list length because the
 * legacy core did; use splitTeams5v5 at the React/application boundary.
 */
export function splitRandom<T>(
  players: readonly T[],
  random: RandomSource = Math.random,
): TeamSplitResult<T> {
  const shuffled = shuffle(players, random);
  const teamASize = Math.floor(players.length / 2);

  return {
    teamA: shuffled.slice(0, teamASize),
    teamB: shuffled.slice(teamASize),
  };
}

/**
 * Low-level parity API for the legacy tier/rank balancing algorithm.
 * Invalid balance-level strings fall back to the legacy 40..60 window.
 */
export function splitBalanced<T>(
  players: readonly T[],
  options: BalancedSplitOptions<T>,
): BalancedTeamSplitResult<T> {
  const playerCount = players.length;
  const teamASize = Math.floor(playerCount / 2);
  const random = options.random ?? Math.random;
  const power = players.map((player) =>
    legacyEffectiveScore(options.scores, options.getScoreKey(player)),
  );
  const totalPower = power.reduce((total, score) => total + score, 0);
  const indices = players.map((_, index) => index);
  const combinations = generateCombinations(indices, teamASize);
  const configuredRange = BALANCE_RANGES[options.balanceLevel as BalanceLevel];
  let lowerBound = configuredRange?.[0] ?? 40;
  let upperBound = configuredRange?.[1] ?? 60;
  let candidates: number[][] = [];

  for (let attempt = 0; attempt <= 3; attempt += 1) {
    candidates = combinations.filter((combination) => {
      const teamAPower = combination.reduce(
        (total, index) => total + power[index]!,
        0,
      );
      const teamAPercent = (teamAPower / totalPower) * 100;
      return teamAPercent >= lowerBound && teamAPercent <= upperBound;
    });

    if (candidates.length > 0) {
      break;
    }

    lowerBound -= 5;
    upperBound += 5;
  }

  let teamAIndices: readonly number[] | null = null;
  let warning = false;

  if (candidates.length > 0) {
    teamAIndices = candidates[randomIndex(candidates.length, random)] ?? null;
  } else {
    warning = true;
    let bestDifference = Number.POSITIVE_INFINITY;

    for (const combination of combinations) {
      const teamAPower = combination.reduce(
        (total, index) => total + power[index]!,
        0,
      );
      const difference = Math.abs((teamAPower / totalPower) * 100 - 50);

      if (difference < bestDifference) {
        bestDifference = difference;
        teamAIndices = combination;
      }
    }
  }

  const teamAIndexSet = new Set(teamAIndices ?? []);

  return {
    teamA: players.filter((_, index) => teamAIndexSet.has(index)),
    teamB: players.filter((_, index) => !teamAIndexSet.has(index)),
    warning,
  };
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isBalanceLevel(value: unknown): value is BalanceLevel {
  return (
    value === "50-50" || value === "60-40" || value === "70-30"
  );
}

function validatePlayers5v5<T extends IdentifiablePlayer>(
  players: readonly T[],
): void {
  if (!Array.isArray(players)) {
    throw new TeamCoreError("INVALID_PLAYER_LIST", "players must be an array");
  }

  if (players.length !== 10) {
    throw new TeamCoreError(
      "INVALID_PLAYER_COUNT",
      `A 5v5 split requires exactly 10 players; received ${players.length}`,
    );
  }

  const playerIds = new Set<string>();

  for (const [index, player] of players.entries()) {
    if (
      typeof player !== "object" ||
      player === null ||
      typeof player.id !== "string" ||
      player.id.trim().length === 0
    ) {
      throw new TeamCoreError(
        "INVALID_PLAYER_ID",
        `Player at index ${index} must have a non-empty string id`,
      );
    }

    if (playerIds.has(player.id)) {
      throw new TeamCoreError(
        "DUPLICATE_PLAYER_ID",
        `Duplicate player id: ${player.id}`,
      );
    }

    playerIds.add(player.id);
  }
}

function checkedRandom(source: RandomSource | undefined): RandomSource {
  const random = source ?? Math.random;

  return () => {
    const value = random();

    if (!Number.isFinite(value) || value < 0 || value >= 1) {
      throw new TeamCoreError(
        "INVALID_RANDOM_SOURCE",
        "random must return a finite number in the range [0, 1)",
      );
    }

    return value;
  };
}

function validateBalancedOptions<T extends IdentifiablePlayer>(
  players: readonly T[],
  mode: "tier" | "rank",
  scores: unknown,
  balanceLevel: unknown,
  getScoreKey: unknown,
): asserts scores is ScoreTable {
  if (!isRecord(scores)) {
    throw new TeamCoreError("INVALID_SCORE_TABLE", "scores must be an object");
  }

  if (!isBalanceLevel(balanceLevel)) {
    throw new TeamCoreError(
      "INVALID_BALANCE_LEVEL",
      `Unsupported balance level: ${String(balanceLevel)}`,
    );
  }

  if (typeof getScoreKey !== "function") {
    throw new TeamCoreError(
      "MISSING_SCORE",
      "Balanced mode requires getScoreKey",
    );
  }

  const selectScoreKey = getScoreKey as (player: T) => ScoreKey;

  for (const player of players) {
    const key = String(selectScoreKey(player));

    if (!Object.prototype.hasOwnProperty.call(scores, key)) {
      throw new TeamCoreError(
        "MISSING_SCORE",
        `Missing ${mode} score for player ${player.id} (key: ${key})`,
      );
    }

    const score = scores[key];
    const isValidTierScore =
      mode === "tier" &&
      typeof score === "number" &&
      Number.isFinite(score) &&
      score >= 0;
    const isValidRankScore =
      mode === "rank" &&
      typeof score === "number" &&
      Number.isFinite(score) &&
      score > 0;

    if (!isValidTierScore && !isValidRankScore) {
      throw new TeamCoreError(
        "INVALID_SCORE",
        `Invalid ${mode} score for key ${key}`,
      );
    }
  }
}

/**
 * Application boundary for the current customAOV 5v5 flow.
 * It validates the rules previously enforced by script.js before delegating
 * to the behavior-preserving low-level split functions.
 */
export function splitTeams5v5<T extends IdentifiablePlayer>(
  players: readonly T[],
  options: SplitTeams5v5Options<T>,
): TeamSplit5v5Result<T> {
  validatePlayers5v5(players);

  const runtimeOptions: unknown = options;
  const mode = isRecord(runtimeOptions) ? runtimeOptions.mode : undefined;

  if (mode !== "random" && mode !== "tier" && mode !== "rank") {
    throw new TeamCoreError(
      "INVALID_MODE",
      `Unsupported team split mode: ${String(mode)}`,
    );
  }

  if (mode === "random") {
    const randomOptions = options as Extract<
      SplitTeams5v5Options<T>,
      { readonly mode: "random" }
    >;
    const result = splitRandom(players, checkedRandom(randomOptions.random));
    return { ...result, mode, warning: false };
  }

  const balancedOptions = options as Extract<
    SplitTeams5v5Options<T>,
    { readonly mode: "tier" | "rank" }
  >;

  validateBalancedOptions(
    players,
    mode,
    balancedOptions.scores,
    balancedOptions.balanceLevel,
    balancedOptions.getScoreKey,
  );

  const result = splitBalanced(players, {
    scores: balancedOptions.scores,
    balanceLevel: balancedOptions.balanceLevel,
    getScoreKey: balancedOptions.getScoreKey,
    random: checkedRandom(balancedOptions.random),
  });

  if (result.teamA.length !== 5 || result.teamB.length !== 5) {
    throw new TeamCoreError(
      "INVARIANT_VIOLATION",
      "The split algorithm did not produce two five-player teams",
    );
  }

  return { ...result, mode };
}

export function isTeamSplitMode(value: unknown): value is TeamSplitMode {
  return value === "random" || value === "tier" || value === "rank";
}
