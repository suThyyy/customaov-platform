# Team Core Migration Progress

Owner: Codex

Exclusive write scope: `packages/team-core`

The React agent owns `web`. This task does not modify that directory or any root workspace configuration.

## Step 1 — Legacy scope analysis

Status: complete (2026-11-15)

Verified sources:

- `randomizer-core.js:6-85`: random source, Fisher–Yates shuffle, combination generation, random split, balanced split.
- `script.js:1261-1273`: application wrappers choose tier or rank scores and the score-key selector.
- `script.js:1370-1402`: the application requires exactly 10 active players for a 5v5 draw and requires rank data in rank mode.
- `script.js:1510-1538`: team split happens before lane and champion assignment; random mode bypasses score balancing.
- `tests/randomizer.test.js:247-350`: deterministic random, cardinality, uniqueness, balance ranges, fallback warning, score fallback, and empty-input characterization.

Behavior to preserve:

- Random mode copies and Fisher–Yates shuffles the player list, then puts `floor(n / 2)` players in team A and the rest in team B.
- Balanced mode enumerates every team-A combination of size `floor(n / 2)`.
- Balance windows are `48..52`, `40..60`, and `30..70` percent for `50-50`, `60-40`, and `70-30`.
- If no candidate is found, each window is widened by 5 percentage points up to three times.
- A candidate is selected through an injectable random function.
- If no widened window matches, the first combination nearest 50 percent is selected and `warning` is `true`.
- Legacy score coercion is `Number(score) || 1`: missing, invalid, and zero scores act as 1. This is a known legacy quirk and will be preserved in the low-level port, not silently fixed.
- Empty balanced input returns two empty teams with `warning: true`; odd input puts the extra player in team B.

Direct dependencies: arrays, `Set`, numeric conversion, and an injectable `() => number` random source. No DOM, React, storage, Firebase, Supabase, or backend dependency is required.

Planned public boundary:

- Low-level `splitRandom` and `splitBalanced` preserve legacy core behavior for characterization and reuse.
- Integration-level `splitTeams5v5` validates the application contract: exactly 10 players, two teams, unique non-empty player IDs, supported mode, and required balanced-mode options.
- Lane assignment, champion assignment, mystery box/reveal, persistence, and UI remain out of scope.

## Step 2 — TypeScript module

Status: complete (2026-11-15)

Created a strict TypeScript package with:

- `src/split.ts`: behavior-preserving low-level split functions and validated `splitTeams5v5` integration API.
- `src/types.ts`: public input, option, result, score, mode, and random-source types.
- `src/errors.ts`: stable validation error codes.
- `src/index.ts`: public package exports.
- Local `package.json` and `tsconfig.json`; no root or `web` configuration is referenced or modified.
- Installed only local dev dependencies: TypeScript and Node type definitions. Runtime dependency count: zero.
- Strict typecheck passed before test creation: `npm run typecheck`.

## Step 3 — Tests

Status: complete (2026-11-15)

Coverage scenarios include deterministic legacy parity, both team sizes, uniqueness,
non-mutation, empty/odd/larger low-level inputs, all balance ranges, nearest-split
warning, legacy score fallbacks, valid tier/rank modes, malformed player lists,
duplicate IDs, missing/invalid scores, unsupported settings, and invalid random sources.

Execution:

- First compile attempt exposed a missing explicit Node typings declaration; fixed locally in `tsconfig.json`.
- Final `npm test`: 15 tests passed, 0 failed, 0 skipped.
- The test command includes a clean strict TypeScript build before executing tests.

## Step 4 — React handoff

Status: complete (2026-11-15)

Created `HANDOFF.md` with public API, examples for random/tier/rank, error codes,
legacy rules and quirks, limits, local-package installation, and test commands.
No file under `web`, no root package/workspace file, and no legacy file was modified.

Final verification:

- Package self-import smoke test returned two teams of five in Tier mode.
- `npm pack --dry-run` included only `package.json` and compiled `dist/src` API files.
- Legacy Git worktree remained clean after migration.
