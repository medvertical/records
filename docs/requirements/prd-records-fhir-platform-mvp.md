# Product Requirements Document (PRD)
## Records FHIR Validation Platform – MVP v1.2

**Date:** October 2025  
**Version:** MVP v1.2 (Hybrid + Multi-Version-Aware Validation Architecture)  
**Document Type:** Product Requirements Document for MVP Release  

---

## 1. Introduction / Overview

**Records** is a FHIR (Fast Healthcare Interoperability Resources) validation and management platform that enables healthcare organizations and IT teams to inspect, validate, and improve the quality of FHIR data across one or more servers.  
The MVP focuses on a **hybrid, multi-version-aware validation engine** capable of operating in both **online (remote-connected)** and **offline (self-contained)** modes.

Validation follows HL7's recommended approach, covering all computable aspects (structure, cardinality, bindings, profiles, invariants) while offering additional local checks for metadata and business rules.  
The system integrates the **HAPI FHIR Validation Engine** as its core, connecting to public demo endpoints for remote validation and to a **local Ontoserver** for terminology resolution in offline mode.

### Key Concepts
- **Six-Aspect Validation:** Structural · Profile · Terminology · Reference · Metadata · Business Rules  
- **Hybrid Mode:** switch between *Online (tx.fhir.org / Simplifier / HAPI demo)* and *Offline (local Ontoserver + cached IGs)*  
- **FHIR Version Awareness:** detect and support R4, R5, and R6 servers dynamically  
- **Editable Resources:** users can correct issues directly ("in-place") or via batch edit, triggering immediate re-validation  
- **Per-Aspect & Per-Version Results:** results stored separately by aspect and FHIR version for deterministic comparison  
- **Error Mapping Engine:** translates HAPI FHIR validator codes into friendly, human-readable explanations  

---

## 2. Goals

1. **Comprehensive HL7-Compliant Validation** – six-aspect validation via HAPI FHIR Validator with optional `$validate` calls and local Ontoserver fallback.  
2. **Multi-Version Compatibility (R4 → R6)** – automatic detection of FHIR version and routing of validation, profiles, and terminologies.  
3. **Hybrid Connectivity (Online ↔ Offline)** – switch between remote validation services and offline packages.  
4. **Immediate Feedback Loop** – per-aspect validation results update automatically after edits.  
5. **In-Place & Batch Editing** – corrections trigger queued re-validation with change comparison.  
6. **Error Mapping Engine (Built In)** – normalize raw HAPI codes (e.g. `terminology-check-failed`) into descriptive explanations.  
7. **Unified Validation Storage (Versioned)** – persist results per aspect and FHIR version.  
8. **Configurable Runtime Behavior** – centralized YAML/JSON config or UI switches for modes and aspects.  
9. **Resilient Polling Model** – deterministic progress reporting without WebSockets.  
10. **Usable Demo Mode** – preconfigured endpoints for instant testing.  

---

## 3. User Stories (MVP Scope)

**Server Management**
- Admin connects multiple FHIR servers (R4–R6) and compares datasets.  
- System auto-detects FHIR version and tests connectivity.  
- Admin toggles Online / Offline Mode.  

**Resource Validation**
- Compliance officer validates all resources across aspects and versions.  
- Developer validates a single resource and gets structured feedback.  
- User filters messages by identical signature or error code mapping.  
- Validator revalidates after edits and compares before/after.  

**Editing & Remediation**
- User edits inline → auto-revalidation.  
- Admin runs batch edit and monitors progress.  
- User views Error Mapping explanations inline in UI.  

**Dashboard & Monitoring**
- Manager views error/warning distribution by aspect and version.  
- User tracks coverage per version and mode.  
- Admin pauses/resumes batch jobs.  

---

## 4. Functional Requirements (MVP)

### 4.1 Server Management
1. Connect to multiple FHIR servers with auth.  
2. Detect FHIR version (R4/R5/R6) from `CapabilityStatement.fhirVersion`.  
3. Store settings + version per server.  
4. Refresh resource lists on server switch.  

### 4.2 Validation Engine
1. **Structural Validation:** schema + datatype checks via HAPI Validator.  
2. **Profile Validation:** version-specific IG packages (Simplifier/local).  
3. **Terminology Validation:** tx.fhir.org (online) or Ontoserver (offline).  
4. **Reference Validation:** verify references exist + are version-consistent.  
5. **Metadata Validation:** check `meta.lastUpdated`, `versionId`, `security`.  
6. **Business Rules:** execute FHIRPath/JSONPath expressions.  
7. **Error Mapping Engine:** normalize HAPI FHIR issue codes to descriptive messages using `error_map.json`.  
8. Persist OperationOutcome → normalized `IssueCard` ( aspect + version + mappedExplanation ).  

### 4.3 Editing & Revalidation
- Inline JSON edit + diff preview → save → revalidate.  
- Batch edit across resources → queued jobs.  
- Conflict detection via ETag.  
- Audit metadata: `before_hash`, `after_hash`, `editedAt`, `editedBy`, `fhirVersion`.  

### 4.4 Batch Validation
- Manual start from dashboard.  
- One active batch (job queue MVP limit).  
- Progress (queued / running / paused / done).  
- Retry + back-pressure for external calls.  

### 4.5 Configuration & Modes
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
```

---

## 5. Non-Goals / Out of Scope

- Multi-tenancy (single tenant only)
- Authentication / RBAC – none in MVP
- WebSockets/SSE – polling only
- ML/analytics – post-MVP
- Full audit trail – minimal only
- Automated remediation – manual
- Complex reports – JSON export only

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
- Server version badge (R4/R5/R6)
- Filter by version and aspect
- Error Mapping tooltip explains codes
- Warning banner for unsupported versions (e.g. R6)

---

### 6.4 Data Model (Versioned)

| Table | Field | Description |
|-------|-------|-------------|
| `fhir_servers` | `fhir_version` | Detected FHIR version |
| `validation_results` | `fhir_version` | Version context |
| `validation_messages` | `fhir_version` | For cross-version filtering |
| `validation_jobs` | `fhir_version` | Version-consistent execution |
| `edits` | `fhir_version` | Audit trace integrity |

---

## 7. Polling Strategy

- **Default interval:** 30 s (10–60 adaptive)
- **Endpoints:** `/api/validation/progress`, `/api/validation/issues/groups`, `/api/validation/resources/:id`
- **Resilience:** Exponential backoff + graceful resume
- **Outdated results:** "Pending revalidation"

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
 → Aggregate OperationOutcome → Normalize → Persist (aspect + version)
 → UI polls for results
```

---

#### 8.2.1 FHIR Version Strategy

- Detect from `CapabilityStatement.fhirVersion`
- **Supported:** R4 (4.0.x), R5 (5.0.x), R6 (6.0.x-preview)
- R6 limited to structure + profile validation
- Version-specific core packages (`hl7.fhir.rX.core`)
- Terminology routing by version (`tx.fhir.org/{r4|r5|r6}`)
- Version stored with each validation record

---

## 9. Success Metrics

| Category | KPI | Target |
|----------|-----|--------|
| **Functional** | Validation coverage | ≥ 95 % |
| | Revalidation latency | < 10 s |
| | Batch completion | ≥ 98 % |
| **UX** | Dashboard load | < 1 s |
| | Mode switch | ≤ 2 s |
| | Version detection accuracy | 100 % |
| | Error Mapping accuracy | ≥ 95 % mapped codes |
| **Technical** | Uptime | > 99 % |
| | Terminology fallback success | ≥ 90 % |
| | No unhandled exceptions | per 10 k runs |

---

## 10. Design Decisions (Resolved)

### 10.1 Profile Sources (Offline Mode)
**Decision:** German profiles + international extensions (C)  
Pre-cache the following IG packages for offline mode:
- **German Profiles:** MII (Medizininformatik-Initiative), ISiK, KBV
- **International Extensions:** HL7 FHIR Core R4/R5, UV Extensions
- **Rationale:** Supports both German healthcare requirements and international interoperability use cases.

### 10.2 Business Rules Engine
**Decision:** Visual FHIRPath editor (A)  
Implement a user-friendly visual editor for custom FHIRPath expressions with:
- Syntax highlighting and validation
- Autocomplete for resource paths
- Test mode with sample resources
- **Rationale:** Empowers non-developer users (compliance officers, QA teams) to define validation logic without coding.

### 10.3 Terminology Synchronisation
**Decision:** Hybrid (Auto-check + manual approval) (C)  
Ontoserver ValueSet imports follow a controlled workflow:
- Automated check for new/updated ValueSets from configured sources
- Admin notification of available updates
- Manual review and approval before import
- **Rationale:** Balances automation with governance; prevents unintended terminology changes in production.

### 10.4 Batch Scaling
**Decision:** Worker Threads (native Node.js) (A)  
Use Node.js Worker Threads for parallel validation:
- Lightweight, no external dependencies (Redis)
- Suitable for MVP scale (≤ 25k resources)
- Can migrate to BullMQ post-MVP if needed
- **Rationale:** Simplifies deployment while providing adequate parallelism for MVP targets.

### 10.5 Security & Credentials
**Decision:** Environment Variables (.env) (B)  
Store remote server credentials in environment variables:
- Standard `.env` file for local development
- Platform-specific secrets (Vercel, Docker Compose) for deployment
- Minimal encryption layer (base64) for basic obfuscation
- **Rationale:** Industry-standard approach; sufficient for MVP demo and single-tenant use; easy migration to Vault later.

### 10.6 Offline Updates (Air-Gapped Environments)
**Decision:** Not supported in MVP (D)  
Air-gapped profile/terminology updates deferred to post-MVP:
- MVP focuses on connected or semi-connected scenarios
- Manual file import can be added in Phase 2 if required
- **Rationale:** Low priority for initial users; adds complexity to MVP scope.

### 10.7 Export Formats
**Decision:** JSON only (A)  
Validation reports exportable as JSON in MVP:
- Structured, machine-readable format
- Easy integration with external tools
- CSV and PDF can be added post-MVP based on user feedback
- **Rationale:** Keeps MVP scope focused; JSON covers programmatic access and is easily transformable.

---

## 11. Quality Assessment

### 11.1 The Good ✅

**Architecture & Design**
- HL7-compliant, multi-version validation (R4–R6)
- Hybrid architecture with fallback chain
- Integrated Error Mapping Engine → human-readable feedback
- Aspect-based modular engine
- Version-aware validation pipeline

**User Experience**
- In-place and batch editing
- Unified, versioned storage model
- Demo-ready with public servers
- Clear version badges and mode indicators
- Immediate feedback loop

**Technical Implementation**
- Polling-based stability
- Worker threads for parallelism
- Containerized deployment
- Modern tech stack (React + TypeScript + Express)

---

### 11.2 The Bad ⚠️

**Scalability & Performance**
- Single job queue (MVP limit)
- Partial R6 support
- 8-job concurrency only
- Latency dependent on external endpoints

**Functional Gaps**
- Manual offline/online toggle
- Minimal business rules UI
- Simplified error model for warnings/info
- Limited reference validation scope

**Data Handling**
- No complex audit trail
- No export scheduling
- Limited retention logic

---

### 11.3 The Ugly 🚨

**Missing Production Features**
- No auth / RBAC
- No observability stack
- No backup mechanism
- No multi-tenancy

**Operational Risks**
- External endpoint instability
- No circuit breaker UI
- Error transparency for non-technical users
- Remote validation error clarity

---

### 11.4 Recommendations for Improvement

**Immediate (MVP+ / next 4–6 weeks)**
1. Add metrics & logging endpoints
2. Expand Error Mapping dictionary
3. Auto-detect offline/online state
4. Add circuit breaker UI indicators

**Short-Term (Next Release Cycle)**
1. Parallel batch jobs with BullMQ
2. Profile package manager UI
3. Audit enhancements
4. CSV/PDF export options

**Mid-Term (Production Readiness)**
1. Add authentication layer
2. Add monitoring stack (Prometheus + Grafana)
3. Resilience layer for tx.fhir.org
4. Compliance alignment (ISO/IEC 27001)

---

## 12. Conclusion

The **Records FHIR Validation Platform (MVP v1.2)** delivers a complete hybrid validation engine with version awareness (R4–R6) and integrated Error Mapping.

Users can validate, inspect, and correct FHIR resources online or offline with clear, human-readable feedback. The platform sets a solid foundation for enterprise-scale validation and future compliance expansion.

**In Summary:**
- ✅ Technically sound and HL7-aligned
- ✅ Multi-version support (R4–R6)
- ✅ Usable end-to-end demo with public servers
- ⚠️ Not yet production-ready for KRITIS or multi-user setups
- 🚀 Well positioned for iterative growth toward full validation platform

---
