# Quick Team — frontend handoff

Public `/quick-team` uses the existing shell and components. Ten stable slots, Vietnamese validation, Random/Tier/Rank, stale results, cross-team selection and swap, regeneration, clipboard fallback and confirmed reset are implemented. State is memory-only and is discarded on unmount/reload.

`features/quick-team/model.ts` calls `@customaov/team-core` directly. It imports no auth, adapter, Room or Supabase module. The default balance window remains 60–40; the core can widen it and choose a fallback. Output is not guaranteed to minimize differences globally. Manual swaps are labelled explicitly and totals are recalculated from the displayed roster.

Rank catalog: exact 32 entries, ordering, IDs and default weights from reference repository `script.js` RANK_CATALOG (Đồng III = 1 through Chiến Thần = 45). No rank-star conversion is added. Tier uses core defaults 8/4/2/1/0.5. These are declared weights, not official MMR. Legacy/custom Room rank weights can differ; parity requires identical scores and RNG. Existing Room code is unchanged.

Navigation: primary Chia đội follows Home on desktop, with guest hero/preview and dashboard CTA. Mobile retains all prior entries and adds Chia đội in a six-column bar. PO UAT should review navigation density, touch targets and the complete Rank list.

Verification: model tests compare all modes directly to core with deterministic RNG and cover validation, IDs, invariants and swaps. Component tests cover stale/regenerate/reset and clipboard success/failure. Browser script: `node scripts/e2e-quick-team.mjs [baseUrl]`, four widths, fresh guest context, all three modes and no Supabase requests. Hosted authentication/E2E is not claimed.

No backend, schema, RPC, persistence, Community or Tournament workflow changes. Environment switching is preserved.
