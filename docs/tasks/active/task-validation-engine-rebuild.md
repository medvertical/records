## Relevant Files

- `server/services/validation/core/consolidated-validation-service.ts` – Consolidated validation service emitting normalized results.
- `server/services/validation/core/validation-pipeline.ts` – Pipeline orchestrator to keep in sync with consolidated service.
- `server/services/validation/core/validation-engine.ts` – Aspect validators that must always return all six aspects.
- `server/services/validation/validation-persistence.test.ts` – Persistence tests to rewrite against the consolidated service.
- `server/routes/api/validation/validation.ts` – API routes returning validation results to the client.
- `server/storage.ts` – Persistence helpers that must align with the updated schema.
- `shared/schema.ts` – Database schema definitions and migrations for validation results.
- `shared/types/validation.ts` (to be created/updated) – Shared DTO/type definitions for validation results/settings.
- `client/src/hooks/use-validation-settings-polling.ts` – Settings polling hook controlling UI filters.
- `client/src/components/resources/resource-list.tsx` / `resource-list.test.tsx` – Resource list UI/tests that will display validation results.
- `client/src/components/resources/resource-viewer.tsx` / `resource-viewer.test.tsx` – Resource detail UI/tests to show aspect-level results.
- `client/src/components/settings/*` – Validation settings UI components to simplify.
- `package.json` & test config files – house the `npm run test` script and legacy suites slated for cleanup.
- `.cursor/global.mdc` (or equivalent) – Global cursor automation rules to honor during implementation.

### Notes

- Validation results must always include all six aspects; UI controls only filter visibility.
- Run the specified tests (or add new ones) after each task before moving to the next.
- Apply automation conventions/rules defined by `.cursor/global.mdc` across all changes.
- Aim for clear module boundaries (`validation/engine`, `validation/pipeline`, `validation/settings`, `validation/ui`) and shared type contracts for long-term maintainability.

## Tasks

- [x] 1.0 Remove Legacy Shims & Clean Naming
- [x] 1.1 Rename `validation-pipeline-new.ts` and related imports to `validation-pipeline.ts` (or another final name) across the codebase.
- [x] 1.2 Update all services/tests/routes to import directly from the renamed core pipeline file and consolidated service; remove `unified-validation.ts` and old pipeline shims.
- [x] 1.3 Ensure `npx vitest run server/services/validation/validation-engine.test.ts` remains green after renaming and import updates.
- [ ] 2.0 Align Pipeline & Engine with Full-Aspect Output
  - [x] 2.1 Guarantee `validation-engine.ts` emits all six aspects in `DetailedValidationResult` regardless of filters.
  - [x] 2.2 Confirm the renamed pipeline file preserves the normalized result through execution.
  - [x] 2.3 Run focused suites: `npx vitest run server/services/validation/validation-engine.test.ts server/services/validation/core/*.test.ts`.
- [ ] 3.0 Rebuild Validation Settings (Simplified)
  - [ ] 3.1 Strip legacy settings history/audit logic from services and storage; define a simplified settings schema.
  - [ ] 3.2 Update repository/core service and `/api/validation/settings` routes to use the simplified schema.
  - [ ] 3.3 Revamp settings UI components to match the new minimal configuration.
  - [ ] 3.4 Run relevant tests: `npx vitest run server/services/validation/validation-settings-service.test.ts server/services/validation/validation-settings-realtime.test.ts` and affected UI tests.
- [ ] 4.0 Update Persistence & Schema
  - [ ] 4.1 Modify `shared/schema.ts` + migrations to store summary, performance, and aspect breakdown data.
  - [ ] 4.2 Refactor `storage.ts` and helpers to use the new schema consistently.
  - [ ] 4.3 Rewrite `validation-persistence.test.ts` for `ConsolidatedValidationService` and run `npx vitest run server/services/validation/validation-persistence.test.ts`.
- [ ] 5.0 Refresh Validation Routes & Services
  - [ ] 5.1 Switch validation routes to use the consolidated service/pipeline APIs directly.
  - [ ] 5.2 Ensure responses return full `detailedResult` payloads.
  - [ ] 5.3 Run/extend route tests: `npx vitest run server/routes/**/validation*.test.ts`.
- [ ] 6.0 Integrate with Dashboard/UI
  - [ ] 6.1 Update hooks (`use-validation-*`, dashboard wiring) to consume normalized results.
  - [ ] 6.2 Expose validation results in resource list/detail components and corresponding tests.
  - [ ] 6.3 Run UI tests: `npx vitest run client/src/components/resources/resource-list.test.ts client/src/components/resources/resource-viewer.test.ts`.
- [ ] 7.0 Clean Up Test Suites & Configs
  - [ ] 7.1 Audit `npm run test` to catalog obsolete/legacy suites and note required removals.
  - [ ] 7.2 Remove or rewrite outdated mock/test files uncovered in the audit.
  - [ ] 7.3 Update test scripts/configuration to reflect the rebuilt validation stack and ensure clean runs.
- [ ] 8.0 Final QA & Documentation
  - [ ] 8.1 Run the full project suite (`npm run test`) ensuring all prior tasks stay green.
  - [ ] 8.2 Remove any remaining temporary artifacts tied to the legacy engine/settings.
  - [ ] 8.3 Update PRD/docs to reflect the consolidated architecture and DTOs; document the simplified settings model.
  - [ ] 8.4 Confirm adherence to `.cursor/global.mdc` rules and document any exceptions.
- [ ] 9.0 Strengthen Architecture & Coverage
  - [ ] 9.1 Organize validation code into clear module boundaries (engine, pipeline, settings, UI) and update imports accordingly.
  - [ ] 9.2 Define/export shared validation types in `shared/types/validation.ts` and ensure both server and client consume them.
  - [ ] 9.3 Add integration/end-to-end tests covering settings → pipeline → persistence → API → UI flow; run via `npx vitest run tests/integration/validation/*.test.ts` (or equivalent).
