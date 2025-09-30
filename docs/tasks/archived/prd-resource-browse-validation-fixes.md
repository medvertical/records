# Product Requirements Document: Resource Browse List and Detail View Validation Fixes

## Introduction/Overview

The current FHIR validation system has critical architectural flaws that cause validation results to be inconsistent between the resource list view and individual resource detail views. The system shows 100% validation coverage in the list while individual resources display "Not Validated", creating a confusing and unreliable user experience.

This PRD addresses the fundamental issues with validation result storage, caching, and display logic to create a consistent, reliable validation system.

## Goals

1. **Fix Validation Result Storage Architecture**: Store validation results per aspect to enable granular revalidation
2. **Eliminate Validation Coverage Discrepancies**: Ensure list view and detail view show consistent validation status
3. **Implement Smart Revalidation**: Only revalidate aspects that are newly enabled or have changed
4. **Improve Validation Performance**: Reduce unnecessary full revalidations
5. **Create Reliable Validation Status Display**: Consistent validation status across all UI components

## User Stories (Inferred)

### As a FHIR Developer
- I want to see accurate validation status for each resource so that I can trust the validation results
- I want to enable/disable validation aspects without losing existing validation data so that I can efficiently test different validation configurations
- I want to see which specific aspects have been validated so that I understand the completeness of validation
- I want validation results to persist across browser sessions so that I don't lose work

### As a System Administrator
- I want validation results to be stored efficiently so that the system performs well
- I want to clear validation cache without losing all validation data so that I can manage system performance
- I want validation settings changes to trigger only necessary revalidations so that the system remains responsive

## Functional Requirements (Observed)

### 1. Aspect-Based Validation Storage
- **1.1** Store validation results per validation aspect (structural, profile, terminology, reference, business-rule, metadata)
- **1.2** Each aspect result should include: validation score, issue count, error count, warning count, validation timestamp
- **1.3** Maintain aspect-specific timestamps to enable selective revalidation
- **1.4** Store validation settings snapshot with each aspect result for cache invalidation

### 2. Smart Revalidation System
- **2.1** Only revalidate aspects that are newly enabled or have changed settings
- **2.2** Preserve validation results for disabled aspects
- **2.3** Invalidate aspect results when validation settings change for that aspect
- **2.4** Support partial revalidation (single aspect) without affecting other aspects

### 3. Consistent Validation Status Display
- **3.1** Resource list view must show validation status that matches individual resource detail view
- **3.2** Validation coverage calculation must be based on actual validation results, not cached data
- **3.3** Display validation status per aspect with clear indicators for validated/not validated
- **3.4** Show validation timestamps for each aspect

### 4. Enhanced Validation Result Caching
- **4.1** Cache validation results per aspect with settings-based invalidation
- **4.2** Implement cache warming for frequently accessed resources
- **4.3** Support cache invalidation at aspect level, not just resource level
- **4.4** Maintain cache consistency across server restarts

### 5. Validation Progress and Status Tracking
- **5.1** Show real-time validation progress per aspect
- **5.2** Display validation status indicators (validated, not validated, validating, error)
- **5.3** Provide validation history and retry information
- **5.4** Support batch validation with progress tracking

## Non-Goals / Out of Scope

- **Backward Compatibility**: Breaking changes to existing validation result storage are acceptable
- **Migration of Existing Data**: Existing validation results may need to be cleared and revalidated
- **Real-time Validation**: Validation results don't need to update in real-time across multiple browser sessions
- **Validation Result Sharing**: Results don't need to be shared between different FHIR servers

## Design Considerations

### Database Schema Changes
- Add aspect-specific validation result tables
- Implement proper foreign key relationships
- Add indexes for performance optimization
- Support for validation settings versioning

### API Design
- RESTful endpoints for aspect-based validation operations
- Batch validation endpoints with progress tracking
- Cache management endpoints
- Validation status query endpoints

### UI/UX Design
- Clear visual indicators for validation status per aspect
- Progress indicators for ongoing validations
- Consistent validation status display across components
- Tooltips showing detailed validation information

## Technical Considerations

### Current Architecture Issues
1. **Monolithic Validation Storage**: All validation aspects are stored in a single record
2. **Cache Invalidation Problems**: Cache clearing affects all validation data
3. **Settings Change Impact**: Changing validation settings invalidates all results
4. **Inconsistent Status Display**: Different components calculate validation status differently

### Proposed Architecture
1. **Aspect-Based Storage**: Separate storage for each validation aspect
2. **Granular Cache Management**: Cache invalidation per aspect
3. **Smart Revalidation**: Only revalidate changed aspects
4. **Unified Status Calculation**: Single source of truth for validation status

### Dependencies
- Database schema migrations
- Validation engine refactoring
- Client-side component updates
- Cache management system updates

### Performance Considerations
- Batch validation operations
- Efficient database queries
- Memory usage optimization
- Cache size management

## Success Metrics (Inferred)

- **Validation Consistency**: 100% consistency between list view and detail view validation status
- **Performance**: < 2 second response time for validation status queries
- **Cache Efficiency**: 90%+ cache hit rate for validation results
- **User Satisfaction**: Elimination of "Not Validated" false negatives

## Implementation Decisions

1. **Migration Strategy**: Clear all existing validation results and start fresh (Option C)
2. **Cache Invalidation**: Invalidate all cache when any validation setting changes (simpler approach)
3. **Performance vs Accuracy**: Hybrid approach - show cached results with "validating" indicators
4. **Backward Compatibility**: Breaking changes acceptable - can change existing APIs and components
5. **Settings Structure**: Standardize on single settings structure (fix dual structure issue)
6. **Server Connection**: No fallback to HAPI - must respect the connected server only
7. **Settings Polling**: Reduce polling frequency from 5 seconds to reasonable interval

## Critical Issues to Fix

1. **Server Connection Bug**: System still connects to HAPI despite configured server
2. **Settings Structure Conflict**: Dual structure with both `aspects.*.enabled` and direct `*.enabled` properties
3. **Excessive Settings Polling**: Client polls validation settings every 5 seconds
4. **Validation Status Inconsistency**: List view shows 100% coverage while individual resources show "Not Validated"

## Quality Assessment: The Good, The Bad, and The Ugly

### The Good
- **Comprehensive Validation Engine**: The validation system supports multiple aspects and detailed error reporting
- **Rich UI Components**: The resource list and detail views have sophisticated validation status displays
- **Caching Infrastructure**: There's a well-designed cache management system in place
- **Database Schema**: The schema supports detailed validation result storage

### The Bad
- **Inconsistent Status Calculation**: Different components calculate validation status differently
- **Monolithic Validation Storage**: All aspects are stored together, preventing granular revalidation
- **Cache Invalidation Issues**: Cache clearing affects all validation data indiscriminately
- **Settings Change Impact**: Changing validation settings invalidates all results unnecessarily

### The Ugly
- **False Validation Coverage**: List view shows 100% coverage while individual resources show "Not Validated"
- **Cache Dependencies**: UI components depend on client-side cache that can become inconsistent
- **Validation Result Loss**: Changing validation settings causes loss of all validation work
- **Performance Issues**: Full revalidation on every settings change is inefficient

### Notable Risks/Missing Features
- **Data Loss Risk**: Current architecture can lose validation results when settings change
- **Performance Degradation**: Full revalidation on settings changes can be slow
- **User Confusion**: Inconsistent validation status display confuses users
- **Scalability Issues**: Monolithic validation storage doesn't scale well
- **Cache Consistency**: No mechanism to ensure cache consistency across components
