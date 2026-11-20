# CustomAOV — PHASE 3.0 REACT PLATFORM BIG UPDATE 2

## ROLE & MISSION

You are acting as a Senior React/TypeScript Architect, Supabase Integration Engineer, Frontend Technical Lead and QA Engineer.

This is a FULL IMPLEMENTATION TASK.

The Phase 3.0 Backend Big Update has already been implemented, manually deployed to Supabase Production, structurally verified and committed to the Backend repository.

A subsequent READ-ONLY React Platform Re-Audit confirmed that the latest UI merge is already present, but most Supabase Room operations still use mock data, stub adapters or obsolete RPC contracts.

Your mission:

**Integrate the deployed Phase 3.0 Supabase backend into the CURRENT React Platform while preserving the recently merged UI and existing application architecture.**

Do not rebuild the frontend from scratch.

Do not invent another backend.

Do not stop after a proposal or an audit. Implement the required frontend scope, run available local tests, and provide a complete acceptance handoff.

---

## 1. REPOSITORIES

### TARGET REPOSITORY — WRITE ACCESS

`C:\Users\thh19\huyhoang\platform\customaov-platform`

Frontend application:

`base-frontend-web/`

Technology:

- React
- TypeScript
- Vite
- Supabase JavaScript SDK

### BACKEND REFERENCE — READ ONLY

`C:\Users\thh19\huyhoang\customAOV`

Read these actual files before implementation:

- `docs/phase3-backend-contract-manifest.md`
- `docs/phase3-backend-migration-handoff.md`
- `db/migrations/20261119_01_room_queue.sql`
- `db/migrations/20261119_02_room_configuration.sql`
- `db/migrations/20261119_03_series.sql`
- `db/migrations/20261119_04_game_assignments.sql`
- `db/migrations/20261119_05_queue_lifecycle.sql`

The five migrations are ALREADY APPLIED to Supabase Production.

Production postflight evidence:

- 15/15 frontend-facing RPC metadata checks passed.
- 5/5 new tables have RLS enabled and no direct authenticated write privileges.
- 8/8 internal function access checks passed.
- Hero Catalog contains 129 entries.
- No malformed Series roster was reported.

This is structural deployment evidence, NOT complete hosted functional acceptance.

Never modify or reapply those migrations.

---

## 2. VERIFIED RE-AUDIT BASELINE

Platform repository at audit:

- Branch: `main`
- HEAD: `8210687`
- Local tracking ref `origin/main`: `8210687`
- Remote: `https://github.com/suThyyy/customaov-platform.git`

The recent UI merge includes:

- Four-step Create Room UI.
- Room configuration panel.
- Adapter changes.
- Supabase Room View improvements.
- Relevant tests and documentation.

Pre-existing local modifications:

- `base-frontend-web/src/App.tsx`
- `package-lock.json`

IMPORTANT:

The newly merged UI is the authoritative visual baseline.

Preserve all existing changes and do not overwrite another developer's work.

No remote fetch was performed during the previous audit, so the remote freshness must not be assumed.

### Mandatory Git safety gate

Before implementation:

1. Inspect branch, HEAD, remote and working tree.
2. Inspect full diffs for App.tsx and package-lock.json.
3. Confirm the new UI merge remains present.
4. Identify unrelated dirty changes.
5. Verify whether the current local checkout is suitable for implementation.
6. Do not reset, clean, checkout, rebase, merge or pull automatically.
7. Do not overwrite dirty files or regenerate the lockfile merely to make tooling work.

If there is a real overwrite risk that cannot be safely resolved while preserving the changes, stop that affected edit and report the blocker. Continue independent safe implementation work where feasible.

Do not claim that the remote is current without evidence.

---

## 3. AUTHORIZED ACTIONS

You MAY:

- Inspect repository source and Git metadata.
- Read Backend contracts and Linear issues.
- Modify React Platform source files.
- Create focused TypeScript modules and components.
- Update frontend interfaces, adapters and tests.
- Update relevant Platform documentation.
- Run local build, typecheck, lint and tests.
- Install existing locked dependencies only if safe and necessary, without unintended version changes.
- Prepare manual hosted acceptance instructions.

You MUST NOT:

- Modify the Backend repository.
- Modify Supabase schema, RPCs, RLS, Auth configuration or Production data.
- Run remote write tests against Production.
- Create or delete Production Rooms or accounts.
- Reapply migrations.
- Deploy the React app.
- Commit, push, merge, reset or force-push Git.
- Update Linear issues or statuses.
- Expose secrets or `.env.local` contents.
- Replace the UI design with a generic implementation.
- Introduce a new Fastify/Express backend.
- Claim E2E completion from mocked unit tests.

---

## 4. IMPLEMENTATION PRIORITIES

Primary Linear scopes:

- HUY-18 — Supabase Integration Verification & Mock Isolation.
- HUY-24 — Create Room Wizard.
- HUY-22 — Room Arena & Queue Management.
- HUY-23 — Hero/Lane Assignment & Team Reveal.

Supporting integrations:

- HUY-20 — Atomic Replace/Swap and Queue contract.
- HUY-19 — BO Series/Game/History contract.

Final acceptance preparation:

- HUY-21 — Multi-client & E2E Acceptance.

HUY-15 remains the parent integration gate.

HUY-16 remains out of scope.

---

## 5. IMPLEMENTATION PHASE A — SUPABASE SOURCE AND MOCK ISOLATION

Inspect:

- `src/api/source.ts`
- `src/api/sources.ts`
- `src/api/adapter.ts`
- `src/api/supabase/index.ts`
- `src/api/supabase/client.ts`
- Current Auth/Profile adapters and routing.

The re-audit confirmed that explicit Supabase mode still exposes sample Room data.

Fix this.

### Required configuration behavior

`VITE_DATA_SOURCE=supabase`:

- Uses real Supabase Auth/Profile/Room operations.
- Never silently substitutes mock Room data.
- Never displays the sample `suthy` login as real authentication.
- Makes unsupported modules visibly unavailable or explicitly demo-only.

`VITE_DATA_SOURCE=mock`:

- Explicit development/demo mode.
- May retain mock data for testing and design development.
- Must be visibly identifiable as mock.

Missing or invalid `VITE_DATA_SOURCE`:

- Must fail visibly and safely.
- Must not silently choose mock mode.

Preserve intentional API-mode behavior where still supported.

### Auth

Reuse the existing Supabase Auth integration.

Verify code paths for:

- Signup.
- Login.
- OTP.
- Logout.
- Session restoration.
- Auth state changes.
- Route protection.
- Subscription cleanup after logout.

Do not replace the existing Auth architecture unless a concrete defect requires it.

### Supabase adapter correction

The re-audit identified:

- `initial/list/page` backed by mock.
- `room()` returning undefined.
- `createRoomWithConfig()` calling legacy `create_open_room()`.
- `configPersisted: false`.
- `getRoomConfig()` returning null.
- `updateRoomConfig()` being in-memory only.
- `join()` unimplemented.
- `isSampleData: true`.
- `persistsWrites: false`.

Replace these misleading Supabase-mode behaviors with authoritative contracts.

Do not fabricate success responses.

For functionality unsupported by the deployed backend, surface an explicit unsupported/permission/error state rather than inventing persistence.

---

## 6. IMPLEMENTATION PHASE B — CREATE ROOM WIZARD

Linear: HUY-24.

Preserve the current merged CreateRoom UI, Room Config Panel, layout, styling and navigation.

Do NOT rebuild the wizard.

### Approved four-step flow

STEP 1 — Room Information:

- Room Name.
- BO3/BO5/BO7.
- Public/Private.

STEP 2 — Play Style:

- Fun.
- Tryhard.

Label only — no gameplay effects.

STEP 3 — Allocation:

- Random.
- Tier.
- Rank.

STEP 4 — Review & Create.

### Backend integration

Create via:

`create_series_room(p_name, p_best_of, p_visibility, p_style, p_mode)`

Map UI values accurately to backend enum/parameter values.

After successful creation:

- Use the returned server Room identifier.
- Display the real server-generated invite link/code.
- Navigate to the persisted Room.
- Reload configuration from actual Supabase state.

Do not use `create_open_room()` for the new configured BO flow.

### Immutable configuration

After creation:

- Room Name: immutable.
- BO Format: immutable.
- Public/Private: immutable.

Host may change Play Style via:

`set_room_play_style(p_room_id, p_version, p_style)`

Host may change Allocation Mode via:

`set_room_allocation_mode(p_room_id, p_version, p_mode)`

Respect backend lifecycle guards.

Refresh authoritative Room version after every mutation.

Do not locally pretend a rejected update succeeded.

### Discovery and private invitations

Use:

`discover_series_rooms()`

Public Rooms:

- May be displayed to eligible authenticated users.
- May be joined through the backend-supported invite/join contract.

Private Rooms:

- Must not appear in public discovery.
- Require the valid invite/access contract.
- Must not expose membership or history merely from a Room UUID.

Existing `join_open_room(p_invite_code, p_display_name)` remains the join operation.

Do not invent a join-by-UUID RPC.

Implement a truthful user experience for invalid invitation, kicked membership, unauthenticated access and expired/invalid state.

---

## 7. IMPLEMENTATION PHASE C — ROOM ARENA & QUEUE

Linear: HUY-22, supporting HUY-20.

Preserve and extend:

- `RoomDetail.tsx`
- `SupabaseRoomView.tsx`
- Existing Room visual design.
- Existing Waiting/Selected UI.
- Host controls.
- Existing Realtime subscriptions and cleanup patterns.

### Legacy Room snapshot

`read_open_room_state` returns:

- `room`
- `members`
- `queue`
- `currentPlayers`

Keep this shape backward compatible.

Do not assume Series/Game/History is embedded in it.

### OPEN

Support:

- Real Room loading.
- Join Room.
- Host Add Guest.
- FIFO Waiting/Selected.
- Queue capacity 50.
- Leave/Continue.
- Host Kick.
- Appropriate waiting/selected restrictions.
- Host Play Style / Allocation Mode edits.

The server owns queue ordering and capacity.

Display actual backend rejections such as QUEUE_FULL and stale version.

### PREPARE

- Select exactly ten eligible players.
- Allocate 5 Blue / 5 Red.
- Random/Tier/Rank must use the existing correct algorithm and backend validations.
- Host may perform authorized pre-lock Replace and Swap.
- Preserve selected player and slot information.

### Atomic Replace

Remove the old two-call flow:

1. Replace.
2. Refetch.
3. Reconstruct lineup client-side.
4. Save lineup again.

Replace it with ONE call to:

`replace_open_room_player(p_room_id, p_version, p_member_id)`

Then refetch the authoritative Room snapshot.

Do not use a second save-lineup operation to repair the result.

### Atomic Swap

Use:

`swap_open_room_players(p_room_id, p_version, p_first, p_second)`

Support same-team slot swaps and cross-team swaps.

Do not independently persist a client-only swapped lineup.

### Error and concurrency behavior

- Room versions come from server responses/snapshots.
- Do not calculate the next version locally.
- After conflict, refresh data and ask Host to review.
- Do not automatically repeat non-idempotent mutations blindly.
- Prevent duplicate submissions while a mutation is pending.
- Non-Host controls must remain permission-aware.
- Backend remains authoritative regardless of UI visibility.

---

## 8. IMPLEMENTATION PHASE D — SERIES, GAME & MATCH HISTORY

Linear: HUY-22, supporting HUY-19.

Create focused read/action adapters where needed, for example:

- `src/api/supabase/series.ts`
- `src/api/supabase/history.ts`
- Supporting typed read models.

Use the deployed schema:

- `room_series`
- `series_players`
- `series_games`
- `game_result_revisions`

Do not change the database.

### Series read model

Read:

- Current Series.
- BO format.
- Blue/Red wins.
- Completion status.
- Fixed Series roster.
- Ordered Games.
- Current Game.
- Game result/Match ID.
- History revisions for authorized members.

Respect RLS.

Distinguish:

- Room UUID.
- Series UUID.
- Game UUID.
- Member UUID.

### Series-wide team lock

Game 1:

- OPEN → PREPARE.
- Select ten players.
- Allocate 5v5.
- START using `start_series_game`.

The first START persists a fixed Series roster.

Games 2+:

- Reuse the same Series roster.
- Do not rerun balancing.
- Do not call legacy Prepare for each Game.
- Do not permit Replace/Swap/team reassignment.

A subsequent new Series may allocate new teams only after the current Series completes.

### START

Use:

`start_series_game(p_room_id, p_version)`

Display:

- Current Game number.
- BO format.
- Series score.
- Locked Blue/Red lineup.

Do not use legacy `start_open_room_round` for configured BO Rooms.

### END

Host provides:

- Match ID.
- Winning side A/Blue or B/Red.
- Explicit confirmation.

Use:

`report_series_result(...)`

The frontend must:

- Validate the input for usability.
- Delegate authoritative validation to the backend.
- Display the resulting series score.
- Derive/display loser consistently with the backend.
- Show HOST_REPORTED / UNVERIFIED provenance.
- Prevent accidental double submission.

### Corrections

Support Host-authorized corrections through:

`report_series_result(..., p_correct: true)`

Display appropriate conflict and audit feedback.

Do not silently overwrite history.

Do not treat manually reported Match IDs as externally game-verified.

### Next Game / Finish Series

If Series incomplete:

- Enable the next Game only when allowed.
- Start the next numbered Game through the Series RPC.
- Reuse locked roster.

If Series complete:

- Show final BO result.
- Allow preparing the next Series under the deployed lifecycle rules.

Do not improvise additional state transitions unsupported by the backend.

### Match History

Authorized active members:

- Read full permitted Room/Series/Game history.
- View Match ID, side winner, game number, score and provenance.
- View correction history where permitted.

Public viewers who are not members:

Use:

`read_public_game_results(p_room_id)`

Do not bypass RLS to read protected tables.

For Private Rooms, require the approved invitation and membership contract.

---

## 9. IMPLEMENTATION PHASE E — HERO/LANE

Linear: HUY-23.

Use the deployed Hero Catalog:

`series_hero_catalog`

Use the RPC:

`assign_series_game(p_room_id, p_version, p_game_id, p_mode, p_players)`

### Lifecycle

- Hero/Lane editing is allowed after START and before END.
- Series team membership remains immutable.
- Assignment is Game-specific.

### Manual

- Provide the existing or compatible Hero/Lane selectors.
- Support partial drafts during editing.
- Reject duplicate heroes within a team.
- Reject duplicate lanes within a team.
- Use the actual catalog and the five deployed lane identifiers:
  - top
  - jungle
  - mid
  - adc
  - support
- Allow the same hero across opposing teams under MVP rules.
- Persist the current draft through the RPC.
- Display backend validation errors.

### Automatic

- Request one authoritative generated assignment.
- Persist the returned result.
- Do not reroll on re-render or refresh.
- Use the `auto_generated` state appropriately.
- Reload persisted assignments after reconnect.

### END validation

- A Game with no assignment may end.
- A nonempty assignment draft must be complete before END.
- Do not invent additional required-field policies in React.

### Team membership

Never send client-computed team mutations through Hero/Lane assignment.

The team comes from immutable Series roster records.

---

## 10. IMPLEMENTATION PHASE F — TEAM REVEAL

Preserve the newly merged visual language.

Build animation around the authoritative allocation result.

### Random Mode

Use a player-name roulette reveal inspired by competitive game selection UX.

### Tier/Rank Mode

Use a meteor-style animation that places the ten assigned players into Blue and Red slots.

### Requirements

- Animation displays already-determined assignments.
- Animation never computes or changes team assignments.
- Support Skip Animation.
- Respect reduced-motion preferences.
- Do not block an actual Room state change on animation completion.
- Do not persist transient animation frames to the backend.
- Avoid broad styling changes to unrelated pages.

Treat advanced cinematic effects as lower priority than reliable Room lifecycle integration.

If implementation time or complexity conflicts with core functional acceptance, prioritize functional Room parity and preserve a clean reveal placeholder/animation over a fragile cinematic rewrite.

---

## 11. REALTIME & STATE CONSISTENCY

Extend the current Realtime implementation rather than replacing it.

Existing published tables:

- rooms
- room_members
- room_queue_entries
- room_current_players

The new Series/Game/History tables are not required to publish directly under the current backend contract.

The backend advances `rooms.version` when relevant Series/Game operations change.

### Required behavior

- Subscribe to the Room version update.
- Refetch Room snapshot.
- Refetch current Series.
- Refetch Games and relevant History.
- Refetch assignments.
- Update the UI consistently.

Protect against:

- Out-of-order responses.
- Duplicate subscriptions.
- Race conditions.
- Unmounted components updating state.
- Logout leaving private data visible.
- Reconnect showing stale game scores.
- Stale snapshot versions.
- Conflicting Host actions across two browsers.

Use established cleanup/backoff patterns.

Do not create an aggressive polling loop as a substitute for proper subscriptions.

---

## 12. DATA SOURCE & MODULE BOUNDARIES

The product contains multiple modules beyond Rooms.

Do not accidentally migrate unrelated modules without backend support.

For Supabase mode:

- Auth/Profile/Room must be truthful.
- Room discovery must not show mock results.
- Unsupported features must be explicitly indicated.
- No misleading sample data should be labeled as persisted.
- Do not invent Tournament, Community or Leaderboard backend implementations.

For explicit Mock mode:

- Preserve useful frontend demos and existing tests.
- Clearly label mock behavior.

Keep existing API mode where practical without introducing a new backend requirement.

---

## 13. TESTING REQUIREMENTS

After implementation, run the available local validation suite.

At minimum:

### Configuration

- Supabase mode.
- Explicit Mock mode.
- Missing/invalid source configuration.
- No unintended silent fallback.

### Auth and routing

- Real Auth adapter selection.
- Session restoration logic.
- Route protection.
- Logout cleanup.
- No mock `suthy` in Supabase mode.

### Wizard

- Four steps.
- Valid configuration payload.
- Actual `create_series_room` adapter call.
- Correct value mapping.
- Real persisted-config reads.
- Public/private discovery behavior.
- Invalid/denied request handling.

### Room

- FIFO rendering.
- Queue capacity errors.
- Replace uses exactly one atomic RPC.
- Swap uses atomic RPC.
- Conflict handling.
- Permission-aware controls.
- No arbitrary client-side score or roster mutations.

### Series

- BO3/5/7.
- Locked roster across Games.
- Game numbering and score.
- Result submission.
- Double-submit prevention.
- Correction and audit rendering.
- Next Game and next Series transitions.

### Hero/Lane

- Catalog.
- Auto generation.
- Manual validation.
- Persistence.
- State restoration.
- No team mutation.
- Post-END rejection.

### Realtime

- Subscription setup/cleanup.
- Version-triggered refetch.
- Reconnect.
- Stale response prevention.

### Regression

- Existing frontend unit/component tests.
- TypeScript typechecking.
- Production build.
- Any available lint checks.
- API/mock mode regression where supported.

Use test doubles for unit tests and label them accurately.

DO NOT run Production write tests.

DO NOT claim that mocked tests prove hosted Supabase functionality.

If available development tools cannot run due to missing dependencies, attempt only safe dependency restoration consistent with the existing lockfile and record the exact result.

Do not silently modify package-lock.json.

---

## 14. HOSTED ACCEPTANCE PREPARATION

Prepare a reproducible checklist for HUY-18 and HUY-21, without executing unauthorized Production writes.

The checklist must cover:

1. Auth signup/login/logout/session restore.
2. Create Public and Private BO Rooms.
3. Join through invite.
4. Host Add Guest.
5. FIFO and 50-person Queue.
6. PREPARE exactly ten.
7. Random/Tier/Rank.
8. Atomic Replace/Swap.
9. START and Series lock.
10. Hero/Lane Auto/Manual.
11. END with Match ID/winner.
12. Match History and corrections.
13. Next Game with same teams.
14. BO3/5/7 completion.
15. Next Series fresh allocation.
16. Two-client Realtime.
17. Concurrent stale-version mutations.
18. RLS and unauthorized actions.
19. Reconnect and logout cleanup.
20. No hidden mock fallback.

Use approved test accounts and isolated test Rooms only when a separate hosted test execution is explicitly authorized.

---

## 15. DOCUMENTATION

Update Platform documentation to reflect:

- The real deployed Supabase contracts.
- Correct source selection.
- React adapter responsibilities.
- Room snapshot vs Series/Game read models.
- Queue/Replace/Swap workflow.
- Series-wide roster lock.
- Host-reported/unverified provenance.
- Hero/Lane rules.
- Realtime synchronization.
- Mock mode limitations.
- Hosted acceptance still pending.

Do not describe already-deployed backend RPCs as hypothetical.

Do not claim the frontend is production-accepted without hosted evidence.

---

## 16. IMPLEMENTATION QUALITY BAR

Do not deliver merely:

- A report.
- Adapter stubs.
- A mock Room directory.
- A fake successful create flow.
- Client-only lineup repair.
- An unpersisted Series score.
- A locally generated Match History disguised as server data.
- Unnecessary UI rewrites.

Instead:

- Implement against actual backend contracts.
- Reuse the merged UI.
- Preserve existing architecture where sound.
- Make failures explicit.
- Keep side effects and source boundaries correct.
- Use strict TypeScript types.
- Write meaningful tests.
- Run available checks.
- Inspect all changed files before completion.

If you find a backend contract gap, do not silently change SQL or invent an RPC.

Document the gap, implement independent work and report what requires a separately approved backend corrective migration.

---

## 17. FINAL REPORT REQUIRED

Return:

### A. Executive Summary

Implemented frontend scope and remaining blockers.

### B. Git Baseline and Preservation

- Starting HEAD.
- Branch.
- Dirty files at start.
- Whether existing UI and local changes were preserved.
- Any unresolved merge or overwrite risk.

### C. Files Changed

Exact paths and their purpose.

### D. Backend Integration Matrix

For each required RPC/table:

- Implemented.
- Tested locally.
- Remaining hosted verification.

### E. UI Preservation Assessment

What was reused, extended or necessarily refactored.

### F. HUY-18 Status Matrix

Explicit Supabase mode, Auth, mock isolation, Room list, Profile, Realtime.

### G. HUY-24 Status Matrix

Four-step Wizard, persistence, immutable configuration, invite.

### H. HUY-22 Status Matrix

Arena, Queue, Replace/Swap, Series lifecycle, History.

### I. HUY-23 Status Matrix

Hero/Lane, Team Reveal, persistence and constraints.

### J. Test Results

Exact commands, pass/fail counts, typecheck/build results and unexecuted checks.

### K. Hosted Acceptance Gaps

All items requiring actual Supabase/JWT/browser/E2E tests.

### L. Backend Contract Gaps

Any required but unsupported operations, with evidence.

### M. Manual PO Actions

Configuration, test environment preparation and review checklist.

### N. Final Readiness Verdict

Choose one:

- FRONTEND SOURCE READY — HOSTED ACCEPTANCE PENDING.
- PARTIALLY IMPLEMENTED — BLOCKERS REMAIN.
- BLOCKED BY BACKEND CONTRACT GAP.
- BLOCKED BY REPOSITORY STATE.

Do not label HUY-21 complete.

Do not commit or push automatically.

---

## 18. EXECUTION BOUNDARY

Modify only the React Platform repository.

Use the deployed Phase 3 Backend contracts as the source of truth.

Preserve the UI merge at commit `8210687` and the pre-existing unrelated changes.

No Backend migrations.
No Production writes.
No Git push.
No Linear status changes.
No deployment.

**Implement React Platform Big Update 2 now.**

Complete as much of the approved frontend scope as safely possible, test the actual implementation and report verified outcomes separately from hosted acceptance.