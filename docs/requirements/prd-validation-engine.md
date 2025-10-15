# Product Requirements Document (PRD)
## FHIR Validation Engine - Comprehensive Multi-Aspect Validation System

**Date:** October 2025  
**Version:** 1.0  
**Document Type:** Product Requirements Document  

---

## 1. Introduction / Overview

The **FHIR Validation Engine** is a comprehensive, multi-aspect validation system designed to ensure FHIR resource quality, compliance, and interoperability across R4, R5, and R6 FHIR versions. Built around a modular 6-aspect validation architecture, the engine provides real-time and batch validation capabilities with intelligent caching, error mapping, and hybrid online/offline operation modes.

### Key Differentiators
- **6-Aspect Validation Framework:** Comprehensive coverage of structural, profile, terminology, reference, business rules, and metadata validation
- **Hybrid Online/Offline Mode:** Seamless operation with automatic fallback and connectivity detection
- **Intelligent Error Mapping:** Technical validation codes translated to user-friendly explanations with suggested fixes
- **Smart Profile Resolution:** Automatic discovery and caching of FHIR profiles from Simplifier and other registries
- **Performance-Optimized Terminology:** Direct server integration bypassing slow HAPI overhead
- **Version-Aware Architecture:** Native support for R4, R5, R6 with version-specific routing and packages

### Target Audience
- **Primary Users:** FHIR developers, healthcare IT professionals, compliance officers
- **Secondary Users:** Quality assurance teams, system integrators, clinical informaticists
- **Use Cases:** FHIR resource validation, compliance checking, interoperability testing, data quality assurance

---

## 2. Current System Analysis

### 2.1 Existing Implementation Status

| Component | Status | Implementation | Issues |
|-----------|--------|----------------|--------|
| **Structural Validation** | ✅ Working | HAPI FHIR Validator (JAR-based) | Slow first run (20-30s) |
| **Profile Validation** | ⚠️ Partial | HAPI + Simplifier integration | Missing auto-resolution |
| **Terminology Validation** | ❌ Disabled | Commented out due to performance | Too slow for production |
| **Reference Validation** | ⚠️ Basic | Simple existence checking | No recursive validation |
| **Business Rules** | ⚠️ Basic | FHIRPath evaluator | No visual editor |
| **Metadata Validation** | ⚠️ Basic | Field presence checking | No provenance validation |

### 2.2 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Validation Engine                            │
├─────────────────────────────────────────────────────────────────────┤
│  ValidationEngine (Core Orchestrator)                              │
│  ├─ StructuralValidator    (HAPI JAR)                              │
│  ├─ ProfileValidator       (HAPI + Simplifier)                     │
│  ├─ TerminologyValidator   (DISABLED - Performance Issues)         │
│  ├─ ReferenceValidator     (Basic HTTP Checks)                     │
│  ├─ BusinessRuleValidator  (FHIRPath Evaluator)                    │
│  └─ MetadataValidator      (Field Checking)                        │
├─────────────────────────────────────────────────────────────────────┤
│  Support Services                                                   │
│  ├─ SimplifierClient       (Profile Search & Download)             │
│  ├─ ProfileManager         (Local IG Package Management)           │
│  ├─ TerminologyClient      (Multi-server with Circuit Breakers)    │
│  └─ HapiValidatorClient    (Java Process Management)               │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.3 Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Core Engine** | TypeScript + Node.js | Validation orchestration |
| **Structural Validation** | HAPI FHIR Validator CLI (Java) | Schema validation |
| **Profile Resolution** | Simplifier API + FHIR Package Registry | Profile discovery |
| **Terminology** | tx.fhir.org + CSIRO Ontoserver | Code validation |
| **Storage** | PostgreSQL + Drizzle ORM | Validation results |
| **Caching** | In-memory + File-based | Performance optimization |

---

## 3. Goals & Objectives

### 3.1 Primary Goals
1. **Comprehensive HL7-Compliant Validation** – Six-aspect validation covering all FHIR conformance requirements
2. **Performance Optimization** – Sub-2-second response times for interactive validation
3. **Hybrid Connectivity** – Seamless online/offline operation with automatic fallback
4. **User-Friendly Error Reporting** – Technical codes mapped to actionable explanations
5. **Intelligent Profile Management** – Auto-discovery and caching of FHIR profiles
6. **Multi-Version Support** – Native R4, R5, R6 support with version-specific routing

### 3.2 Success Metrics

| Category | Metric | Target |
|----------|--------|--------|
| **Performance** | Interactive validation response time | < 2s |
| **Performance** | Batch validation throughput | > 100 resources/min |
| **Quality** | Validation accuracy vs HAPI reference | > 98% |
| **Usability** | Error messages with suggested fixes | > 90% |
| **Reliability** | Uptime during network issues (offline mode) | > 99% |
| **Coverage** | Profile auto-resolution success rate | > 95% |

---

## 4. Functional Requirements

### 4.1 Six-Aspect Validation Framework

#### 4.1.1 Structural Validation
**Current State:** ✅ Working (HAPI FHIR Validator)
**Improvements Needed:**
- **Fast Startup:** Pre-warm HAPI validator to eliminate 20-30s first-run delay
- **Process Pooling:** Maintain persistent Java processes to avoid spawn overhead
- **Version Routing:** Automatic R4/R5/R6 core package selection

**Requirements:**
- Schema and datatype validation per FHIR specification
- Cardinality constraint checking
- Element structure validation
- Support for R4 (4.0.x), R5 (5.0.x), R6 (6.0.x-preview)
- Response time: < 2s for cached, < 5s for first-time validation

#### 4.1.2 Profile Validation
**Current State:** ⚠️ Partial (HAPI + basic Simplifier integration)
**Improvements Needed:**
- **Smart Canonical Resolution:** Auto-fetch profiles by canonical URL
- **Profile Caching:** Local storage with version management
- **IG Package Management:** Automatic dependency resolution

**Requirements:**
- StructureDefinition conformance validation
- Profile constraint checking (invariants, extensions)
- Canonical URL → Profile resolution with caching
- Auto-download missing profiles from Simplifier/FHIR Registry
- German healthcare profiles support (MII, ISiK, KBV)
- Version-specific IG package loading

**Profile Resolution Workflow:**
```
Resource references profile canonical URL
  ↓
Check local profile cache
  ↓ (miss)
Search Simplifier + FHIR Registry for profile
  ↓
Download and cache profile + dependencies
  ↓
Validate resource against resolved profile
```

#### 4.1.3 Terminology Validation ⭐ **Major Improvement**
**Current State:** ❌ Disabled (performance issues with HAPI)
**New Implementation:** Direct terminology server integration

**Requirements:**
- **Direct HTTP Validation:** Bypass HAPI, use ValueSet/$validate-code operations
- **Multi-Server Support:** tx.fhir.org (primary) + CSIRO Ontoserver (fallback)
- **Intelligent Caching:** 1-hour cache for online, persistent cache for offline
- **Circuit Breaker:** Auto-fallback when servers unavailable
- **Version Routing:** R4 → tx.fhir.org/r4, R5 → tx.fhir.org/r5, R6 → tx.fhir.org/r6

**Terminology Validation Flow:**
```
Extract codes from resource (CodeableConcept, Coding, code fields)
  ↓
Check validation cache (SHA-256 key: system|code|valueSet|version)
  ↓ (miss)
Call terminology server: POST [base]/ValueSet/$validate-code
  ↓ (with circuit breaker)
Cache result + TTL
  ↓
Return validation issues
```

#### 4.1.4 Reference Validation
**Current State:** ⚠️ Basic (existence checking only)
**Improvements Needed:**
- **Type Validation:** Verify referenced resource matches expected type
- **Recursive Validation:** Optionally validate referenced resources
- **Circular Reference Detection:** Prevent infinite loops

**Requirements:**
- Reference existence checking (HTTP HEAD requests)
- Resource type validation against reference constraints
- Conditional reference validation (when resource already loaded)
- Bundle reference resolution (internal references)
- Version-aware reference checking

#### 4.1.5 Business Rules Validation
**Current State:** ⚠️ Basic (FHIRPath evaluator)
**Improvements Needed:**
- **Visual Rule Editor:** User-friendly interface for non-developers
- **Rule Library:** Pre-built rules for common validation scenarios
- **Performance Optimization:** Compiled rule execution

**Requirements:**
- FHIRPath expression evaluation
- JSONPath expression support (legacy)
- Visual rule builder with syntax highlighting
- Rule templates for common patterns
- Cross-field validation logic
- Clinical decision support integration

#### 4.1.6 Metadata Validation
**Current State:** ⚠️ Basic (field presence)
**Improvements Needed:**
- **Provenance Chain Validation:** Verify resource lineage
- **Version Consistency:** Check meta.versionId integrity
- **Security Label Validation:** Verify security tags

**Requirements:**
- meta.lastUpdated timestamp validation
- meta.versionId consistency checking
- meta.security label validation
- Provenance resource linkage verification
- Audit trail integrity checking

### 4.2 Hybrid Online/Offline Operation

#### 4.2.1 Connectivity Detection
**Requirements:**
- **Auto-Detection:** Monitor network connectivity to terminology servers
- **Graceful Fallback:** Online → offline transition without user intervention
- **Health Monitoring:** Periodic server health checks
- **Manual Override:** User can force online/offline mode

#### 4.2.2 Offline Mode Capabilities
**Requirements:**
- **Local Terminology Server:** Integration with local Ontoserver
- **Cached Profiles:** Local IG package storage
- **Cached ValueSets:** Pre-downloaded terminology for common use cases
- **Degraded Mode Indicators:** Clear UI indication of reduced functionality

#### 4.2.3 Cache Management
**Requirements:**
- **Intelligent TTL:** 1-hour online cache, persistent offline cache
- **Cache Invalidation:** Version-based cache keys
- **Storage Limits:** Configurable cache size limits with LRU eviction
- **Cache Warming:** Pre-populate common profiles and terminology

### 4.3 Error Mapping & User Experience

#### 4.3.1 Error Mapping Dictionary ⭐ **New Feature**
**Requirements:**
- **Technical Code Translation:** Map HAPI/FHIR codes to user-friendly messages
- **Suggested Fixes:** Actionable recommendations for common errors
- **Context-Aware Help:** Error explanations with resource context
- **Multilingual Support:** Error messages in multiple languages

**Error Mapping Examples:**
```json
{
  "terminology-code-unknown": {
    "userMessage": "The code '{code}' is not recognized in the {system} coding system",
    "suggestedFixes": [
      "Check the code spelling",
      "Verify the correct coding system is used",
      "Use a code from the required ValueSet: {valueSet}"
    ],
    "severity": "error",
    "documentation": "https://hl7.org/fhir/terminology.html#validation"
  }
}
```

#### 4.3.2 Validation Result Enhancement
**Requirements:**
- **Issue Grouping:** Group related validation issues
- **Severity Scoring:** Overall resource quality score (0-100)
- **Progress Indicators:** Real-time validation progress for batch operations
- **Before/After Comparison:** Show validation improvements after edits

### 4.4 Profile Management System

#### 4.4.1 Automatic Profile Discovery
**Requirements:**
- **Canonical URL Resolution:** Auto-resolve profiles referenced in resources
- **Dependency Management:** Download dependent IG packages
- **Version Management:** Handle multiple profile versions
- **Search Integration:** Search Simplifier, FHIR Registry, and local sources

#### 4.4.2 Profile Installation Workflow
**Requirements:**
```
User references profile canonical → Auto-detection
  ↓
Search profile registries (Simplifier + FHIR Registry)
  ↓
Download profile + dependencies
  ↓
Install to local cache
  ↓
Validate resource against installed profile
```

#### 4.4.3 German Healthcare Profile Support
**Requirements:**
- **MII Profiles:** Medizininformatik-Initiative profiles
- **ISiK Profiles:** Informationstechnische Systeme in Krankenhäusern
- **KBV Profiles:** Kassenärztliche Bundesvereinigung profiles
- **Auto-Detection:** Smart detection based on canonical URLs
- **Version Compatibility:** R4/R5 version-specific packages

---

## 5. Technical Architecture

### 5.1 Improved Validation Engine Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                   Enhanced Validation Engine                        │
├─────────────────────────────────────────────────────────────────────┤
│  ValidationEngine (Core Orchestrator)                              │
│  ├─ StructuralValidator    (Optimized HAPI with Process Pool)      │
│  ├─ ProfileValidator       (Smart Resolution + Caching)            │
│  ├─ TerminologyValidator   (Direct HTTP + Multi-Server)            │
│  ├─ ReferenceValidator     (Enhanced Type Checking)                │
│  ├─ BusinessRuleValidator  (Visual Editor + Rule Library)          │
│  └─ MetadataValidator      (Provenance + Security Validation)      │
├─────────────────────────────────────────────────────────────────────┤
│  Intelligence Layer (NEW)                                          │
│  ├─ ErrorMappingEngine     (Technical → User-Friendly)             │
│  ├─ ConnectivityDetector   (Network Health + Auto-Fallback)        │
│  ├─ ProfileResolver        (Canonical → Local Cache)               │
│  └─ ValidationCache        (Multi-Layer with TTL)                  │
├─────────────────────────────────────────────────────────────────────┤
│  Enhanced Services                                                  │
│  ├─ DirectTerminologyClient (HTTP API Calls)                       │
│  ├─ ProfileManagerV2       (Auto-Discovery + Dependencies)         │
│  ├─ ProcessPoolManager     (Java Process Management)               │
│  └─ CircuitBreakerManager  (Resilience Patterns)                   │
└─────────────────────────────────────────────────────────────────────┘
```

### 5.2 Performance Optimization Strategy

#### 5.2.1 HAPI Validator Optimization
- **Process Pool:** Maintain 2-4 persistent Java processes
- **Warm-up Cache:** Pre-load common IG packages
- **Resource Sharing:** Share loaded packages between processes
- **Memory Management:** Configure optimal Java heap sizes

#### 5.2.2 Terminology Validation Optimization
- **Direct HTTP Calls:** Bypass HAPI for terminology validation
- **Batch Operations:** Group multiple codes in single requests
- **Intelligent Caching:** SHA-256 cache keys with version awareness
- **Parallel Requests:** Concurrent terminology server calls

#### 5.2.3 Caching Strategy
```
┌─────────────────────────────────────────────────────────────────────┐
│                        Multi-Layer Cache                           │
├─────────────────────────────────────────────────────────────────────┤
│  L1: In-Memory (Hot Cache)                                         │
│  ├─ Validation Results (5min TTL)                                  │
│  ├─ Profile Definitions (30min TTL)                                │
│  └─ Terminology Codes (1hr TTL online, ∞ offline)                  │
├─────────────────────────────────────────────────────────────────────┤
│  L2: Database (Persistent Cache)                                   │
│  ├─ Profile Cache (SHA-256 versioned keys)                         │
│  ├─ Terminology Cache (System|Code|ValueSet keys)                  │
│  └─ Validation History (Audit trail)                               │
├─────────────────────────────────────────────────────────────────────┤
│  L3: File System (IG Packages)                                     │
│  ├─ Downloaded Profiles                                            │
│  ├─ IG Package Cache                                               │
│  └─ HAPI Package Storage                                           │
└─────────────────────────────────────────────────────────────────────┘
```

### 5.3 Data Flow Architecture

#### 5.3.1 Real-Time Validation Flow
```
Resource Edit → Validation Request
  ↓
Check L1 Cache (Resource Hash + Settings Hash)
  ↓ (miss)
Parallel Aspect Validation:
  ├─ Structural (Process Pool)
  ├─ Profile (Cache + Auto-Resolve)
  ├─ Terminology (Direct HTTP)
  ├─ Reference (Enhanced Type Check)
  ├─ Business Rules (Compiled FHIRPath)
  └─ Metadata (Provenance Chain)
  ↓
Aggregate Results + Error Mapping
  ↓
Cache Results (L1 + L2)
  ↓
Return Validation Issues + Quality Score
```

#### 5.3.2 Batch Validation Flow
```
Batch Validation Request (N resources)
  ↓
Resource Hash Deduplication
  ↓
Check Cache Coverage
  ↓
Priority Queue (Cached vs Non-cached)
  ↓
Parallel Validation (Respecting Server Limits)
  ↓
Progress Updates via WebSocket/Polling
  ↓
Results Aggregation + Statistics
```

---

## 6. User Stories

### 6.1 Developer Experience
- **As a** FHIR developer, **I can** validate resources in real-time while editing **so that** I get immediate feedback on conformance issues
- **As a** developer, **I can** see user-friendly error explanations with suggested fixes **so that** I understand how to correct validation issues
- **As a** developer, **I can** validate resources offline **so that** I can work without internet connectivity

### 6.2 Quality Assurance
- **As a** QA engineer, **I can** batch validate large datasets **so that** I can assess overall data quality
- **As a** QA engineer, **I can** see validation progress and statistics **so that** I can monitor validation jobs
- **As a** QA engineer, **I can** export validation results **so that** I can share findings with stakeholders

### 6.3 Compliance Officer
- **As a** compliance officer, **I can** validate against specific profiles **so that** I can ensure regulatory compliance
- **As a** compliance officer, **I can** see validation audit trails **so that** I can demonstrate compliance processes
- **As a** compliance officer, **I can** configure validation rules **so that** I can enforce organizational policies

### 6.4 System Integration
- **As a** system integrator, **I can** validate FHIR resources via API **so that** I can integrate validation into CI/CD pipelines
- **As a** system integrator, **I can** customize validation aspects **so that** I can focus on relevant validation concerns
- **As a** system integrator, **I can** configure terminology servers **so that** I can use organization-specific code systems

---

## 7. Non-Goals / Out of Scope

### 7.1 MVP Exclusions
- **Custom Profile Creation:** Validation only, not profile authoring
- **Real-time Collaboration:** Multi-user editing of resources
- **Advanced Analytics:** ML-based validation prediction
- **Clinical Decision Support:** Beyond basic business rules
- **Resource Transformation:** Validation only, not data conversion

### 7.2 Platform Limitations
- **Mobile Applications:** Web-based interface only
- **Air-Gapped Updates:** Manual package import not supported
- **Enterprise SSO:** Basic authentication only
- **Multi-tenancy:** Single organization deployment
- **Scalability:** Optimized for <100K resources, not enterprise scale

---

## 8. Technical Constraints

### 8.1 Dependencies
- **Java Runtime:** Required for HAPI FHIR Validator (JDK 11+)
- **Network Connectivity:** Online mode requires internet access
- **PostgreSQL:** Database for caching and audit trails
- **Node.js:** Runtime for validation engine (Node 18+)

### 8.2 Performance Limits
- **Concurrent Validations:** Max 10 parallel validation jobs
- **Memory Usage:** Target <2GB RAM for validation engine
- **Response Time:** <2s for interactive, <30s for batch (100 resources)
- **Cache Size:** Configurable, default 1GB total cache

### 8.3 Security Considerations
- **Network Security:** HTTPS for all external communications
- **Data Privacy:** No PHI stored in validation cache
- **Access Control:** Resource-level validation permissions
- **Audit Logging:** Complete validation activity logging

---

## 9. Implementation Roadmap

### 9.1 Phase 1: Core Improvements (4-6 weeks)
1. **Week 1-2:** Terminology validation rewrite (direct HTTP)
2. **Week 3:** Error mapping dictionary implementation
3. **Week 4:** HAPI process pool optimization
4. **Week 5-6:** Smart profile resolution system

### 9.2 Phase 2: User Experience (3-4 weeks)
1. **Week 1-2:** Visual business rules editor
2. **Week 3:** Enhanced error reporting with suggestions
3. **Week 4:** Connectivity detection and auto-fallback

### 9.3 Phase 3: Advanced Features (4-5 weeks)
1. **Week 1-2:** Enhanced reference validation
2. **Week 3:** Provenance and metadata validation
3. **Week 4-5:** German healthcare profiles integration

---

## 10. Quality Assessment

### 10.1 The Good ✅

**Architecture & Performance**
- Modular 6-aspect validation framework
- Version-aware R4/R5/R6 support
- Comprehensive FHIR conformance coverage
- Multi-layer caching strategy
- Circuit breaker resilience patterns

**Integration & Compatibility**
- HAPI FHIR Validator integration (industry standard)
- Simplifier and FHIR Registry integration
- Multiple terminology server support
- Hybrid online/offline operation
- PostgreSQL persistence with audit trails

### 10.2 The Challenges ⚠️

**Current Performance Issues**
- HAPI validator slow startup (20-30s first run)
- Terminology validation disabled due to performance
- No process pooling for Java validator
- Limited caching optimization
- No error mapping for user experience

**Functional Gaps**
- Basic reference validation (existence only)
- Limited business rules editor
- Manual profile management
- No connectivity detection
- Minimal metadata validation

### 10.3 The Risks 🚨

**Technical Risks**
- Java dependency for structural validation
- Network dependency for online terminology
- Memory usage with large IG packages
- Single points of failure in terminology servers

**Operational Risks**
- Complex multi-component system
- External service dependencies (Simplifier, tx.fhir.org)
- Cache invalidation complexity
- Version compatibility across R4/R5/R6

---

## 11. Success Criteria

### 11.1 Performance Metrics
- ✅ **Interactive Validation:** <2s response time (95th percentile)
- ✅ **Batch Validation:** >100 resources/minute throughput
- ✅ **Cache Hit Rate:** >80% for frequently validated resources
- ✅ **Uptime:** >99% availability including offline mode

### 11.2 Quality Metrics
- ✅ **Validation Accuracy:** >98% alignment with HAPI reference implementation
- ✅ **Error Resolution:** >90% of errors include suggested fixes
- ✅ **Profile Coverage:** >95% successful auto-resolution of canonical URLs
- ✅ **User Satisfaction:** <5% support tickets related to validation errors

### 11.3 Technical Metrics
- ✅ **Memory Efficiency:** <2GB RAM usage under typical load
- ✅ **Network Resilience:** Graceful degradation when servers unavailable
- ✅ **Cache Efficiency:** <1GB storage for typical profile/terminology cache
- ✅ **Audit Completeness:** 100% validation activities logged for compliance

---

## 12. Open Questions & Future Considerations

### 12.1 Immediate Questions
1. **Resource Prioritization:** Should some resource types have higher validation priority?
2. **Batch Size Optimization:** What's the optimal batch size for different validation aspects?
3. **Cache Persistence:** How long should validation results be cached?
4. **Error Threshold:** At what point should validation be considered failed vs degraded?

### 12.2 Future Enhancements
1. **AI-Powered Validation:** Machine learning for validation pattern recognition
2. **Real-time Collaboration:** Multi-user resource editing with live validation
3. **Advanced Analytics:** Validation trend analysis and quality metrics
4. **Enterprise Integration:** SAML/OIDC authentication and audit integration
5. **Mobile Support:** Native mobile applications for validation

### 12.3 Scalability Considerations
1. **Distributed Validation:** Microservices architecture for large-scale deployment
2. **Cloud Integration:** AWS/Azure deployment with managed services
3. **Multi-tenancy:** Organization isolation and resource sharing
4. **Global Distribution:** CDN for profile packages and terminology caching

---

## Conclusion

The **FHIR Validation Engine** represents a comprehensive solution for FHIR resource quality assurance, combining industry-standard validation tools with intelligent caching, user-friendly error reporting, and hybrid connectivity. The recommended improvements focus on performance optimization, user experience enhancement, and operational resilience.

**Key Success Factors:**
1. **Performance First:** Sub-2-second interactive validation through caching and optimization
2. **User Experience:** Technical validation made accessible through error mapping and suggestions  
3. **Reliability:** Hybrid online/offline operation ensures continuous availability
4. **Intelligence:** Auto-discovery and caching reduces manual configuration overhead
5. **Compliance:** Complete audit trails and validation coverage for regulatory requirements

**Next Steps:**
1. Implement terminology validation optimization (Phase 1 priority)
2. Create error mapping dictionary with suggested fixes
3. Develop smart profile resolution system
4. Establish performance benchmarks and monitoring

This PRD provides a roadmap for transforming the validation engine from a functional prototype into a production-ready, user-friendly FHIR validation platform suitable for healthcare organizations, developers, and compliance teams.

---

**Document Metadata:**
- **Created:** October 2025
- **Based on:** Codebase analysis of existing validation engine implementation
- **Scope:** Comprehensive validation system for FHIR R4/R5/R6
- **Status:** Ready for implementation planning
