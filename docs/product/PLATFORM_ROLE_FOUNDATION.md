# Role Foundation — HUY-25/26/27

Source handoff, 25/11/2026. Production RBAC has not been deployed. Backend migrations and full ordered rollout/recovery instructions are in sibling repository `customAOV/docs/platform-role-foundation-handoff.md`.

## Implementation checklist

- [x] Existing AuthContext extended with canonical role, loading/error, refresh and organizer capability.
- [x] Supabase role read fails closed; guest/logout/account changes cannot retain a stale privileged response.
- [x] Background refresh preserves forms; permission denial invalidates privilege and refreshes from DB.
- [x] Create Room/Tournament/Community routes and submit actions guarded; Platform Admin restricted to Super Admin and clearly unavailable.
- [x] Room platform permission combined with existing owner checks; queued confirmation/configuration/result actions recheck privilege.
- [x] Role-aware top/bottom/account navigation. Existing resource pages retained, no second shell.
- [x] Mock-only four-role selector; isolated sessionStorage; guest clears privilege; Community ownership fixture selector cannot change platform role.
- [x] Supabase has no persona selector; Mock browser checks issue zero Supabase requests.
- [x] Community management requires platform organizer and resource membership/ownership; Tournament API uses its server resource role.
- [x] Backend protects 17 organizer RPCs, preserves all original business blocks and participant RPCs.
- [x] Database operator assignment is audited SECURITY INVOKER, postgres-only, with no frontend service key.
- [ ] PO approves actual legacy accounts, active Hosts, migrations and deployment.
- [ ] HUY-28 hosted four-role/RPC/RLS/concurrency/Realtime acceptance.
- [ ] HUY-29 dynamic permission management (future scope).

## Compatibility

`dev:mock`, `dev:supabase`, default dev/build and the same React source remain. Env files were not changed by this remediation. API mode has no new canonical role endpoint: existing authenticated organizer UI and server-owned resource authorization are preserved, without claiming that Supabase RBAC applies to Fastify. API cannot access the new Super Admin route.

Mock personas simulate platform permissions with the existing sample session. Community's two ADMIN fixtures test owner/nonowner behavior; SUPER_ADMIN has no ownership bypass. Community/Tournament unfinished workflows and new adapters remain separate work. No new library, backend web application rewrite, deployment or account assignment was introduced.

## Validation

- Typecheck PASS; lint 0 errors / 2 existing AppContext warnings; production build PASS (dependency annotation warnings only).
- Full frontend regression: **49 files / 323 tests PASS**, up from 48/309. Tests retained; existing organizer fixtures explicitly authenticate/select ADMIN.
- Disposable PGlite PostgreSQL: **107 checks PASS** through historical migrations plus both new role migrations. Includes all 17 direct RPC gates, self-escalation denial, SQL operator assignment/audit, activation rollback, revocation, original body/OID preservation and BO3/5/7/FIFO/Replace/Swap/results. Auth/JWT are local fixtures; pgcrypto bytes are substituted. Not hosted acceptance or multi-connection concurrency proof.
- Backend existing static tests: **21 PASS**.
- `npm run test:e2e -- http://127.0.0.1:5174`: Auth regression PASS. It checks session/navigation; the dedicated role script checks access denial.
- `node scripts/e2e-roles.mjs http://127.0.0.1:5174`: **72 PASS**, 390/768/1280/1440px, direct URL/reload/personas/resource ownership; Supabase requests intercepted and count zero.
- `node scripts/screenshot.mjs role-foundation http://127.0.0.1:5174`: **40/40** route-width captures; no page overflow or console errors. Saved under `base-frontend-web/docs/screenshots/role-foundation/` (ignored). Visually inspected mobile Dashboard and desktop Create Room; no full pixel-diff baseline comparison claimed.
- Both repositories: `git diff --check` PASS.

## Failures investigated

New role checks exposed old fixtures granting organizer operations to USER or returning organizer detail with a logged-out session; fixtures now represent authenticated organizers, and negative checks remain. `configuration.test.tsx` timed out during parallel dynamic App import, then the late import contaminated the following test; Vitest now uses at most four workers and the complete suite passed.

The server restart stopped the dev process once (ERR_CONNECTION_REFUSED). Another browser run overlapped shared-package clean/build and Vite logged missing contracts imports, producing three missing-header failures. Browser checks passed when run after build against the restarted Mock server. Do not run shared-package cleaning and browser checks concurrently. The earlier 23/11 truncated failure is still unclassified.

## Source self-review

Addressed P1 paths: legacy creation bypass, callable internal helper bypass, inherited Profile column grants, unapproved legacy elevation, JWT/SQL operator confusion, cross-owner management and stale privileged actions. No remaining P0/P1 identified in reviewed source; this is self-review, not external independent approval.

Operational gates remain: verified Production account inventory (including the known account), actual deployed ACL/owner compatibility, PO-approved Host handling and role assignment, hosted concurrency/Realtime/RLS acceptance. No Production PASS is claimed.

## Files and recovery

Frontend changes are concentrated in `src/api/platformRole*`, `src/context/AppContext.tsx`, layout guards/navigation/persona selector, organizer create pages, Room permission/action components, Community role integration, related tests and the browser scripts. `vite.config.ts` only changes test worker count. Existing Community/env changes remain uncommitted.

Backend additions are `20261123_01_platform_roles.sql`, `20261123_02_room_role_authorization.sql`, preflight/postflight SQL, disposable PostgreSQL runner and handoff. Historical migrations and pre-existing dirty README remain untouched.

No commit/push/merge performed. Recover by reviewing the task diff and reversing only these role changes, retaining pre-existing Community/env work; do not reset/clean the dirty tree. For any future deployed database rollback follow the backend handoff, preserve audit data and never restore an unguarded setter automatically.
