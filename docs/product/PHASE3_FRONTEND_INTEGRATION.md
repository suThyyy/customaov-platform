# Phase 3 Supabase Frontend Integration

## Source selection

Set `VITE_DATA_SOURCE` explicitly to `supabase`, `mock`, or `api`. Missing or invalid values stop at a visible configuration error. Mock mode is a demo and is visibly labeled. In Supabase mode, Auth, Profile, and Room operations use Supabase; unsupported tournaments, registrations, chat, activity, and search remain demo-only and are labeled as such. No Room mock fallback is used in Supabase mode.

## Room contracts

Configured Rooms are created with `create_series_room(p_name, p_best_of, p_visibility, p_style, p_mode)`. Name, BO format, and visibility are immutable. Host-editable style and allocation mode use `set_room_play_style(p_room_id, p_version, p_style)` and `set_room_allocation_mode(p_room_id, p_version, p_mode)`. Public discovery uses `discover_series_rooms()`, whose deployed result contains only `room_id`, `room_name`, `best_of`, `play_style`, `allocation_mode`, and `invite_code`. It does not provide host identity or queue/player counts; the UI must not present fabricated values for those fields. Private Rooms are absent from discovery. Join always uses `join_open_room(p_invite_code, p_display_name)`; a UUID is not a join credential.

Public discovery join is invite-first: selecting a discovered Room passes its invite code in in-memory router state to the existing `/join` form. The code is not placed in the URL. The form calls `join_open_room(p_invite_code, p_display_name)` once, and navigates to the protected Room UUID only after success. The Room snapshot is then loaded under normal RLS. Direct `/rooms/:roomId` navigation remains available to existing authorized members; if the protected read is rejected, the access fallback offers a new invitation redemption rather than retrying the protected read. The previous fallback did attempt that protected read first and only offered an invite link after its failure; it did not redeem the invitation itself, but produced a misleading failed-detail path for discovery users. Directory phase is explicitly unknown because discovery does not return phase. Its join action is an invitation request, not a claim of eligibility; closed Room, kicked membership, invalid invite, permissions, and other decisions are answered by the server RPC.

The legacy Room snapshot remains a separate read model (`room`, `members`, `queue`, `currentPlayers`). It is loaded through `read_open_room_state(p_room_id)` with RLS-protected table reads only as the established compatibility fallback. Series state is read separately from `room_series`, `series_players`, `series_games`, and `game_result_revisions`; the public summary uses `read_public_game_results(p_room_id)` and never reads protected history for a nonmember.

## Queue and lifecycle

Queue order and capacity are server-owned. PREPARE uses `prepare_next_open_room_round(p_room_id)` to select a fresh set from the current eligible queue. Team allocation is persisted through `save_open_room_lineup(p_room_id, p_version, p_players)`. Replace is one `replace_open_room_player(p_room_id, p_version, p_member_id)` call; do not follow it with a lineup repair. Swap is one `swap_open_room_players(p_room_id, p_version, p_first, p_second)` call. Every successful mutation is followed by an authoritative snapshot refresh; never increment `rooms.version` in the client.

Configured BO Rooms start Game 1 and subsequent Games with `start_series_game(p_room_id, p_version)`. First START snapshots the fixed ten-player roster; later Games use that roster. The backend assigns Game numbers and enforces BO3/5/7 clinch rules. Configured results and corrections use `report_series_result(p_room_id, p_version, p_game_id, p_match_id, p_winner, p_confirm, p_correct)`. Score, loser, completion, and audit revisions are server-derived. Results are `HOST_REPORTED` / `UNVERIFIED`, not publisher-verified. A completed Series is followed by `prepare_next_open_room_round`; the next Series uses the then-current queue and a new allocation, without altering the completed Series roster/history.

## Hero/Lane and synchronization

`series_hero_catalog` supplies the picker. `assign_series_game` persists automatic or manual assignment drafts for a started, unended Game. The server resolves team from immutable `series_players`; the client does not send team membership. Within each team, heroes and lanes must be unique. The same hero may be used by the opposing team. Partial drafts are allowed; END accepts no assignment or a complete ten-player assignment only. Automatic generation is persisted and is never repeated on render or refresh.

Realtime subscribes only to the existing published Room tables. A Room version change triggers reads of the Room snapshot and, for configured BO Rooms, Series, roster, Games, assignment data, and revisions. Version consistency checks, request sequencing, reconnect backoff, subscription disposal, and Auth logout cleanup prevent stale/private state from remaining visible. Series/Game/history tables do not need new Realtime publication.

## Known limits and release status

- Public discovery does not return host display name, member count, queue count, or Room phase. Those values are omitted or explicitly unavailable in the directory; member Room detail remains RLS-controlled.
- Discovery invite redemption and the resulting protected read still require hosted verification for nonmember, kicked, closed, invalid-invite, and ordinary member sessions. Router state avoids URL exposure but is not an authorization boundary; Supabase remains authoritative.
- Public result summaries are limited to the deployed RPC policy. Private history requires successful invite redemption and active membership.
- Chat, tournament, activity, registration, and search persistence are not part of these deployed contracts.
- Unit tests use offline doubles and do not prove hosted Auth, PostgREST schema-cache, RLS, or multi-client Realtime behavior.
- Hosted acceptance is pending. Do not use Production for write tests without separate explicit authorization and approved test accounts.

## Hosted acceptance checklist (HUY-18 / HUY-21)

### Development release evidence (2026-11-20)

- Baseline: `task/phase3-react-integration` and fetched `origin/dev` at `2724a51c626d25aa891b16f64a188cc54fca76ad`; UI merge `8210687` is an ancestor.
- Fresh local typecheck passed; lint passed with zero errors and the two existing AppContext Fast Refresh warnings.
- First test run: 273 passed, 2 failed in `configuration.test.tsx` (5-second dynamic-import timeout followed by duplicate DOM after the timed-out test). An unchanged full rerun passed all 44 files / 275 tests. This timing sensitivity remains a test-stability risk.
- Production build passed; Rollup reported dependency annotation warnings and the existing large-bundle warning. Validation required approved execution outside the filesystem sandbox for build tooling.
- PO-provided independent source review: **SOURCE REVIEW PASS WITH NONBLOCKING FINDINGS**. This is source evidence, not hosted operational acceptance.
- Accepted P2 deferrals: `/join/discovery` refresh/deep-link without router state has an unhelpful invalid-invite path; full Random Roulette and Tier/Rank Meteor reveals remain unimplemented. Basic reveal, Skip, and reduced-motion support are present. HUY-23 remains open for the visual scope.
- Update 2026-11-26 (HUY-23 visual scope): Random Roulette and Tier/Rank Meteor reveals are implemented in `TeamReveal` / `revealPlan`. They apply to the saved 5v5 lineup, to the team lock-in after START, and to a hero/lane roulette once a complete ten-player assignment is persisted. Reveals consume only authoritative snapshot data, issue no mutations, use deterministic reels, play once per data key per browser session (no replay on re-render/refresh/reconnect), offer Skip, and are disabled under reduced motion. Offline unit evidence only; hosted two-client convergence remains HUY-21.
- Development completion is separate from hosted acceptance under the PO's release decision. Historical issue acceptance criteria are retained. HUY-18/HUY-21 still require hosted Auth/session, permissions/RLS, invite, Queue, BO lifecycle, concurrency, and two-client Realtime evidence after Vercel Preview. Earlier limited Auth/discovery smoke evidence does not satisfy these gates; production test-account/session verification remained blocked.
- No deployment, Backend changes, or Supabase writes are part of this release task.

Run only in an approved isolated hosted test environment, with approved accounts and disposable test Rooms. Capture request result, resulting Room version, and both clients' observed state for each applicable step.

- [ ] Sign up, login, OTP verification if enabled, reload/session restore, logout, and verify private data/subscriptions clear.
- [ ] Configure explicit Supabase source; confirm invalid/missing source fails visibly and no sample account or Room appears.
- [ ] Create Public and Private BO3, BO5, and BO7 Rooms; verify returned invite link/code and persisted immutable fields after reload.
- [ ] Confirm public discovery includes only open Public Rooms and does not invent host/count/phase values; confirm Private Room is absent.
- [ ] Join Public and Private Rooms through invite; test malformed/expired invite, kicked account, anonymous session, and UUID-only access denial.
- [ ] Host Add Guest, account join, leave/rejoin, and continue/requeue; verify FIFO and the 50-active-entry limit including concurrent capacity attempts.
- [ ] PREPARE exactly ten eligible queue entries; exercise Random, Tier, and Rank and confirm server validation of 5v5 and player skill data.
- [ ] Replace a selected player and verify exactly one atomic request, retained slot/team behavior, correct replacement identity, and no follow-up lineup repair.
- [ ] Swap same-team slots and cross-team players; confirm one atomic request and persisted result in both clients.
- [ ] Start Game 1 and verify fixed Series roster; start later Games and verify same member/team/slot records and server-assigned game numbers.
- [ ] Test BO3/BO5/BO7 completion, prevention of games after clinch, and next-Series preparation from current queue with a fresh roster.
- [ ] Persist manual partial Hero/Lane draft, test duplicate/team/catalog/lane validation, complete draft, reload, and verify no team mutation.
- [ ] Generate automatic Hero/Lane assignment once, reload/reconnect, and verify same persisted assignment without reroll.
- [ ] END with confirmed Match ID/winner; verify server score, derived loser, HOST_REPORTED/UNVERIFIED provenance, and double-submit rejection.
- [ ] Correct a reported result; verify appended audit revision, recomputed score, stale-version rejection, and rollback when correction conflicts with later Games.
- [ ] Open two authenticated clients; observe Room version, queue, Series, Games, assignments, scores, and revisions refresh without page reload.
- [ ] Submit concurrent Host mutations from stale snapshots; confirm one is rejected, UI refreshes, and no blind retry occurs.
- [ ] Verify Room UUID alone cannot expose private membership/history, public history uses only the narrow public RPC, and kicked/left access is denied as contracted.
- [ ] Disconnect/reconnect and logout during pending reads; confirm stale response suppression, subscription cleanup, and no private data leak.
- [ ] Confirm all tests were run against the approved hosted environment; keep offline unit-test evidence labeled separately.
