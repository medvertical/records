# Product Requirements Document (PRD)
## Records FHIR Validation Platform – Unified MVP v1.2

**Date:** October 2025  
**Version:** MVP v1.2 (Hybrid + Multi-Version-Aware Validation + Batch Remediation)  
**Document Type:** Product Requirements Document for MVP Release  

---

## 1. Introduction / Overview

**Records** is a comprehensive FHIR (Fast Healthcare Interoperability Resources) validation and management platform designed for healthcare organizations, FHIR server administrators, and healthcare IT professionals. The platform provides enterprise-scale validation capabilities for FHIR resources across multiple servers, with real-time monitoring, comprehensive reporting, intelligent batch remediation, and a unified validation engine.

The MVP focuses on a **hybrid, multi-version-aware validation engine** capable of operating in both **online (remote-connected)** and **offline (self-contained)** modes, with advanced batch error correction and data quality improvement workflows.

Validation follows HL7's recommended approach, covering all computable aspects (structure, cardinality, bindings, profiles, invariants) while offering additional local checks for metadata and business rules. The system integrates the **HAPI FHIR Validation Engine** as its core, connecting to public demo endpoints for remote validation and to a **local Ontoserver** for terminology resolution in offline mode.

### Key Concepts
- **Six-Aspect Validation:** Structural · Profile · Terminology · Reference · Metadata · Business Rules  
- **Hybrid Mode:** switch between *Online (tx.fhir.org / Simplifier / HAPI demo)* and *Offline (local Ontoserver + cached IGs)*  
- **FHIR Version Awareness:** detect and support R4, R5, and R6 servers dynamically  
- **Editable Resources:** users can correct issues directly ("in-place") or via batch edit, triggering immediate re-validation  
- **Batch Remediation:** intelligent error detection, grouping, and mass correction with preview and automatic revalidation
- **Per-Aspect & Per-Version Results:** results stored separately by aspect and FHIR version for deterministic comparison  
- **Error Mapping Engine:** translates HAPI FHIR validator codes into friendly, human-readable explanations
- **Same-Message Grouping:** group resources by identical validation signatures for rapid triage and systematic cleanup

### Target Audience
- **Primary Users:** FHIR server administrators, healthcare IT professionals, compliance officers
- **Secondary Users:** Healthcare developers, system integrators, quality assurance teams
- **Use Cases:** FHIR server validation, compliance monitoring, resource quality assessment, systematic data cleanup, healthcare data interoperability

---

## 2. Goals

1. **Comprehensive HL7-Compliant Validation** – six-aspect validation via HAPI FHIR Validator with optional `$validate` calls and local Ontoserver fallback.  
2. **Multi-Version Compatibility (R4 → R6)** – automatic detection of FHIR version and routing of validation, profiles, and terminologies.  
3. **Hybrid Connectivity (Online ↔ Offline)** – switch between remote validation services and offline packages.  
4. **Immediate Feedback Loop** – per-aspect validation results update automatically after edits.  
5. **In-Place & Batch Editing** – corrections trigger queued re-validation with change comparison.  
6. **Intelligent Batch Remediation** – identify, group, and systematically correct validation errors with preview and rollback capabilities.
7. **Error Mapping Engine (Built In)** – normalize raw HAPI codes (e.g. `terminology-check-failed`) into descriptive explanations.  
8. **Unified Validation Storage (Versioned)** – persist results per aspect and FHIR version.  
9. **Same-Message Filtering/Grouping** – enable fast filtering and grouping of resources by identical validation messages for rapid triage.
10. **List/Detail Parity** – ensure consistent validation counts and scores between list and detail views.
11. **Configurable Runtime Behavior** – centralized YAML/JSON config or UI switches for modes and aspects.  
12. **Resilient Polling Model** – deterministic progress reporting without WebSockets.  
13. **Enterprise Scale Performance** – handle 25K–250K+ resources with responsive queries and batch operations.
14. **Usable Demo Mode** – preconfigured endpoints for instant testing.  

---

## 3. User Stories (MVP Scope)

### Server Management
- Admin connects multiple FHIR servers (R4–R6) and compares datasets.  
- System auto-detects FHIR version and tests connectivity.  
- Admin toggles Online / Offline Mode.

### Resource Validation
- Compliance officer validates all resources across aspects and versions.  
- Developer validates a single resource and gets structured feedback.  
- User filters messages by identical signature or error code mapping.  
- Validator revalidates after edits and compares before/after.
- **As a** validator, **I can** filter and group resources by the same validation message **so that** I can quickly identify systemic issues and affected records.
- **As a** user, **I can** rely on list and detail views showing consistent validation counts and scores **so that** I can trust results.

### **Batch Remediation & Data Cleanup (NEW)**
- **As a** compliance officer, **I can** identify all resources with the same validation error in the list view **so that** I can understand the scope of quality issues.
- **As a** quality assurance professional, **I can** select multiple resources with identical errors and apply a correction operation **so that** I can fix systemic data quality issues efficiently.
- **As a** data steward, **I can** preview the effect of a batch correction before applying it **so that** I can verify changes are correct and safe.
- **As a** administrator, **I can** apply batch corrections with automatic revalidation **so that** I can confirm the fix resolved the validation errors.
- **As a** user, **I can** combine multiple filters (error type, severity, resource type, validation aspect) **so that** I can target specific data quality issues for cleanup.
- **As a** developer, **I can** use template-based or custom FHIRPath operations for batch corrections **so that** I can handle complex transformation scenarios.

### Editing & Remediation
- User edits inline → auto-revalidation.  
- Admin runs batch edit and monitors progress.  
- User views Error Mapping explanations inline in UI.
- User selects error group → applies batch correction → previews changes → confirms → automatic revalidation.

### Dashboard & Monitoring
- Manager views error/warning distribution by aspect and version.  
- User tracks coverage per version and mode.  
- Admin pauses/resumes batch jobs.
- Manager views validation statistics and trends over time.
- User sees resource breakdown by type and quality score.

---

## 4. Functional Requirements (MVP)

### 4.1 Server Management
1. Connect to multiple FHIR servers with auth.  
2. Detect FHIR version (R4/R5/R6) from `CapabilityStatement.fhirVersion`.  
3. Store settings + version per server.  
4. Refresh resource lists on server switch.
5. Server health monitoring and status display.
6. Active server switch reactivity: all views immediately bind to newly selected server; caches are namespaced per server.

### 4.2 Resource Discovery & Management
7. Automatic discovery of all available resource types from server CapabilityStatement.
8. Support for 146+ FHIR resource types (R4: 143 types, R5: 154 types, R6: 160+ types).
9. Dynamic resource type detection based on server version.
10. Resource counting with intelligent caching (5-minute cache duration).
11. Browse resources by type with pagination.
12. Search resources by ID, content, or metadata.
13. Resource detail viewing with JSON formatting.
14. Resource tree viewer for complex nested structures.
15. Resource editing (single) with immediate revalidation on save.
16. Batch selection and batch editing of resources with queued revalidation after apply.

### 4.3 Validation Engine
17. **Structural Validation:** schema + datatype checks via HAPI Validator.  
18. **Profile Validation:** version-specific IG packages (Simplifier/local).  
19. **Terminology Validation:** tx.fhir.org (online) or Ontoserver (offline).  
20. **Reference Validation:** verify references exist + are version-consistent.  
21. **Metadata Validation:** check `meta.lastUpdated`, `versionId`, `security`.  
22. **Business Rules:** execute FHIRPath/JSONPath expressions.  
23. **Error Mapping Engine:** normalize HAPI FHIR issue codes to descriptive messages using `error_map.json`.  
24. Persist OperationOutcome → normalized `IssueCard` (aspect + version + mappedExplanation).
25. Per-aspect processing and storage for all six aspects.
26. Automatic validation on browse: when a resource page is loaded, resources are validated and results persisted per aspect.
27. Batch validation runs in the background and stores results in the same per-aspect format.
28. Settings changes invalidate all existing validation results; system revalidates resources; UI shows clear "Validating…" state.
29. Views react immediately to settings changes: UI recalculates visibility and aggregations while background revalidation updates results.

### 4.4 Batch Remediation & Error Correction (NEW)
30. **Multi-Criteria Error Filtering:**
    - Filter by error type/code (e.g., "missing-required-field", "invalid-code")
    - Filter by severity (Error, Warning, Information)
    - Filter by resource type (Patient, Observation, etc.)
    - Filter by validation aspect (Structural, Profile, Terminology, Reference, Business Rules, Metadata)
    - Filter by same-message signature (Same-Message Grouping)
    - Combine multiple filters for precise targeting

31. **Batch Selection & Operation Definition:**
    - Select resources via checkbox (individual or "Select All")
    - Display affected resource count before operation
    - Define correction operations via UI dialog:
      - **Field Replacement:** Add or update specific fields
      - **Field Deletion:** Remove invalid or unnecessary fields
      - **Value Transformation:** Apply formatting, normalization, or conversion rules
      - **Template-Based Corrections:** Use predefined fixes for common error patterns
      - **Custom FHIRPath/JSONPath Operations:** Advanced transformations for complex scenarios

32. **Mandatory Preview & Dry-Run:**
    - Before/after diff view for sample resources (minimum 2-3 examples)
    - Summary of planned changes (fields affected, operation type)
    - Warning indicators for potentially destructive operations
    - User must explicitly review and confirm before execution

33. **Batch Correction Execution:**
    - Apply corrections atomically per resource (partial success allowed)
    - Enforce maximum batch size limit (configurable, default: 1000 resources)
    - Progress indicator during batch operation
    - Detailed success/failure reporting per resource
    - Automatic audit logging (before/after hash, timestamp, operation details)

34. **Automatic Revalidation After Correction:**
    - Synchronous revalidation of corrected resources
    - User waits for validation completion with progress indicator
    - Display before/after validation comparison:
      - Error count reduction
      - Warning count changes
      - Per-aspect validation status changes
    - Clear success/failure indicators

35. **UI Integration in Resource Browser:**
    - "Batch Remediation" button in toolbar (visible when filters/grouping active)
    - Contextual menu in Same-Message Group view
    - Clear indication of selected resource count
    - Disabled state when no resources selected or no active server

### 4.5 Editing & Revalidation
36. Inline JSON edit + diff preview → save → revalidate.  
37. Batch edit across resources → queued jobs.  
38. Conflict detection via ETag.  
39. Audit metadata: `before_hash`, `after_hash`, `editedAt`, `editedBy`, `fhirVersion`.
40. Post-edit revalidation: edits enqueue affected resources; UI reflects pending → updated states.

### 4.6 Batch Validation
41. Manual start from dashboard.  
42. One active batch (job queue MVP limit).  
43. Progress (queued / running / paused / done).  
44. Retry + back-pressure for external calls.
45. Safe concurrency and back-pressure to protect connected FHIR server.
46. Pause/Resume controls available on Validation Engine card in Dashboard.

### 4.7 Issue Filtering & Grouping
47. **Same-Message Grouping:**
    - Group resources by identical validation message signature
    - Signature components: aspect + severity + code + normalized path + ruleId (optional) + normalized text
    - Endpoints to list groups, fetch group members (paginated)
    - Navigate to resource detail with message highlighted

48. **List/Detail Parity:**
    - List coverage/score and counts match detail view for same resource and aspect set
    - Disabled aspects greyed/clearly indicated and excluded from score aggregation

### 4.8 Configuration & Modes
49. Runtime configuration via YAML/JSON:
```yaml
mode: online | offline
validation:
  aspects:
    structural: true
    profile: true
    terminology: true
    reference: true
    metadata: true
    businessRules: true
servers:
  terminologyServer: https://tx.fhir.org/r4
  referenceServer: https://hapi.fhir.org/baseR4
  profileSources:
    - https://packages.simplifier.net/hl7.fhir.r4.core@4.0.1
    - https://packages.simplifier.net/hl7.fhir.r5.core@5.0.0
    - https://packages.simplifier.net/hl7.fhir.r6.core@6.0.0
  offline:
    terminologyServer: http://localhost:8081/fhir
    profileCachePath: /opt/fhir/igs/
terminologyFallback:
  - local: http://localhost:8081/fhir
  - remote: https://tx.fhir.org
cache:
  valueSets: /opt/fhir/cache/valueSets/
errorMapping:
  file: /opt/fhir/config/error_map.json
batchRemediation:
  maxBatchSize: 1000
  previewSampleSize: 3
  allowedOperations:
    - replace
    - remove
    - add
    - transform
```

### 4.9 Dashboard & Analytics
50. Comprehensive dashboard with resource statistics and breakdown by type.
51. Validation progress tracking with completion percentages.
52. Error and warning summary displays by aspect and version.
53. Performance metrics and timing information.
54. Detailed validation results with error categorization.
55. Validation trend analysis over time.
56. Resource quality scoring and metrics.
57. Export capabilities for validation reports (JSON format).

### 4.10 Profile Management
58. Search and install FHIR profiles from Simplifier.
59. Version management for installed profiles.
60. Profile activation/deactivation controls.
61. Local profile storage and caching.
62. Custom profile selection for validation.
63. Profile-specific validation settings.
64. Profile dependency management.

---

## 5. Non-Goals / Out of Scope

### 5.1 MVP Exclusions (Intentional Simplifications)
- **Real-time WebSocket/SSE Updates:** Using polling instead for MVP simplicity and reliability
- **Advanced Real-time Features:** Live streaming, instant notifications, and real-time collaboration
- **Complex Connection Management:** WebSocket connection pooling, reconnection logic, and connection state management
- **Automatic Undo/Rollback:** Manual rollback via version history (deferred to post-MVP)
- **AI-Powered Correction Suggestions:** Template-based only; ML/AI suggestions post-MVP
- **Asynchronous Batch Remediation:** Synchronous execution only in MVP (async in Phase 2)

### 5.2 General Platform Exclusions
- **User Authentication & Authorization:** No user management, roles, or permissions system (MVP is single-user)
- **Multi-tenancy:** Single-tenant application without organization separation
- **Clinical Decision Support:** No clinical logic or decision support features
- **Patient Data Management:** No patient-specific data handling or privacy controls
- **Integration with EHR Systems:** No direct EHR integration beyond FHIR API access
- **Advanced Analytics:** No machine learning or predictive analytics features
- **Air-Gapped Offline Updates:** Manual file import deferred to post-MVP
- **CSV/PDF Export Formats:** JSON only in MVP

---

## 6. Design Considerations

### 6.1 Validation Architecture

| Aspect | Source | Description |
|--------|--------|-------------|
| **Structural** | HAPI Validator | Schema + cardinality validation |
| **Profile** | HAPI + IG Packages | Profile + StructureDefinition checks |
| **Terminology** | tx.fhir.org / Ontoserver | ValueSet and CodeSystem validation |
| **Reference** | REST lookup | Reference existence + integrity |
| **Metadata** | Custom Rules | Meta consistency |
| **Business Rules** | FHIRPath / JSONPath | Cross-field logic |
| **Error Mapping** | Custom Dictionary | Translates raw codes → friendly text |

---

### 6.2 Online vs Offline Mode

- **Online:** tx.fhir.org, Simplifier, HAPI demo
- **Offline:** local Ontoserver (8081) + cached IGs
- **Fallback chain:** local Ontoserver → cached ValueSets → tx.fhir.org
- **UI badge:** "Mode: Online / Offline"

---

### 6.3 UI Design & Version Awareness

- React + Tailwind + shadcn/ui
- Modern, flat design without shadow effects
- No icon animations to prevent visual distractions
- Server version badge (R4/R5/R6)
- Filter by version and aspect
- Error Mapping tooltip explains codes
- Warning banner for unsupported versions (e.g. R6 limitations)
- **Batch Remediation UI:**
  - Toolbar button in Resource Browser (prominent placement)
  - Modal dialog for operation definition with tabs: Filter → Select → Define → Preview → Confirm
  - Before/after diff viewer with syntax highlighting
  - Progress bar during execution and revalidation
  - Success/failure summary with detailed breakdown

---

### 6.4 Data Model (Versioned & Extended)

| Table | Field | Description |
|-------|-------|-------------|
| `fhir_servers` | `fhir_version` | Detected FHIR version |
| `validation_results` | `fhir_version` | Version context |
| `validation_messages` | `fhir_version` | For cross-version filtering |
| | `signature` | SHA-256 hash for same-message grouping |
| | `canonical_path` | Normalized path for grouping |
| | `normalized_text` | Normalized message text |
| `validation_jobs` | `fhir_version` | Version-consistent execution |
| `edits` | `fhir_version` | Audit trace integrity |
| | `before_hash` | Pre-edit resource hash |
| | `after_hash` | Post-edit resource hash |
| | `operation_type` | single / batch / remediation |
| `batch_remediation_jobs` | `filter_criteria` | JSON: applied filters |
| | `operation_definition` | JSON: correction operations |
| | `preview_sample` | JSON: sample resources |
| | `affected_count` | Total resources in batch |
| | `success_count` | Successfully corrected |
| | `failure_count` | Failed corrections |
| | `revalidation_summary` | JSON: before/after comparison |

---

### 6.5 Batch Remediation Workflow (Detailed)

```plaintext
User → Resource Browser → Apply Filters (Aspect/Severity/Code/ResourceType)
 → View grouped errors (Same-Message Groups)
 → Click "Batch Remediation" button
 → Remediation Dialog Opens:
    1. Review Filter Criteria & Affected Resource Count
    2. Select Resources (All / Specific)
    3. Define Correction Operation:
       - Select operation type (Replace/Remove/Add/Transform/Template/FHIRPath)
       - Specify target field(s)
       - Define new value(s) or transformation rule
    4. Request Preview → Backend:
       - Apply operation to sample resources (3 samples)
       - Generate before/after diff
       - Return to UI
    5. User Reviews Preview:
       - Before/after diff for each sample
       - Summary of changes
       - Warning indicators
    6. User Confirms or Cancels
    7. If Confirmed → Backend:
       - Apply corrections atomically per resource
       - Log audit metadata
       - Return success/failure per resource
    8. Automatic Revalidation:
       - Enqueue corrected resources (high priority)
       - Run validation per aspect
       - Generate before/after comparison
    9. Display Results:
       - Success/failure summary
       - Error count reduction
       - Warning count changes
       - Link to revalidation results
```

---

## 7. Polling Strategy

- **Default interval:** 30 s (10–60 adaptive)
- **Endpoints:** `/api/validation/progress`, `/api/validation/issues/groups`, `/api/validation/resources/:id`, `/api/batch-remediation/status`
- **Resilience:** Exponential backoff + graceful resume
- **Outdated results:** "Pending revalidation"
- **Progress Persistence:** Validation and remediation progress stored in database and retrieved on each poll

---

## 8. Technical Architecture

### 8.1 Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Frontend** | React 18 + TanStack Query | UI + dashboard |
| **Backend** | Express + TypeScript | REST API + validation orchestration |
| **DB** | PostgreSQL + Drizzle ORM | Storage |
| **Validator** | HAPI FHIR CLI/API | Multi-version validation |
| **Terminology** | Ontoserver / tx.fhir.org | Code/ValueSet lookup |
| **Cache** | In-memory + Postgres | Retry + performance |
| **Deployment** | Docker Compose | App + Ontoserver + DB stack |

---

### 8.2 Validation Flow

```plaintext
User → Records UI → /api/validate → Validation Controller
 → detect FHIR version
 → Structural → HAPI Validator(core@version)
 → Profile → IG packages by version
 → Terminology → Ontoserver/tx.fhir.org
 → Reference → REST lookup
 → Metadata → Custom rules
 → Business Rules → FHIRPath evaluator
 → Error Mapping → map raw codes to descriptions
 → Aggregate OperationOutcome → Normalize → Persist (aspect + version + signature)
 → UI polls for results
```

---

### 8.3 Batch Remediation Flow (NEW)

```plaintext
User → Resource Browser → Apply Filters → Click "Batch Remediation"
 → POST /api/batch-remediation/preview
    Body: { filters, selection, operation }
 → Backend:
    - Query matching resources (limit to maxBatchSize)
    - Select sample resources (3)
    - Apply operation to samples
    - Generate diffs
    - Return preview
 → User Reviews → Confirms
 → POST /api/batch-remediation/execute
    Body: { filters, selection, operation, confirmed: true }
 → Backend:
    - Apply corrections atomically per resource
    - Collect success/failure per resource
    - Log audit metadata
    - Enqueue high-priority revalidation jobs
    - Return execution summary
 → Validation Controller:
    - Process revalidation queue (synchronous)
    - Generate before/after comparison
    - Persist results
 → UI polls for completion
 → Display results summary
```

---

### 8.4 FHIR Version Strategy

- Detect from `CapabilityStatement.fhirVersion`
- **Supported:** R4 (4.0.x), R5 (5.0.x), R6 (6.0.x-preview)
- R6 limited to structure + profile validation (terminology/reference validation best-effort)
- Version-specific core packages (`hl7.fhir.rX.core`)
- Terminology routing by version (`tx.fhir.org/{r4|r5|r6}`)
- Version stored with each validation record
- Batch remediation operations version-aware (respect field availability per version)

---

### 8.5 Validation Data Model (Extended)

- Per-aspect validation results persisted with timestamps, counts, and scores
- Normalized validation messages (aspect, severity, code, canonical path, text) with stable signature for grouping
- Indexes on (server, signature), (server, aspect, severity), (server, resource identity) for fast filtering and grouping
- Cross-server resource identity: `(server_id, resource_type, fhir_id)` ensures no cross-server conflation
- Security/consistency rules:
  - Never treat equal `fhir_id` across different servers as the same resource
  - Client cache keys and React Query keys include `server_id` to prevent data bleed

---

### 8.6 Signature Normalization (Same-Message Grouping)

- **Input parameters:** `aspect | severity | code | canonicalPath | ruleId? | normalizedText`
- **Normalization rules:**
  - `severity`: lowercase (`ERROR` → `error`)
  - `canonicalPath`: normalize FHIR path, remove array indices (e.g., `entry[3].item[0].code` → `entry.item.code`), lowercase, remove whitespace, max 256 chars
  - `normalizedText`: trim, collapse whitespace, lowercase, remove control characters, max 512 chars
  - `code` and `ruleId`: unchanged (except trim)
- **Hash formation:** `signature = SHA-256(aspect + '|' + severity + '|' + (code||'') + '|' + canonicalPath + '|' + (ruleId||'') + '|' + normalizedText)` (hex string)
- **Stability guarantee:** Signature is stable as long as normalization rules unchanged; rule changes versioned (`signature_version`)

---

### 8.7 Scoring & Coverage Rules

- Per-aspect score default: `isValid ? 100 : max(0, 100 - 100 * (errorCount > 0 ? 1 : 0) - 50 * warningBuckets)` (simple binary for errors; warnings reduce but do not zero)
- Aggregated resource score = average of enabled aspects' scores
- Disabled aspects excluded from aggregation and shown greyed/disabled
- Not-yet-validated aspects render as "Validating…" and excluded from score until result present

---

### 8.8 Queue Policy & Timeouts

- **Priority:** Remediation revalidation > Edit revalidation > Regular batch validation
- **Concurrency:** up to 8 simultaneous validation jobs (configurable), back-pressure at external 429/timeouts
- **Retry:** up to 2 retries per failed job, exponential backoff (base 1s, max 30s), abort on client errors (4xx except 429)
- **Pause/Resume:** via Dashboard; MVP allows only one active batch run; resume continues queue at same position
- **Timeouts (Defaults, configurable):**
  - Terminology: 60s
  - Profile: 45s
  - Reference: 30s
  - External HTTP calls: 15–60s depending on service; circuit breaker on persistent failures
- **Protection limits:** max batch edit/remediation size (default 1000 resources), request body size limited, rate limiting per server connection via concurrency

---

## 9. API Contracts (MVP)

### 9.1 Existing Endpoints

1. `GET /api/validation/issues/groups`
   - Query: `aspect?`, `severity?`, `code?`, `path?`, `resourceType?`, `page=1`, `size=25`, `sort=count:desc|severity:desc`
   - Returns: `[{ signature, aspect, severity, code, canonicalPath, totalResources, sampleMessage }]`

2. `GET /api/validation/issues/groups/:signature/resources`
   - Query: `resourceType?`, `page=1`, `size=25`, `sort=validatedAt:desc`
   - Returns: `[{ resourceType, fhirId, validatedAt, perAspect: { aspect, isValid, errorCount, warningCount } }]`

3. `GET /api/validation/resources/:resourceType/:id/messages`
   - Returns: `{ resourceType, fhirId, aspects: [{ aspect, messages: [{ severity, code, canonicalPath, text, signature, timestamp }] }] }`

4. `GET /api/validation/progress`
   - Returns: `{ state: queued|running|paused|completed|failed, total, processed, failed, startedAt, updatedAt, etaSeconds? }`

5. `PUT /api/fhir/resources/:resourceType/:id`
   - Headers: `If-Match: <versionId|ETag>` (optional but recommended)
   - Body: full FHIR resource JSON
   - Returns: `{ success: true, versionId, queuedRevalidation: true }`

6. `POST /api/fhir/resources/batch-edit`
   - Body: `{ resourceType, filter: { query... }, operations: [{ op: replace|remove|add, path, value? }] }`
   - Returns: `{ matched, modified, failed }`

### 9.2 New Batch Remediation Endpoints

7. `POST /api/batch-remediation/preview`
   - Body:
     ```json
     {
       "serverId": "server-uuid",
       "filters": {
         "aspect": "terminology",
         "severity": "error",
         "code": "invalid-code",
         "resourceType": "Patient",
         "signature": "sha256-hash-optional"
       },
       "selection": {
         "mode": "all" | "specific",
         "resourceIds": ["Patient/123", "Patient/456"]
       },
       "operation": {
         "type": "replace" | "remove" | "add" | "transform" | "template" | "fhirpath",
         "target": "field.path.to.update",
         "value": "new-value" | { complex: "object" },
         "template": "template-id" | null,
         "fhirPath": "custom FHIRPath expression" | null
       }
     }
     ```
   - Returns:
     ```json
     {
       "success": true,
       "affectedCount": 42,
       "samples": [
         {
           "resourceId": "Patient/123",
           "before": { /* full resource */ },
           "after": { /* modified resource */ },
           "diff": [
             { "op": "replace", "path": "/field/path", "old": "old-value", "new": "new-value" }
           ]
         }
       ],
       "warnings": [
         "Operation will modify 42 resources",
         "Field 'X' is required in profile Y"
       ]
     }
     ```

8. `POST /api/batch-remediation/execute`
   - Body: Same as preview + `{ confirmed: true }`
   - Returns:
     ```json
     {
       "success": true,
       "jobId": "remediation-job-uuid",
       "totalResources": 42,
       "successCount": 40,
       "failureCount": 2,
       "results": [
         {
           "resourceId": "Patient/123",
           "success": true,
           "versionId": "2",
           "revalidationQueued": true
         },
         {
           "resourceId": "Patient/999",
           "success": false,
           "error": "Conflict: resource was modified",
           "code": 409
         }
       ],
       "revalidationStatus": "queued" | "running" | "completed",
       "beforeValidation": {
         "totalErrors": 42,
         "totalWarnings": 10
       }
     }
     ```

9. `GET /api/batch-remediation/status/:jobId`
   - Returns:
     ```json
     {
       "jobId": "remediation-job-uuid",
       "state": "queued" | "executing" | "revalidating" | "completed" | "failed",
       "executionComplete": true,
       "revalidationProgress": {
         "state": "running",
         "total": 40,
         "processed": 25,
         "failed": 0
       },
       "summary": {
         "totalResources": 42,
         "successCount": 40,
         "failureCount": 2,
         "beforeValidation": {
           "totalErrors": 42,
           "totalWarnings": 10
         },
         "afterValidation": {
           "totalErrors": 2,
           "totalWarnings": 8
         },
         "improvement": {
           "errorsFixed": 40,
           "warningsFixed": 2,
           "percentageImprovement": 95.2
         }
       }
     }
     ```

---

## 10. Success Metrics

| Category | KPI | Target |
|----------|-----|--------|
| **Functional** | Validation coverage | ≥ 95 % |
| | Revalidation latency | < 10 s |
| | Batch completion | ≥ 98 % |
| | Batch remediation success rate | ≥ 95 % |
| | Error reduction after remediation | ≥ 90 % |
| **UX** | Dashboard load | < 1 s |
| | Mode switch | ≤ 2 s |
| | Version detection accuracy | 100 % |
| | Error Mapping accuracy | ≥ 95 % mapped codes |
| | List/detail parity | 100 % consistency |
| | Remediation preview generation | < 3 s |
| **Technical** | Uptime | > 99 % |
| | Terminology fallback success | ≥ 90 % |
| | No unhandled exceptions | per 10k runs |
| | List/group query latency (p95) | < 500 ms |
| | Detail load time (p95) | < 300 ms |
| | Batch remediation execution time | < 5s per 100 resources |

---

## 11. Design Decisions (Resolved)

### 11.1 Profile Sources (Offline Mode)
**Decision:** German profiles + international extensions (C)  
Pre-cache the following IG packages for offline mode:
- **German Profiles:** MII (Medizininformatik-Initiative), ISiK, KBV
- **International Extensions:** HL7 FHIR Core R4/R5/R6, UV Extensions
- **Rationale:** Supports both German healthcare requirements and international interoperability use cases.

### 11.2 Business Rules Engine
**Decision:** Visual FHIRPath editor (A)  
Implement a user-friendly visual editor for custom FHIRPath expressions with:
- Syntax highlighting and validation
- Autocomplete for resource paths
- Test mode with sample resources
- **Rationale:** Empowers non-developer users (compliance officers, QA teams) to define validation logic without coding.

### 11.3 Terminology Synchronisation
**Decision:** Hybrid (Auto-check + manual approval) (C)  
Ontoserver ValueSet imports follow a controlled workflow:
- Automated check for new/updated ValueSets from configured sources
- Admin notification of available updates
- Manual review and approval before import
- **Rationale:** Balances automation with governance; prevents unintended terminology changes in production.

### 11.4 Batch Scaling
**Decision:** Worker Threads (native Node.js) (A)  
Use Node.js Worker Threads for parallel validation:
- Lightweight, no external dependencies (Redis)
- Suitable for MVP scale (≤ 250k resources)
- Can migrate to BullMQ post-MVP if needed
- **Rationale:** Simplifies deployment while providing adequate parallelism for MVP targets.

### 11.5 Security & Credentials
**Decision:** Environment Variables (.env) (B)  
Store remote server credentials in environment variables:
- Standard `.env` file for local development
- Platform-specific secrets (Vercel, Docker Compose) for deployment
- Minimal encryption layer (base64) for basic obfuscation
- **Rationale:** Industry-standard approach; sufficient for MVP demo and single-tenant use; easy migration to Vault later.

### 11.6 Offline Updates (Air-Gapped Environments)
**Decision:** Not supported in MVP (D)  
Air-gapped profile/terminology updates deferred to post-MVP:
- MVP focuses on connected or semi-connected scenarios
- Manual file import can be added in Phase 2 if required
- **Rationale:** Low priority for initial users; adds complexity to MVP scope.

### 11.7 Export Formats
**Decision:** JSON only (A)  
Validation reports exportable as JSON in MVP:
- Structured, machine-readable format
- Easy integration with external tools
- CSV and PDF can be added post-MVP based on user feedback
- **Rationale:** Keeps MVP scope focused; JSON covers programmatic access and is easily transformable.

### 11.8 Batch Remediation Execution Mode (NEW)
**Decision:** Synchronous with progress indicator (A)
Batch remediation executes synchronously with user waiting:
- User receives immediate feedback on success/failure
- Simplifies error handling and conflict resolution
- Progress indicator shows current status
- **Rationale:** Simplest implementation for MVP; async execution can be added in Phase 2 for large batches.

### 11.9 Remediation Preview Sample Size (NEW)
**Decision:** 3 resources (configurable)
Preview shows 3 sample resources with before/after diff:
- Sufficient to identify patterns and verify correctness
- Fast generation (< 3s target)
- Configurable for power users
- **Rationale:** Balances thoroughness with performance; user can request more samples if needed.

### 11.10 Conflict Handling in Batch Remediation (NEW)
**Decision:** Skip conflicted resources, continue with others
When ETag mismatch detected during batch remediation:
- Skip the conflicted resource
- Log the conflict in results
- Continue processing remaining resources
- Report all conflicts in summary
- **Rationale:** Allows partial success; user can re-run remediation for failed resources after resolving conflicts.

---

## 12. Quality Assessment

### 12.1 The Good ✅

**Architecture & Design**
- HL7-compliant, multi-version validation (R4–R6)
- Hybrid architecture with fallback chain
- Integrated Error Mapping Engine → human-readable feedback
- Aspect-based modular engine
- Version-aware validation pipeline
- Comprehensive data model with per-aspect storage
- Same-message grouping for rapid triage

**User Experience**
- In-place and batch editing
- Intelligent batch remediation with preview and revalidation
- Unified, versioned storage model
- Demo-ready with public servers
- Clear version badges and mode indicators
- Immediate feedback loop
- List/detail parity ensures trust in data
- Intuitive multi-criteria filtering

**Technical Implementation**
- Polling-based stability
- Worker threads for parallelism
- Containerized deployment
- Modern tech stack (React + TypeScript + Express)
- Excellent TypeScript coverage
- Performance optimizations (caching, indexing)
- Atomic per-resource operations in batch edits
- Comprehensive audit logging

---

### 12.2 The Bad ⚠️

**Scalability & Performance**
- Single job queue (MVP limit)
- Partial R6 support (terminology/reference best-effort)
- 8-job concurrency only
- Latency dependent on external endpoints
- Synchronous batch remediation may be slow for large batches (1000+ resources)

**Functional Gaps**
- Manual offline/online toggle
- Minimal business rules UI
- Simplified error model for warnings/info
- Limited reference validation scope
- No automated undo/rollback for batch remediation
- No AI-powered correction suggestions

**Data Handling**
- No complex audit trail
- No export scheduling
- Limited retention logic
- No automated backup mechanism

---

### 12.3 The Ugly 🚨

**Missing Production Features**
- No auth / RBAC (single-user MVP)
- No observability stack (logging, metrics, monitoring)
- No automated backup mechanism
- No multi-tenancy
- Credential storage in plain text

**Operational Risks**
- External endpoint instability
- No circuit breaker UI indicators
- Error transparency for non-technical users
- Remote validation error clarity
- No disaster recovery procedures

---

### 12.4 Recommendations for Improvement

**Immediate (MVP+ / next 4–6 weeks)**
1. Add metrics & logging endpoints (Prometheus, structured logging)
2. Expand Error Mapping dictionary (cover more HAPI codes)
3. Auto-detect offline/online state (network probing)
4. Add circuit breaker UI indicators (visual status for external services)
5. Implement async batch remediation for large datasets (>1000 resources)
6. Add rollback/undo capability for batch corrections (version history integration)

**Short-Term (Next Release Cycle)**
1. Parallel batch jobs with BullMQ (remove single-run limitation)
2. Profile package manager UI (install, update, manage IGs)
3. Audit enhancements (full change history, compliance reporting)
4. CSV/PDF export options (reports, validation results)
5. AI-powered correction suggestions (ML-based patterns for common fixes)
6. Template library for common remediation patterns

**Mid-Term (Production Readiness)**
1. Add authentication layer (OAuth2, SAML)
2. Add monitoring stack (Prometheus + Grafana + alerting)
3. Resilience layer for tx.fhir.org (circuit breaker, retry policies, fallback strategies)
4. Compliance alignment (ISO/IEC 27001, HIPAA for US deployments)
5. Multi-tenancy support (organization separation)
6. Automated backup and disaster recovery

---

## 13. Open Questions

### 13.1 Business Logic Clarifications
1. **Remediation Approval Workflow:** Should batch corrections require manager/admin approval before execution?
2. **Correction Templates:** Which common error patterns should have predefined correction templates?
3. **Validation Frequency:** What triggers automatic re-validation of resources beyond edits and batch corrections?
4. **Data Retention:** How long are validation results, remediation audit logs, and cached data retained?
5. **Rollback Policy:** Should there be a time limit for rollback/undo operations (e.g., 24 hours)?

### 13.2 Technical Implementation Details
1. **Large Batch Handling:** Should batches > 1000 resources be automatically split and processed asynchronously?
2. **Concurrent Users:** How many simultaneous users can the system support (especially during batch operations)?
3. **Backup Strategy:** What backup and recovery procedures are implemented for database and audit logs?
4. **Monitoring:** What application monitoring and alerting systems should be integrated?
5. **Remediation Conflict Resolution:** How should the system handle cascading conflicts in batch corrections?

### 13.3 User Experience Considerations
1. **Training Requirements:** What user training or documentation is provided for batch remediation features?
2. **Support Channels:** How do users get help with validation issues and remediation operations?
3. **Customization Limits:** What dashboard, validation, and remediation settings can be customized per user/role?
4. **Export Formats:** Should remediation reports be exportable in formats beyond JSON (PDF, CSV)?
5. **Notification Strategy:** Should users receive email/in-app notifications when batch remediation completes?

---

## 14. Conclusion

The **Records FHIR Validation Platform (Unified MVP v1.2)** delivers a comprehensive hybrid validation engine with version awareness (R4–R6), integrated Error Mapping, and intelligent batch remediation capabilities.

Users can validate, inspect, correct, and systematically clean FHIR resources online or offline with clear, human-readable feedback. The new batch remediation feature enables quality assurance teams and compliance officers to identify, group, and fix systemic data quality issues efficiently with preview, confirmation, and automatic revalidation workflows.

The platform sets a solid foundation for enterprise-scale validation and future compliance expansion, with a clear path toward production-ready features including authentication, multi-tenancy, advanced analytics, and AI-powered correction suggestions.

**In Summary:**
- ✅ Technically sound and HL7-aligned with 6-aspect validation
- ✅ Multi-version support (R4–R6) with dynamic detection
- ✅ Intelligent batch remediation with preview and revalidation
- ✅ Same-message grouping for rapid triage and systematic cleanup
- ✅ List/detail parity ensures data integrity and user trust
- ✅ Usable end-to-end demo with public servers
- ✅ Enterprise-scale performance (25K–250K+ resources)
- ⚠️ Not yet production-ready for KRITIS or multi-user setups (auth, monitoring, backup needed)
- 🚀 Well positioned for iterative growth toward full enterprise validation and remediation platform

**Key Differentiators:**
1. **Hybrid Online/Offline Mode:** Unique flexibility for connected and air-gapped environments
2. **Multi-Version Awareness:** Automatic R4/R5/R6 detection and routing
3. **Integrated Batch Remediation:** End-to-end workflow from error identification to correction and revalidation
4. **Same-Message Grouping:** Rapid identification of systemic issues affecting multiple resources
5. **Error Mapping Engine:** Human-readable explanations for technical validation codes
6. **Per-Aspect Storage:** Deterministic, reusable validation results with full traceability

---

**Document Metadata:**
- Created: October 2025
- Version: MVP v1.2 (Unified)
- Based on: prd-records-fhir-platform-mvp.md (v1.2) + prd-records-fhir-platform.md (v1.0)
- New Features: Batch Remediation, Extended API Contracts, Enhanced Data Model
- Status: Ready for Implementation

