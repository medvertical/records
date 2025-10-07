# Core Simplification & De-scope Refactor Tasks

Goal: Reduce complexity by focusing on MVP per PRD (polling-based progress, core validation workflows, dashboards, settings). Remove/merge duplicate pages/hooks, de-scope realtime/SSE and experimental variants, and streamline server routes/services accordingly.

## Guiding Principles
- Favor polling over SSE/WebSockets (PRD §7: MVP polling strategy)
- Keep one canonical page per workflow (Dashboard, Resources, Settings, Profiles)
- Consolidate hooks and data sources; eliminate parallel/legacy variants
- Remove dead code, feature flags, and experimental branches not in MVP

## Proposed Removals (seek approval)
- Realtime/SSE client code: `client/src/hooks/use-validation-sse.ts`, `use-validation-settings-realtime.ts`, SSE event wiring in components (e.g., `recent-errors.tsx`), and UI messages about SSE disconnects
- Duplicate pages: `pages/dashboard-new.tsx` vs `pages/dashboard.tsx`; `pages/settings-new.tsx` vs `pages/settings.tsx`
- Duplicate hooks: `use-validation-controls.ts` vs `use-validation-controls-simple.ts` (retain one)
- Tests tied to SSE/realtime: `client/src/hooks/use-validation-sse.test.ts`, `pages/dashboard.realtime.test.tsx`
- Server SSE endpoints/emitters (if present) and any server code exclusively for realtime streaming

## Keep/Consolidate
- Keep polling hooks: `use-validation-polling.ts`, `use-validation-settings-polling.ts`
- Keep canonical pages: `pages/dashboard.tsx`, `pages/settings.tsx`
- Keep shared types and PRD-aligned services

## Task List
1. Remove realtime/SSE client pathing and fallbacks; standardize on polling
2. Consolidate Dashboard: migrate any necessary UI from `dashboard-new.tsx` into `dashboard.tsx`, then delete `dashboard-new.tsx`
3. Consolidate Settings: ensure `settings.tsx` covers needed flows; delete `settings-new.tsx` if redundant
4. Choose a single validation controls hook; delete the other and update imports
5. Remove SSE-specific UI/logic in components (e.g., `recent-errors.tsx` and SSE-disconnect badges)
6. Delete SSE/realtime tests; update remaining tests to rely on polling
7. Remove any server-side SSE streams/endpoints; keep REST endpoints for polling
8. Prune unused services/utilities introduced only for realtime (search for EventSource/SSE usages)
9. Update docs: reflect polling-only MVP; add note in `README.md` about removed realtime
10. Run tests and fix imports; ensure e2e flows (dashboard, validation, settings) pass

## Acceptance Criteria
- No SSE/WebSocket references in client or server
- One dashboard and one settings page remain
- All imports compile without duplicate hooks/pages
- Polling-based validation progress works end-to-end
- e2e tests for validation workflows pass

## Notes
- Keep future path in PRD §7.3 commented in docs; no code scaffolding for SSE required in MVP

