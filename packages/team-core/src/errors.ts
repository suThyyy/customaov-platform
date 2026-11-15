export type TeamCoreErrorCode =
  | "INVALID_PLAYER_LIST"
  | "INVALID_PLAYER_COUNT"
  | "INVALID_PLAYER_ID"
  | "DUPLICATE_PLAYER_ID"
  | "INVALID_MODE"
  | "INVALID_BALANCE_LEVEL"
  | "INVALID_SCORE_TABLE"
  | "MISSING_SCORE"
  | "INVALID_SCORE"
  | "INVALID_RANDOM_SOURCE"
  | "INVARIANT_VIOLATION";

export class TeamCoreError extends Error {
  public readonly code: TeamCoreErrorCode;

  public constructor(code: TeamCoreErrorCode, message: string) {
    super(message);
    this.name = "TeamCoreError";
    this.code = code;
  }
}
