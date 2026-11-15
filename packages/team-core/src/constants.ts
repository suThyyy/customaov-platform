import type { BalanceLevel, ScoreTable } from "./types.js";

export const DEFAULT_BALANCE_LEVEL: BalanceLevel = "60-40";

export const DEFAULT_TIER_SCORES: ScoreTable = Object.freeze({
  1: 8,
  2: 4,
  3: 2,
  4: 1,
  5: 0.5,
});
