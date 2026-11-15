import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_BALANCE_LEVEL,
  DEFAULT_TIER_SCORES,
  TeamCoreError,
  splitBalanced,
  splitRandom,
  splitTeams5v5,
} from "../src/index.js";
import type {
  SplitTeams5v5Options,
  TeamCoreErrorCode,
} from "../src/index.js";

interface Player {
  readonly id: string;
  readonly name: string;
  readonly tier: number;
  readonly rankTier: string;
}

function makePlayers(count: number, tier = 3): Player[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `p${index + 1}`,
    name: `Player ${index + 1}`,
    tier,
    rankTier: `rank-${index + 1}`,
  }));
}

function sequenceRandom(values: readonly number[]): () => number {
  let index = 0;
  return () => {
    const value = values[index % values.length];
    index += 1;
    return value ?? 0;
  };
}

function ids(players: readonly Player[]): string[] {
  return players.map((player) => player.id);
}

function expectTeamCoreError(
  code: TeamCoreErrorCode,
  action: () => unknown,
): void {
  assert.throws(action, (error: unknown) => {
    assert.ok(error instanceof TeamCoreError);
    assert.equal(error.code, code);
    return true;
  });
}

test("random split matches the deterministic legacy characterization", () => {
  const players = makePlayers(10);
  const originalOrder = ids(players);
  const result = splitRandom(
    players,
    sequenceRandom([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]),
  );

  assert.deepEqual(ids(result.teamA), ["p1", "p9", "p5", "p7", "p6"]);
  assert.deepEqual(ids(result.teamB), ["p4", "p8", "p3", "p10", "p2"]);
  assert.deepEqual(ids(players), originalOrder, "input must not be mutated");
});

test("random split preserves legacy empty, odd, and larger-list behavior", () => {
  assert.deepEqual(splitRandom([], () => 0), { teamA: [], teamB: [] });

  const threePlayers = splitRandom(makePlayers(3), () => 0);
  assert.equal(threePlayers.teamA.length, 1);
  assert.equal(threePlayers.teamB.length, 2);

  const elevenPlayers = splitRandom(makePlayers(11), () => 0);
  assert.equal(elevenPlayers.teamA.length, 5);
  assert.equal(elevenPlayers.teamB.length, 6);
});

test("balanced split matches the deterministic legacy characterization", () => {
  const tiers = [1, 1, 1, 2, 2, 2, 3, 3, 4, 5];
  const players = makePlayers(10).map((player, index) => ({
    ...player,
    tier: tiers[index]!,
  }));

  const result = splitBalanced(players, {
    scores: { 1: 8, 2: 4, 3: 2, 4: 1, 5: 0.5 },
    balanceLevel: "50-50",
    getScoreKey: (player) => player.tier,
    random: () => 0,
  });

  assert.deepEqual(ids(result.teamA), ["p1", "p2", "p4", "p9", "p10"]);
  assert.deepEqual(ids(result.teamB), ["p3", "p5", "p6", "p7", "p8"]);
  assert.equal(result.warning, false);
});

test("balanced split respects all three configured balance windows", () => {
  const tiers = [1, 1, 1, 2, 2, 2, 3, 3, 4, 5];
  const players = makePlayers(10).map((player, index) => ({
    ...player,
    tier: tiers[index]!,
  }));
  const scores = { 1: 8, 2: 4, 3: 2, 4: 1, 5: 0.5 } as const;

  for (const [balanceLevel, lowerBound, upperBound] of [
    ["50-50", 48, 52],
    ["60-40", 40, 60],
    ["70-30", 30, 70],
  ] as const) {
    const result = splitBalanced(players, {
      scores,
      balanceLevel,
      getScoreKey: (player) => player.tier,
      random: () => 0,
    });
    const teamAPower = result.teamA.reduce(
      (total, player) => total + scores[player.tier as keyof typeof scores],
      0,
    );
    const totalPower = players.reduce(
      (total, player) => total + scores[player.tier as keyof typeof scores],
      0,
    );
    const teamAPercent = (teamAPower / totalPower) * 100;

    assert.ok(teamAPercent >= lowerBound);
    assert.ok(teamAPercent <= upperBound);
  }
});

test("balanced split uses the nearest legacy fallback and warning", () => {
  const players = makePlayers(10).map((player, index) => ({
    ...player,
    tier: index === 0 ? 1 : 2,
  }));
  const result = splitBalanced(players, {
    scores: { 1: 100, 2: 0 },
    balanceLevel: "50-50",
    getScoreKey: (player) => player.tier,
    random: () => 0,
  });

  assert.deepEqual(ids(result.teamA), ["p1", "p2", "p3", "p4", "p5"]);
  assert.deepEqual(ids(result.teamB), ["p6", "p7", "p8", "p9", "p10"]);
  assert.equal(result.warning, true);
});

test("balanced split preserves missing, zero, invalid-score, and invalid-level fallbacks", () => {
  const players = makePlayers(10, 9);

  for (const scores of [{}, { 9: 0 }, { 9: "invalid" }]) {
    const result = splitBalanced(players, {
      scores,
      balanceLevel: "50-50",
      getScoreKey: (player) => player.tier,
      random: () => 0,
    });

    assert.equal(result.teamA.length, 5);
    assert.equal(result.teamB.length, 5);
    assert.equal(result.warning, false);
  }

  const invalidLevelResult = splitBalanced(players, {
    scores: { 9: 1 },
    balanceLevel: "unsupported",
    getScoreKey: (player) => player.tier,
    random: () => 0,
  });
  assert.equal(invalidLevelResult.warning, false);
});

test("balanced split preserves the legacy empty result", () => {
  assert.deepEqual(
    splitBalanced([], {
      scores: {},
      balanceLevel: "50-50",
      getScoreKey: () => 1,
      random: () => 0,
    }),
    { teamA: [], teamB: [], warning: true },
  );
});

test("5v5 random API returns exactly two complete teams with every player once", () => {
  const players = makePlayers(10);
  const result = splitTeams5v5(players, { mode: "random", random: () => 0 });
  const allIds = [...ids(result.teamA), ...ids(result.teamB)];

  assert.equal(result.teamA.length, 5);
  assert.equal(result.teamB.length, 5);
  assert.equal(new Set(allIds).size, 10);
  assert.deepEqual([...allIds].sort(), [...ids(players)].sort());
  assert.equal(result.mode, "random");
  assert.equal(result.warning, false);
});

test("5v5 tier and rank modes use the caller-provided score key", () => {
  const players = makePlayers(10);
  const tierResult = splitTeams5v5(players, {
    mode: "tier",
    scores: { 3: 2 },
    balanceLevel: "50-50",
    getScoreKey: (player) => player.tier,
    random: () => 0,
  });
  const rankScores = Object.fromEntries(
    players.map((player) => [player.rankTier, 1]),
  );
  const rankResult = splitTeams5v5(players, {
    mode: "rank",
    scores: rankScores,
    balanceLevel: "50-50",
    getScoreKey: (player) => player.rankTier,
    random: () => 0,
  });

  assert.equal(tierResult.teamA.length, 5);
  assert.equal(tierResult.teamB.length, 5);
  assert.equal(tierResult.mode, "tier");
  assert.equal(rankResult.teamA.length, 5);
  assert.equal(rankResult.teamB.length, 5);
  assert.equal(rankResult.mode, "rank");
});

test("exported tier defaults match the legacy application defaults", () => {
  assert.equal(DEFAULT_BALANCE_LEVEL, "60-40");
  assert.deepEqual(DEFAULT_TIER_SCORES, {
    1: 8,
    2: 4,
    3: 2,
    4: 1,
    5: 0.5,
  });
});

test("5v5 API rejects empty, short, and oversized player lists", () => {
  for (const players of [[], makePlayers(9), makePlayers(11)]) {
    expectTeamCoreError("INVALID_PLAYER_COUNT", () =>
      splitTeams5v5(players, { mode: "random" }),
    );
  }
});

test("5v5 API rejects non-array, invalid IDs, and duplicate IDs", () => {
  expectTeamCoreError("INVALID_PLAYER_LIST", () =>
    splitTeams5v5(null as unknown as Player[], { mode: "random" }),
  );

  const missingId = makePlayers(10);
  missingId[0] = { ...missingId[0]!, id: " " };
  expectTeamCoreError("INVALID_PLAYER_ID", () =>
    splitTeams5v5(missingId, { mode: "random" }),
  );

  const duplicateId = makePlayers(10);
  duplicateId[1] = { ...duplicateId[1]!, id: duplicateId[0]!.id };
  expectTeamCoreError("DUPLICATE_PLAYER_ID", () =>
    splitTeams5v5(duplicateId, { mode: "random" }),
  );
});

test("5v5 API rejects unsupported mode and balance level", () => {
  const players = makePlayers(10);
  const invalidMode = { mode: "mmr" } as unknown as SplitTeams5v5Options<Player>;
  expectTeamCoreError("INVALID_MODE", () =>
    splitTeams5v5(players, invalidMode),
  );

  const invalidBalance = {
    mode: "tier",
    scores: { 3: 1 },
    balanceLevel: "80-20",
    getScoreKey: (player: Player) => player.tier,
  } as unknown as SplitTeams5v5Options<Player>;
  expectTeamCoreError("INVALID_BALANCE_LEVEL", () =>
    splitTeams5v5(players, invalidBalance),
  );
});

test("5v5 API rejects missing and invalid scores according to legacy validation", () => {
  const players = makePlayers(10);

  expectTeamCoreError("MISSING_SCORE", () =>
    splitTeams5v5(players, {
      mode: "tier",
      scores: {},
      balanceLevel: "50-50",
      getScoreKey: (player) => player.tier,
    }),
  );

  expectTeamCoreError("INVALID_SCORE", () =>
    splitTeams5v5(players, {
      mode: "tier",
      scores: { 3: -1 },
      balanceLevel: "50-50",
      getScoreKey: (player) => player.tier,
    }),
  );

  const rankScores = Object.fromEntries(
    players.map((player) => [player.rankTier, 1]),
  );
  rankScores[players[0]!.rankTier] = 0;
  expectTeamCoreError("INVALID_SCORE", () =>
    splitTeams5v5(players, {
      mode: "rank",
      scores: rankScores,
      balanceLevel: "50-50",
      getScoreKey: (player) => player.rankTier,
    }),
  );
});

test("5v5 API validates injected random sources", () => {
  for (const invalidValue of [-0.1, 1, Number.NaN, Number.POSITIVE_INFINITY]) {
    expectTeamCoreError("INVALID_RANDOM_SOURCE", () =>
      splitTeams5v5(makePlayers(10), {
        mode: "random",
        random: () => invalidValue,
      }),
    );
  }
});
