export type RandomSource = () => number;

export type BalanceLevel = "50-50" | "60-40" | "70-30";

export type TeamSplitMode = "random" | "tier" | "rank";

export type ScoreKey = string | number;

/**
 * Values are unknown at the low-level boundary on purpose. The legacy core
 * applies `Number(value) || 1`, including for imported or incomplete data.
 */
export type ScoreTable = Readonly<Record<string, unknown>>;

export interface IdentifiablePlayer {
  readonly id: string;
}

export interface TeamSplitResult<T> {
  readonly teamA: T[];
  readonly teamB: T[];
}

export interface BalancedTeamSplitResult<T> extends TeamSplitResult<T> {
  readonly warning: boolean;
}

export interface BalancedSplitOptions<T> {
  readonly scores: ScoreTable;
  readonly balanceLevel: string;
  readonly getScoreKey: (player: T) => ScoreKey;
  readonly random?: RandomSource;
}

export interface RandomSplit5v5Options {
  readonly mode: "random";
  readonly random?: RandomSource;
}

export interface BalancedSplit5v5Options<T> {
  readonly mode: "tier" | "rank";
  readonly scores: ScoreTable;
  readonly balanceLevel: BalanceLevel;
  readonly getScoreKey: (player: T) => ScoreKey;
  readonly random?: RandomSource;
}

export type SplitTeams5v5Options<T> =
  | RandomSplit5v5Options
  | BalancedSplit5v5Options<T>;

export interface TeamSplit5v5Result<T> extends TeamSplitResult<T> {
  readonly mode: TeamSplitMode;
  readonly warning: boolean;
}
