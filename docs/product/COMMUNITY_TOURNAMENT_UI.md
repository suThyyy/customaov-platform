# Community / Tournament UI handoff

Status: partial implementation. Community vertical slice implemented; expanded tournament scope remains outstanding.

## Source research and retained architecture

Existing AppShell, PageHeader, Card, Button, Tailwind theme, lucide icons and React Router are reused. Room/Auth/Profile and existing Tournament discovery, creation, registration and organizer screens remain in place. Existing tournament API/mock adapter behavior is retained. The frontend README is a Vite template; the root README describes workspace operations. Neither proves full tournament acceptance.

## Community demo

Routes: `/communities`, `/communities/new`, `/communities/:communityId?tab=…`.
Discovery supports name/description search, visibility filtering, joined/managed lists and sorting. Details include overview, rules, members, announcements and existing tournament links. Public membership, private requests, approval/rejection, leaving, creation/editing, role assignment, removal and announcements update a shared service snapshot. Owner protection and resource-level manager checks live in pure domain functions, not button visibility alone.

Logged-in mock users can choose explicit demo personas: member, owner admin, unrelated admin, future platform admin. This selector affects only Community demo capabilities; it never alters real Auth or platform roles. Super Admin has no implicit resource permissions. Guests browse public information; private member/activity data is withheld. Supabase/API sessions can browse this demo but cannot use fake identities to mutate it.

State persists across navigation and refresh in isolated sessionStorage `customaov.community-demo.v1`, with in-memory fallback. No network calls or Supabase session keys are used. All fixtures reside under `src/mocks`. New communities use branded icon fallback. Clear the specific sessionStorage key to reset the demo.

## Local validation

Typecheck/build passed. Lint: zero errors, two existing AppContext warnings after correcting a restricted source import. Tests: 45 files / 282 passed (seven new domain tests). Browser probe: discovery, public detail and private members direct URLs at 390/768/1280/1440; one h1, no page horizontal overflow, zero Supabase requests. This covers guest rendering only, not full browser mutation/role acceptance. Existing Room/Auth component regression tests passed; full screenshot/e2e scripts were not run in this slice.

## Remaining scope

- Tournament five-step wizard, community eligibility, unified participation/organizer views, lifecycle, deterministic BYEs, downstream-safe audited corrections and complete new domain tests are **not implemented by this update**. Existing Tournament functionality must not be interpreted as acceptance of these new requirements.
- Community tournament links are curated demo references, not registration eligibility enforcement or bidirectional backend relationships.
- Community tags, pagination, asynchronous loading/error simulation, richer activity timestamps, home/profile integration and custom images remain outstanding.
- Creation drafts currently survive only while the form remains mounted; no separate draft save/review flow.
- Browser screenshots and responsive verification results must be reported separately; source implementation alone is not browser acceptance.
- Future adapters need server-enforced identity, membership/ownership permissions, request/announcement storage, tournament linkage and RLS. No Backend/schema/RPC implementation is included.
- Advanced tournament formats (double elimination, Swiss, round robin) and Room Series synchronization remain out of scope. Hosted E2E is pending.
