# Product Requirements Document (PRD)
## Validation Settings Simplification

**Version:** v1.0  
**Date:** October 2025  
**Document Type:** Product Requirements Document for Settings Simplification

---

## 1. Introduction/Overview

The current validation settings system is overly complex with multiple implementations, redundant schemas, and unnecessary features. This PRD defines a simplified approach that focuses on the essential validation controls needed for the Records FHIR Validation Platform.

### Current Problems Identified
- **Multiple Implementations:** 3+ different validation settings schemas and services
- **Over-Engineering:** Complex nested configurations with 20+ settings per aspect
- **Redundant Features:** Presets, audit trails, versioning, and advanced configurations not needed for core functionality
- **Broken Functionality:** PUT endpoint fails due to validation complexity
- **Poor UX:** Header dropdown doesn't work properly with current complex system

### Target Audience
- **Primary Users:** FHIR server administrators, healthcare IT professionals
- **Use Cases:** Quick validation aspect toggling, performance tuning, basic configuration

---

## 2. Goals

The validation settings system aims to achieve:

1. **Simplicity:** Only essential settings needed for validation control
2. **Reliability:** Working PUT endpoint and consistent data flow
3. **Usability:** Quick access via header dropdown and simple settings UI
4. **Maintainability:** Single source of truth for validation settings
5. **Extensibility:** Foundation that can be expanded later

---

## 3. User Stories

### Core Settings Management
- **As a** FHIR administrator, **I can** toggle the 6 validation aspects on/off (Structural, Profile, Terminology, Reference, Business Rules, Metadata) **so that** I can control which validations run
- **As a** system administrator, **I can** adjust max concurrent validations **so that** I can optimize performance
- **As a** user, **I can** set batch size for validation **so that** I can balance speed vs. resource usage
- **As a** user, **I can** select which resource types to validate **so that** I can focus on important resources and improve performance
- **As a** user, **I can** exclude specific resource types from validation **so that** I can skip irrelevant or problematic resources
- **As a** user, **I can** reset settings to defaults **so that** I can quickly restore standard configuration

### Quick Access
- **As a** user, **I can** access validation settings from the app header dropdown **so that** I can make quick changes without navigating to settings page
- **As a** user, **I can** see current validation aspect status in the header **so that** I know which validations are active

---

## 4. Functional Requirements

### 4.1 Validation Settings Schema
**Single, simplified schema with only essential fields:**

```typescript
interface ValidationSettings {
  // 6 Validation Aspects (Structural, Profile, Terminology, Reference, Business Rules, Metadata)
  aspects: {
    structural: { enabled: boolean; severity: 'error' | 'warning' | 'info' };
    profile: { enabled: boolean; severity: 'error' | 'warning' | 'info' };
    terminology: { enabled: boolean; severity: 'error' | 'warning' | 'info' };
    reference: { enabled: boolean; severity: 'error' | 'warning' | 'info' };
    businessRules: { enabled: boolean; severity: 'error' | 'warning' | 'info' };
    metadata: { enabled: boolean; severity: 'error' | 'warning' | 'info' };
  };
  
  // Performance Settings (only 2 essential fields)
  performance: {
    maxConcurrent: number; // 1-20, default: 5
    batchSize: number;     // 10-100, default: 50
  };
  
  // Resource Type Filtering (essential for performance)
  resourceTypes: {
    enabled: boolean;           // Whether filtering is active
    includedTypes: string[];    // List of resource types to validate (empty = all)
    excludedTypes: string[];    // List of resource types to exclude
  };
}
```

### 4.2 Settings Management
1. **Single Settings Service:** Use only `validation-settings-service.ts`
2. **Working PUT Endpoint:** Fix `/api/validation/settings` to accept partial updates
3. **Default Values:** Simple reset to defaults (no presets)
4. **Validation:** Minimal validation - only check ranges and required fields

### 4.3 User Interface
1. **Header Dropdown:** Fix `ValidationAspectsDropdown` to work with new schema
2. **Settings Page:** UI showing only essential fields
3. **Quick Toggle:** Enable/disable aspects directly from header
4. **Resource Type Filter:** Version-aware multi-select dropdown for included/excluded resource types
5. **FHIR Version Indicator:** Show current FHIR version and available resource types
6. **Migration Warnings:** Alert users when switching FHIR versions with incompatible settings
7. **Reset Button:** Single "Reset to Defaults" button

### 4.4 FHIR Version-Aware Resource Type Filtering
**Resource Types sind abhängig von der FHIR Version (R4 vs R5):**

```typescript
// FHIR Version-specific resource type definitions
interface FHIRResourceTypeConfig {
  version: 'R4' | 'R5';
  includedTypes: string[];
  excludedTypes: string[];
  totalCount: number;
}

// R4 Default included resource types (143 total in R4)
const R4_DEFAULT_INCLUDED_RESOURCE_TYPES = [
  // Core Clinical Resources (R4)
  'Patient', 'Observation', 'Condition', 'Encounter', 'Procedure',
  'Medication', 'MedicationRequest', 'DiagnosticReport', 'AllergyIntolerance',
  'Immunization', 'CarePlan', 'Goal', 'ServiceRequest',
  
  // Administrative Resources (R4)
  'Organization', 'Practitioner', 'PractitionerRole', 'Location',
  'DocumentReference', 'Composition', 'List', 'Appointment', 'Schedule', 'Slot'
];

// R5 Default included resource types (154 total in R5)
const R5_DEFAULT_INCLUDED_RESOURCE_TYPES = [
  // Core Clinical Resources (R5 - includes new types)
  'Patient', 'Observation', 'Condition', 'Encounter', 'Procedure',
  'Medication', 'MedicationRequest', 'DiagnosticReport', 'AllergyIntolerance',
  'Immunization', 'CarePlan', 'Goal', 'ServiceRequest',
  
  // Administrative Resources (R5)
  'Organization', 'Practitioner', 'PractitionerRole', 'Location',
  'DocumentReference', 'Composition', 'List', 'Appointment', 'Schedule', 'Slot',
  
  // R5-specific new resource types
  'Evidence', 'EvidenceReport', 'EvidenceVariable', 'Citation'
];

// Version-aware resource type management
class FHIRResourceTypeManager {
  static getDefaultTypes(version: 'R4' | 'R5'): string[] {
    return version === 'R4' ? R4_DEFAULT_INCLUDED_RESOURCE_TYPES : R5_DEFAULT_INCLUDED_RESOURCE_TYPES;
  }
  
  static validateResourceTypes(types: string[], version: 'R4' | 'R5'): {
    valid: string[];
    invalid: string[];
    warnings: string[];
  } {
    // Implementation validates against version-specific resource type lists
    // Returns valid types, invalid types, and warnings for deprecated types
  }
  
  static migrateSettings(oldVersion: 'R4' | 'R5', newVersion: 'R4' | 'R5', settings: any): any {
    // Migrates resource type settings when FHIR version changes
    // Removes invalid types, adds new defaults, preserves valid types
  }
}
```

**Wichtige Überlegungen:**
- **R4**: 143 Resource Types (z.B. keine `Evidence`, `EvidenceReport`, `Citation`)
- **R5**: 154 Resource Types (11 neue Types hinzugefügt)
- **Migration**: Settings müssen automatisch migriert werden beim Server-Wechsel
- **Validierung**: Resource Types müssen gegen verfügbare FHIR Version validiert werden
- **UI-Warnungen**: Benutzer warnen wenn ausgewählte Types in aktueller FHIR Version nicht verfügbar sind

### 4.5 API Endpoints
1. **GET /api/validation/settings** - Returns settings
2. **PUT /api/validation/settings** - Accepts partial updates of settings
3. **POST /api/validation/settings/reset** - Reset to defaults
4. **GET /api/validation/resource-types** - Returns available resource types for current FHIR version
5. **GET /api/validation/resource-types/:version** - Returns resource types for specific FHIR version (R4/R5)
6. **POST /api/validation/settings/migrate** - Migrate settings when FHIR version changes

---

## 5. Non-Goals / Out of Scope

### 5.1 Removed Features (Intentional Simplifications)
1. **Complex Aspect Configuration:** No nested settings per aspect
2. **Presets System:** No predefined configuration presets
3. **Audit Trails:** No versioning or change tracking
4. **Advanced Server Config:** No terminology servers, profile servers, etc.
5. **Resource Type Filtering:** No include/exclude lists
6. **Custom Rules:** No user-defined validation rules
7. **Cache Settings:** No cache configuration options
8. **Timeout Settings:** No per-aspect timeout configuration
9. **Strict Mode:** No global strict mode setting
10. **Debug Options:** No debug information toggles

### 5.2 Future Enhancements
1. **Advanced Configuration:** Can be added back incrementally
2. **Presets System:** Can be implemented later if needed
3. **Audit Logging:** Can be added for compliance requirements
4. **User Preferences:** Can be added for multi-user scenarios

---

## 6. Technical Implementation

### 6.1 Schema Consolidation
- **Remove:** `shared/validation-settings-validator.ts` (complex validation)
- **Keep:** `shared/validation-settings.ts` (main schema)
- **Update:** All imports to use new schema

### 6.2 Service Consolidation
- **Keep:** `server/services/validation/settings/validation-settings-service.ts`
- **Rename:** Service to main service
- **Update:** All references to use single service

### 6.3 UI Consolidation
- **Keep:** `client/src/components/settings/validation-settings-tab.tsx`
- **Rename:** Tab to main tab
- **Fix:** `ValidationAspectsDropdown` to work with new schema

### 6.4 Database Schema
- **Simplify:** Database schema to match new settings
- **Migration:** Create migration to remove unused columns
- **Default Data:** Insert default settings

---

## 7. Success Metrics

### 7.1 Functionality Metrics
- **PUT Endpoint Success Rate:** 100% success for valid settings
- **Header Dropdown Functionality:** Working aspect toggles
- **Settings Persistence:** Settings saved and loaded correctly
- **Reset Functionality:** Reset to defaults works reliably

### 7.2 User Experience Metrics
- **Settings Load Time:** < 200ms for settings page
- **Quick Toggle Response:** < 100ms for aspect toggle from header
- **UI Simplicity:** Only essential fields visible
- **Error Rate:** < 1% validation errors on settings updates

### 7.3 Code Quality Metrics
- **Single Source of Truth:** Only one settings schema and service
- **Reduced Complexity:** 80% reduction in settings-related code
- **Maintainability:** Clear, simple codebase for settings management

---

## 8. Implementation Plan

### Phase 1: Schema Update
1. Create new schema in `shared/validation-settings.ts`
2. Update default settings to new format
3. Remove complex schemas and validators

### Phase 2: Service Consolidation
1. Simplify `validation-settings-service.ts` to core functionality
2. Remove complex service implementation
3. Fix PUT endpoint validation

### Phase 3: UI Updates
1. Update `ValidationAspectsDropdown` for new schema
2. Update settings page UI
3. Add reset to defaults functionality

### Phase 4: Testing & Validation
1. Test complete settings workflow
2. Verify header dropdown functionality
3. Test PUT endpoint with various payloads
4. Validate reset to defaults

---

## 9. Risk Assessment

### 9.1 Low Risk
- **Schema Simplification:** Well-defined scope, clear requirements
- **UI Updates:** Existing components can be simplified
- **Service Consolidation:** Clear path to remove complexity

### 9.2 Medium Risk
- **Database Migration:** Need to handle existing data
- **API Compatibility:** Ensure existing clients still work
- **Testing Coverage:** Need comprehensive testing of simplified system

### 9.3 Mitigation Strategies
- **Incremental Implementation:** Implement changes in phases
- **Backward Compatibility:** Maintain API compatibility during transition
- **Comprehensive Testing:** Test all settings workflows thoroughly
- **Rollback Plan:** Keep complex implementation as backup during transition

---

## 10. Quality Assessment: Current State

### 10.1 The Good ✅
- **Simplified Schema Exists:** `validation-settings-simplified.ts` provides good foundation
- **Working Components:** Some UI components already exist for simplified settings
- **Clear Requirements:** User needs are well-defined and simple

### 10.2 The Bad ⚠️
- **Multiple Implementations:** 3+ different settings systems causing confusion
- **Broken PUT Endpoint:** Complex validation preventing settings updates
- **Over-Engineering:** 20+ settings per aspect when only 2 are needed
- **Poor UX:** Header dropdown doesn't work with current system

### 10.3 The Ugly 🚨
- **Settings Chaos:** Multiple schemas, services, and UIs for same functionality
- **Non-Functional Core:** PUT endpoint completely broken due to complexity
- **Maintenance Nightmare:** Impossible to maintain multiple implementations
- **User Confusion:** No clear path for users to configure validation

---

## Conclusion

The current validation settings system is a perfect example of over-engineering that has led to broken functionality and poor user experience. The approach defined in this PRD will create a simple, reliable, and maintainable settings system that focuses on the essential user needs:

1. **Toggle 6 validation aspects** (Structural, Profile, Terminology, Reference, Business Rules, Metadata)
2. **Adjust performance settings** (maxConcurrent + batchSize)  
3. **Quick access via header dropdown**
4. **Reset to defaults functionality**

This simplification will fix the broken PUT endpoint, improve user experience, and create a solid foundation for future enhancements. The 80% reduction in complexity will make the system much more maintainable and reliable.
