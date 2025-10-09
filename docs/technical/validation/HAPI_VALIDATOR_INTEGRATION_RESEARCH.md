# HAPI FHIR Validator Integration Research

**Task:** 1.1 Research HAPI FHIR Validator integration options  
**Date:** October 9, 2025  
**Status:** COMPLETED ✅

---

## Executive Summary

This document evaluates integration options for the HAPI FHIR Validator in the Records FHIR Validation Platform. The goal is to replace current stub validators with real FHIR validation using HAPI's production-grade validation engine.

**Recommendation:** Use **Node.js Wrapper around HAPI CLI** (Option 3) for MVP, with a migration path to native TypeScript library if available post-MVP.

---

## Current State Analysis

### Existing Dependencies

```json
{
  "@asymmetrik/fhir-json-schema-validator": "^0.9.8",  // Currently used for basic schema validation
  "fhir-validator": "^0.5.1"                           // Installed but NOT used
}
```

### Current Implementation Issues

1. **StructuralValidator** (1595 lines): Returns empty arrays (stub)
2. **ProfileValidator** (464 lines): Only checks if `meta.profile` exists (stub)
3. **TerminologyValidator** (440 lines): Temporarily disabled for performance
4. **Impact:** 100% validation scores for ALL resources (false positives)

### What We Need

- HL7-compliant validation covering:
  - ✅ Structural validation (schema, cardinality, datatypes)
  - ✅ Profile validation (StructureDefinition conformance)
  - ✅ Terminology validation (CodeSystem, ValueSet binding)
  - ✅ FHIRPath constraint validation (invariants)
  - ✅ Multi-version support (R4, R5, R6)
- Parse HAPI `OperationOutcome` responses
- Integration with offline/online modes
- Performance: <10s per resource validation

---

## Integration Options

### Option 1: HAPI FHIR Java Library (Direct JVM Integration)

**Description:** Run HAPI FHIR Validator as a Java library via JNI or child process.

#### Approach A: JNI Bridge
```typescript
// Hypothetical integration via java-bridge
import java from 'java';
java.classpath.push('/path/to/hapi-fhir-validator.jar');

const FhirValidator = java.import('org.hl7.fhir.validation.ValidationEngine');
const validator = new FhirValidator();
const outcome = validator.validate(resourceJson, profileUrl);
```

#### Approach B: Child Process
```typescript
import { exec } from 'child_process';

const result = await new Promise((resolve, reject) => {
  exec(
    `java -jar hapi-fhir-validator.jar -profile ${profileUrl} resource.json`,
    (error, stdout, stderr) => {
      if (error) reject(error);
      resolve(JSON.parse(stdout));
    }
  );
});
```

#### Pros
- ✅ Official HAPI implementation (production-grade)
- ✅ Complete feature set (all validation aspects)
- ✅ Multi-version support (R4, R5, R6)
- ✅ Active maintenance by HL7/HAPI community
- ✅ Comprehensive IG package support

#### Cons
- ❌ Requires JVM (Java Runtime) in deployment
- ❌ Performance overhead (JVM startup, IPC)
- ❌ Complex dependency management
- ❌ Debugging challenges across language boundaries
- ❌ Increased deployment complexity (Docker image size)

#### Feasibility: ⚠️ **MEDIUM** (Adds significant deployment complexity)

---

### Option 2: HAPI FHIR Validator REST API

**Description:** Deploy HAPI FHIR Validator as a separate microservice and call it via HTTP.

#### Architecture
```
┌──────────────────┐         HTTP POST          ┌─────────────────────┐
│  Records Backend │ ───────────────────────────> │  HAPI Validator API │
│   (TypeScript)   │                             │      (Java/Docker)  │
└──────────────────┘         OperationOutcome    └─────────────────────┘
                      <───────────────────────────
```

#### Implementation
```typescript
export class HapiValidatorClient {
  private readonly apiUrl: string;

  async validateResource(
    resource: any,
    profileUrl?: string,
    fhirVersion: 'R4' | 'R5' | 'R6' = 'R4'
  ): Promise<OperationOutcome> {
    const response = await axios.post(`${this.apiUrl}/validate`, {
      resource,
      profile: profileUrl,
      version: fhirVersion
    }, {
      timeout: 10000,
      headers: { 'Content-Type': 'application/fhir+json' }
    });

    return this.parseOperationOutcome(response.data);
  }
}
```

#### Pros
- ✅ Clean separation of concerns
- ✅ Language-agnostic (no JVM in Node.js app)
- ✅ Scalable independently (separate service)
- ✅ Easy to test and debug
- ✅ Containerized deployment (Docker)
- ✅ Official HAPI implementation

#### Cons
- ❌ Network latency overhead
- ❌ Additional service to deploy/monitor
- ❌ Retry/circuit breaker logic required
- ❌ Offline mode complexity (need local instance)
- ❌ Increased infrastructure cost

#### Feasibility: ✅ **HIGH** (Best for production, but adds operational complexity)

---

### Option 3: Node.js Wrapper around HAPI CLI (⭐ RECOMMENDED FOR MVP)

**Description:** Use existing `fhir-validator` npm package or create a thin wrapper around HAPI CLI.

#### Package Investigation: `fhir-validator@0.5.1`

The project already has `fhir-validator` installed. This package wraps the HAPI FHIR CLI.

**Expected API:**
```typescript
import { FhirValidator } from 'fhir-validator';

const validator = new FhirValidator({
  version: 'R4',
  txServer: 'https://tx.fhir.org/r4',
  igPackages: ['hl7.fhir.r4.core@4.0.1']
});

const result = await validator.validate(resourceJson, {
  profile: 'http://hl7.org/fhir/StructureDefinition/Patient'
});

// Returns OperationOutcome
```

#### Custom CLI Wrapper (Fallback)
```typescript
import { spawn } from 'child_process';
import { writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';

export class HapiCLIWrapper {
  private readonly jarPath: string;
  private readonly igCache: string;

  async validateResource(
    resource: any,
    options: ValidationOptions
  ): Promise<OperationOutcome> {
    const tempFile = join('/tmp', `resource-${Date.now()}.json`);
    writeFileSync(tempFile, JSON.stringify(resource));

    const args = [
      '-jar', this.jarPath,
      tempFile,
      '-version', options.fhirVersion,
      '-ig', options.igPackages.join(','),
      '-tx', options.terminologyServer,
      '-output', 'json'
    ];

    if (options.profile) {
      args.push('-profile', options.profile);
    }

    const result = await this.executeJava(args);
    unlinkSync(tempFile); // Cleanup

    return JSON.parse(result.stdout);
  }

  private async executeJava(args: string[]): Promise<{ stdout: string, stderr: string }> {
    return new Promise((resolve, reject) => {
      const process = spawn('java', args, {
        timeout: 30000 // 30s timeout
      });

      let stdout = '';
      let stderr = '';

      process.stdout.on('data', (data) => stdout += data);
      process.stderr.on('data', (data) => stderr += data);

      process.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Java process exited with code ${code}: ${stderr}`));
        } else {
          resolve({ stdout, stderr });
        }
      });

      process.on('error', reject);
    });
  }
}
```

#### Pros
- ✅ Official HAPI implementation (CLI interface)
- ✅ No additional HTTP service required
- ✅ Works offline (local execution)
- ✅ Complete validation feature set
- ✅ Multi-version support (R4, R5, R6)
- ✅ IG package support (can preload German profiles)
- ✅ Moderate complexity (simpler than REST API)
- ✅ Can be containerized with Java in Docker

#### Cons
- ⚠️ Still requires JVM in container
- ⚠️ Process spawn overhead (200-500ms per validation)
- ⚠️ Temp file I/O overhead
- ⚠️ Error handling via stderr parsing
- ⚠️ Limited parallelism (process spawning)

#### Feasibility: ✅ **HIGH** (Recommended for MVP)

---

### Option 4: Native TypeScript FHIR Validator

**Description:** Use pure TypeScript/JavaScript FHIR validation libraries.

#### Available Libraries
1. **`@asymmetrik/fhir-json-schema-validator`** (Already used)
   - ✅ Pure JavaScript (no JVM)
   - ❌ Only structural validation (schema only)
   - ❌ No profile or terminology validation
   - ❌ No FHIRPath invariants

2. **`fhir` npm package** (Community library)
   - ⚠️ Limited validation capabilities
   - ❌ Not HL7-official
   - ❌ Incomplete profile support

3. **Custom Implementation**
   - ❌ Reinventing the wheel
   - ❌ High development cost
   - ❌ Maintenance burden
   - ❌ Not HL7-compliant

#### Pros
- ✅ No JVM dependency
- ✅ Native Node.js performance
- ✅ Easy deployment

#### Cons
- ❌ Incomplete validation (structural only)
- ❌ No official HL7 compliance
- ❌ Limited profile/terminology support
- ❌ Manual FHIRPath implementation needed

#### Feasibility: ❌ **LOW** (Does not meet PRD requirements)

---

## Comparison Matrix

| Criteria | Option 1: Java Direct | Option 2: REST API | Option 3: CLI Wrapper ⭐ | Option 4: TypeScript |
|----------|----------------------|-------------------|------------------------|---------------------|
| **HL7 Compliance** | ✅ Official | ✅ Official | ✅ Official | ❌ Partial |
| **Deployment Complexity** | ⚠️ High (JVM) | ⚠️ High (Service) | ⚠️ Medium (JVM in Docker) | ✅ Low |
| **Performance** | ⚠️ JVM overhead | ❌ Network overhead | ⚠️ Process spawn | ✅ Fast |
| **Offline Mode** | ✅ Yes | ⚠️ Need local instance | ✅ Yes | ✅ Yes |
| **Multi-Version Support** | ✅ R4, R5, R6 | ✅ R4, R5, R6 | ✅ R4, R5, R6 | ⚠️ Limited |
| **Profile Validation** | ✅ Full | ✅ Full | ✅ Full | ❌ None |
| **Terminology Validation** | ✅ Full | ✅ Full | ✅ Full | ❌ Manual |
| **FHIRPath Invariants** | ✅ Yes | ✅ Yes | ✅ Yes | ❌ Manual |
| **Development Effort** | ⚠️ High | ⚠️ High | ✅ Low | ❌ Very High |
| **Maintenance** | ⚠️ Complex | ⚠️ Complex | ✅ Simple | ❌ High |
| **Testing Ease** | ⚠️ Complex | ✅ Easy | ✅ Easy | ✅ Easy |

---

## Recommended Approach

### Phase 1: MVP Implementation (✅ RECOMMENDED)

**Use Option 3: Node.js Wrapper around HAPI CLI**

#### Rationale
1. **Meets PRD Requirements:**
   - HL7-compliant validation (all 6 aspects)
   - Multi-version support (R4, R5, R6)
   - Offline mode (local execution)
   - Profile validation (IG packages)
   - Terminology validation (tx.fhir.org integration)

2. **Pragmatic for MVP:**
   - Moderate development effort (1-2 weeks)
   - Leverages official HAPI implementation
   - Can be containerized easily
   - No additional microservice to manage

3. **Performance Acceptable:**
   - Process spawn: ~200-500ms overhead
   - Total validation time: <10s (within target)
   - Can parallelize with Worker Threads later

#### Implementation Plan

**Step 1:** Test existing `fhir-validator` npm package
```bash
cd /Users/sheydin/Sites/records
node -e "const fv = require('fhir-validator'); console.log(fv);"
```

**Step 2:** If `fhir-validator` insufficient, download HAPI CLI JAR
```bash
wget https://github.com/hapifhir/org.hl7.fhir.core/releases/download/6.3.3/validator_cli.jar -O server/lib/validator_cli.jar
```

**Step 3:** Create wrapper service (<400 lines)
```typescript
// server/services/validation/engine/hapi-validator-client.ts
export class HapiValidatorClient {
  async validateResource(
    resource: any,
    options: HapiValidationOptions
  ): Promise<OperationOutcome>

  parseOperationOutcome(outcome: any): ValidationIssue[]
}
```

**Step 4:** Integrate into existing validators
- Update `StructuralValidator` to call HAPI
- Update `ProfileValidator` to use HAPI profiles
- Update `TerminologyValidator` to use HAPI terminology validation

---

### Phase 2: Production Optimization (Post-MVP)

**Migrate to Option 2: HAPI Validator REST API**

#### When to Migrate
- When scaling beyond 1000 resources/hour
- When batch validation performance becomes critical
- When operational budget allows additional service

#### Benefits
- Better parallelization
- Independent scaling
- Circuit breaker/retry patterns
- Cleaner separation of concerns

---

## Technical Specifications

### HAPI CLI Command Structure

```bash
java -jar validator_cli.jar \
  <resource.json> \
  -version <r4|r5|r6> \
  -ig <package-id@version> \
  -tx <terminology-server-url> \
  -profile <profile-url> \
  -output json
```

### OperationOutcome Parsing

```typescript
interface HapiOperationOutcome {
  resourceType: 'OperationOutcome';
  issue: Array<{
    severity: 'fatal' | 'error' | 'warning' | 'information';
    code: string; // e.g., 'structure', 'required', 'code-invalid'
    details?: {
      text: string;
    };
    diagnostics: string;
    location?: string[];
    expression?: string[];
  }>;
}

// Map to ValidationIssue
const mapToValidationIssue = (issue: HapiIssue): ValidationIssue => ({
  id: `hapi-${Date.now()}-${Math.random()}`,
  aspect: determineAspect(issue.code), // 'structural' | 'profile' | 'terminology'
  severity: issue.severity,
  code: issue.code,
  message: issue.diagnostics,
  path: issue.expression?.[0] || issue.location?.[0] || '',
  humanReadable: issue.details?.text || issue.diagnostics
});
```

### Multi-Version Support

```typescript
const versionMap = {
  'R4': { version: '4.0', igCore: 'hl7.fhir.r4.core@4.0.1' },
  'R5': { version: '5.0', igCore: 'hl7.fhir.r5.core@5.0.0' },
  'R6': { version: '6.0', igCore: 'hl7.fhir.r6.core@6.0.0-ballot2' }
};

// Version-specific validation
const hapiArgs = [
  '-jar', 'validator_cli.jar',
  tempFile,
  '-version', versionMap[fhirVersion].version,
  '-ig', versionMap[fhirVersion].igCore,
  // ... additional args
];
```

---

## Integration with Existing Architecture

### ConsolidatedValidationService Integration

```typescript
// server/services/validation/core/consolidated-validation-service.ts
import { HapiValidatorClient } from '../engine/hapi-validator-client';

export class ConsolidatedValidationService {
  private hapiClient: HapiValidatorClient;

  async validateResource(resource: any, options: ValidateOptions): Promise<ValidationResult> {
    // Execute HAPI validation
    const hapiResult = await this.hapiClient.validateResource(resource, {
      fhirVersion: options.fhirVersion,
      profile: options.profile,
      txServer: this.getTerminologyServer(options.mode),
      igPackages: options.igPackages
    });

    // Parse OperationOutcome
    const issues = this.hapiClient.parseOperationOutcome(hapiResult);

    // Distribute issues to aspect validators
    const structuralIssues = issues.filter(i => i.aspect === 'structural');
    const profileIssues = issues.filter(i => i.aspect === 'profile');
    const terminologyIssues = issues.filter(i => i.aspect === 'terminology');

    // Continue with existing aggregation logic...
  }

  private getTerminologyServer(mode: 'online' | 'offline'): string {
    return mode === 'online' 
      ? 'https://tx.fhir.org/r4'
      : 'http://localhost:8081/fhir'; // Local Ontoserver
  }
}
```

---

## Deployment Requirements

### Docker Configuration

```dockerfile
# Dockerfile
FROM node:18-alpine AS base

# Install Java Runtime (for HAPI CLI)
RUN apk add --no-cache openjdk11-jre

# Copy HAPI validator JAR
COPY server/lib/validator_cli.jar /opt/hapi/validator_cli.jar

# Environment variables
ENV HAPI_JAR_PATH=/opt/hapi/validator_cli.jar
ENV HAPI_IG_CACHE=/opt/fhir/igs
ENV HAPI_TERMINOLOGY_CACHE=/opt/fhir/terminology

# ... rest of Node.js setup
```

### Environment Variables

```bash
# HAPI Validator Configuration
HAPI_JAR_PATH=/opt/hapi/validator_cli.jar
HAPI_TIMEOUT=30000
HAPI_MAX_PARALLEL=4

# FHIR Version Support
HAPI_DEFAULT_VERSION=R4
HAPI_SUPPORT_R5=true
HAPI_SUPPORT_R6=true

# Terminology Servers
HAPI_TX_ONLINE=https://tx.fhir.org
HAPI_TX_OFFLINE=http://localhost:8081/fhir

# IG Package Cache
HAPI_IG_CACHE_PATH=/opt/fhir/igs
```

---

## Performance Expectations

### Validation Times (Estimated)

| Resource Type | Basic Validation | With Profile | With Terminology | Total |
|--------------|------------------|-------------|------------------|-------|
| Patient | 200ms | +300ms | +500ms | ~1s |
| Observation | 250ms | +400ms | +800ms | ~1.5s |
| Bundle (10 entries) | 500ms | +1s | +2s | ~3.5s |

**Target:** <10s per resource (✅ Achievable)

### Optimization Strategies

1. **Caching:**
   - Cache IG packages (avoid re-download)
   - Cache ValueSets (avoid repeated terminology lookups)
   - Cache OperationOutcomes (for identical resources)

2. **Parallelization:**
   - Use Worker Threads for batch validation
   - Max 4 parallel HAPI processes (to avoid JVM thrashing)

3. **Incremental Validation:**
   - Skip aspects if settings disabled
   - Skip unchanged resources (ETag comparison)

---

## Risk Assessment

### Risks

1. **JVM Dependency:**
   - **Mitigation:** Include JRE in Docker image, document requirement
   - **Impact:** Low (acceptable for MVP)

2. **Process Spawn Overhead:**
   - **Mitigation:** Worker threads, caching, batch optimization
   - **Impact:** Medium (acceptable for MVP, optimize post-MVP)

3. **HAPI CLI Stability:**
   - **Mitigation:** Error handling, retry logic, fallback to schema validation
   - **Impact:** Low (HAPI CLI is production-grade)

4. **Deployment Complexity:**
   - **Mitigation:** Docker with JRE + Node.js, clear documentation
   - **Impact:** Low (one-time setup)

---

## Success Criteria

✅ **Task 1.1 Complete When:**

1. Integration approach selected and documented
2. Technical feasibility confirmed
3. Performance expectations established
4. Deployment requirements identified
5. Risk mitigation strategies defined
6. Next steps (Task 1.2) clearly defined

---

## Next Steps (Task 1.2)

**Install and Configure HAPI FHIR Validator Dependency**

1. Test existing `fhir-validator` npm package
2. If insufficient, download HAPI CLI JAR (validator_cli.jar)
3. Update Dockerfile to include Java Runtime
4. Create environment variable configuration
5. Verify HAPI CLI execution in container

---

## References

- HAPI FHIR Validator: https://hapifhir.io/hapi-fhir/docs/validation/introduction.html
- HAPI FHIR CLI: https://confluence.hl7.org/display/FHIR/Using+the+FHIR+Validator
- HL7 FHIR Validation: http://hl7.org/fhir/validation.html
- npm fhir-validator: https://www.npmjs.com/package/fhir-validator
- @asymmetrik validator: https://github.com/Asymmetrik/fhir-json-schema-validator

---

**Status:** ✅ **RESEARCH COMPLETE**  
**Decision:** Use Node.js Wrapper around HAPI CLI (Option 3)  
**Next Task:** 1.2 Install and configure HAPI FHIR Validator dependency

