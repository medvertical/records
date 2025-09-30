# Validation API Documentation

**Version:** 2.0 (Per-Aspect Validation)  
**Last Updated:** September 30, 2025

## Overview

This document describes the REST API endpoints for the Records FHIR Validation Platform's per-aspect validation system. All endpoints support pagination, filtering, and sorting as described in the PRD.

## Base URL

```
http://localhost:5000/api
```

## Authentication

Currently, no authentication is required. Future versions will implement server-scoped authentication.

---

## Endpoints

### 1. Get Validation Issue Groups

Retrieve validation message groups for same-message filtering and triage.

**Endpoint:** `GET /validation/issues/groups`

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `serverId` | integer | No | Active server | Filter by FHIR server ID |
| `aspect` | string | No | - | Filter by validation aspect (`structural`, `profile`, `terminology`, `reference`, `businessRule`, `metadata`) |
| `severity` | string | No | - | Filter by severity (`error`, `warning`, `information`) |
| `code` | string | No | - | Filter by error code |
| `path` | string | No | - | Filter by canonical path (partial match) |
| `resourceType` | string | No | - | Filter by resource type |
| `page` | integer | No | 1 | Page number (1-indexed) |
| `size` | integer | No | 25 | Page size (max: 100) |
| `sort` | string | No | `count:desc` | Sort order (`count:desc`, `count:asc`, `severity:desc`, `severity:asc`) |

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "signature": "a1b2c3d4e5f6...", 
      "aspect": "structural",
      "severity": "error",
      "code": "required",
      "canonicalPath": "patient.name",
      "sampleMessage": "Patient.name: minimum required = 1, but only found 0",
      "totalResources": 42,
      "firstSeenAt": "2025-09-30T10:15:30Z",
      "lastSeenAt": "2025-09-30T14:22:45Z"
    }
  ],
  "pagination": {
    "page": 1,
    "size": 25,
    "total": 100,
    "totalPages": 4,
    "hasNext": true,
    "hasPrevious": false
  },
  "filters": {
    "serverId": 1,
    "aspect": null,
    "severity": null,
    "code": null,
    "path": null,
    "resourceType": null
  },
  "sort": "count:desc",
  "timestamp": "2025-09-30T14:30:00Z"
}
```

**Status Codes:**

- `200 OK`: Success
- `400 Bad Request`: Invalid query parameters
- `500 Internal Server Error`: Server error

---

### 2. Get Group Members

Retrieve resources that have a specific validation message (by signature).

**Endpoint:** `GET /validation/issues/groups/:signature/resources`

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `signature` | string | Yes | Message signature (SHA-256 hash) |

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `serverId` | integer | No | Active server | Filter by FHIR server ID |
| `resourceType` | string | No | - | Filter by resource type |
| `page` | integer | No | 1 | Page number (1-indexed) |
| `size` | integer | No | 25 | Page size (max: 100) |
| `sort` | string | No | `validatedAt:desc` | Sort order (`validatedAt:desc`, `validatedAt:asc`) |

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "resourceType": "Patient",
      "fhirId": "patient-001",
      "validatedAt": "2025-09-30T14:22:45Z",
      "perAspect": [
        {
          "aspect": "structural",
          "isValid": false,
          "errorCount": 1,
          "warningCount": 0,
          "informationCount": 0
        },
        {
          "aspect": "profile",
          "isValid": true,
          "errorCount": 0,
          "warningCount": 0,
          "informationCount": 1
        }
      ]
    }
  ],
  "pagination": {
    "page": 1,
    "size": 25,
    "total": 42,
    "totalPages": 2,
    "hasNext": true,
    "hasPrevious": false
  },
  "filters": {
    "serverId": 1,
    "signature": "a1b2c3d4e5f6...",
    "resourceType": null
  },
  "sort": "validatedAt:desc",
  "timestamp": "2025-09-30T14:30:00Z"
}
```

**Status Codes:**

- `200 OK`: Success
- `400 Bad Request`: Invalid parameters
- `404 Not Found`: Signature not found
- `500 Internal Server Error`: Server error

---

### 3. Get Resource Messages

Retrieve all validation messages for a specific resource.

**Endpoint:** `GET /validation/resources/:resourceType/:id/messages`

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `resourceType` | string | Yes | FHIR resource type (e.g., "Patient", "Observation") |
| `id` | string | Yes | FHIR resource ID |

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `serverId` | integer | No | Active server | Filter by FHIR server ID |

**Response:**

```json
{
  "success": true,
  "data": {
    "serverId": 1,
    "resourceType": "Patient",
    "fhirId": "patient-001",
    "aspects": [
      {
        "aspect": "structural",
        "isValid": false,
        "errorCount": 1,
        "warningCount": 0,
        "informationCount": 0,
        "score": 0,
        "validatedAt": "2025-09-30T14:22:45Z",
        "messages": [
          {
            "id": 123,
            "severity": "error",
            "code": "required",
            "canonicalPath": "patient.name",
            "text": "Patient.name: minimum required = 1, but only found 0",
            "signature": "a1b2c3d4e5f6...",
            "createdAt": "2025-09-30T14:22:45Z"
          }
        ]
      },
      {
        "aspect": "profile",
        "isValid": true,
        "errorCount": 0,
        "warningCount": 0,
        "informationCount": 1,
        "score": 100,
        "validatedAt": "2025-09-30T14:22:45Z",
        "messages": [
          {
            "id": 124,
            "severity": "information",
            "code": null,
            "canonicalPath": "patient.meta.profile",
            "text": "Resource validates against US Core Patient profile",
            "signature": "b2c3d4e5f6...",
            "createdAt": "2025-09-30T14:22:45Z"
          }
        ]
      }
    ]
  },
  "timestamp": "2025-09-30T14:30:00Z"
}
```

**Status Codes:**

- `200 OK`: Success
- `400 Bad Request`: Invalid parameters
- `404 Not Found`: Resource not found or not yet validated
- `500 Internal Server Error`: Server error

---

### 4. Get Validation Progress

Retrieve current batch validation progress.

**Endpoint:** `GET /validation/progress`

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `serverId` | integer | No | Active server | Filter by FHIR server ID |

**Response:**

```json
{
  "state": "running",
  "total": 1000,
  "processed": 450,
  "failed": 12,
  "startedAt": "2025-09-30T14:00:00Z",
  "updatedAt": "2025-09-30T14:30:00Z",
  "etaSeconds": 1200,
  "resourcesPerSecond": 3.75
}
```

**Status Codes:**

- `200 OK`: Success
- `404 Not Found`: No active batch validation
- `500 Internal Server Error`: Server error

---

### 5. Clear Validation Data

Clear validation results and messages.

**Endpoint:** `DELETE /validation/clear`

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `serverId` | integer | No | - | Clear data for specific server |
| `mode` | string | No | `all` | Clear mode (`all`, `per-aspect`, `legacy`) |

**Response:**

```json
{
  "success": true,
  "cleared": {
    "results": 1234,
    "messages": 5678,
    "groups": 42
  },
  "timestamp": "2025-09-30T14:30:00Z"
}
```

**Status Codes:**

- `200 OK`: Success
- `400 Bad Request`: Invalid parameters
- `500 Internal Server Error`: Server error

---

### 6. Edit Resource

Update a FHIR resource with optimistic concurrency control.

**Endpoint:** `PUT /fhir/resources/:resourceType/:id`

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `resourceType` | string | Yes | FHIR resource type (e.g., "Patient", "Observation") |
| `id` | string | Yes | FHIR resource ID |

**Headers:**

| Header | Type | Required | Description |
|--------|------|----------|-------------|
| `If-Match` | string | No | Version ID or ETag for conflict detection (recommended) |

**Request Body:** Complete FHIR resource JSON

**Response:**

```json
{
  "success": true,
  "resourceType": "Patient",
  "id": "patient-001",
  "versionId": "2",
  "beforeHash": "a1b2c3d4...",
  "afterHash": "e5f6g7h8...",
  "changed": true,
  "queuedRevalidation": true,
  "timestamp": "2025-09-30T14:30:00Z"
}
```

**Status Codes:**

- `200 OK`: Resource updated successfully
- `400 Bad Request`: Invalid resource structure or type/ID mismatch
- `404 Not Found`: Resource not found
- `409 Conflict`: Version conflict (If-Match failed)
- `422 Unprocessable Entity`: FHIR validation failed
- `500 Internal Server Error`: Server error

---

### 7. Batch Edit Resources

Apply JSON Patch operations to multiple resources.

**Endpoint:** `POST /fhir/resources/batch-edit`

**Request Body:**

```json
{
  "resourceType": "Patient",
  "filter": {
    "ids": ["patient-001", "patient-002"],
    "searchParams": { "gender": "female" }
  },
  "operations": [
    {
      "op": "replace",
      "path": "/active",
      "value": true
    },
    {
      "op": "add",
      "path": "/meta/tag",
      "value": { "system": "http://example.org", "code": "updated" }
    }
  ],
  "maxBatchSize": 100
}
```

**Request Parameters:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `resourceType` | string | Yes | FHIR resource type |
| `filter` | object | Yes | Filter criteria (ids or searchParams) |
| `filter.ids` | string[] | No | Array of resource IDs |
| `filter.searchParams` | object | No | FHIR search parameters |
| `operations` | array | Yes | JSON Patch operations (RFC 6902) |
| `maxBatchSize` | number | No | Max resources to edit (default: 100, max: 5000) |

**Operations Schema:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `op` | string | Yes | Operation: `add`, `remove`, `replace`, `copy`, `move`, `test` |
| `path` | string | Yes | JSON pointer path (e.g., "/name/0/family") |
| `value` | any | No | Value for add/replace operations |
| `from` | string | No | Source path for copy/move operations |

**Response:**

```json
{
  "success": true,
  "matched": 50,
  "modified": 48,
  "failed": 2,
  "results": [
    {
      "id": "patient-001",
      "success": true,
      "changed": true,
      "beforeHash": "a1b2c3...",
      "afterHash": "d4e5f6...",
      "versionId": "3"
    },
    {
      "id": "patient-002",
      "success": false,
      "error": "Patch operation failed",
      "details": ["Path not found: /invalidField"]
    }
  ],
  "queuedRevalidation": 48,
  "timestamp": "2025-09-30T14:30:00Z"
}
```

**Status Codes:**

- `200 OK`: Batch operation completed (check results for individual success/failure)
- `400 Bad Request`: Invalid request body or missing filter
- `500 Internal Server Error`: Server error

---

## Data Models

### ValidationMessageGroupDTO

```typescript
interface ValidationMessageGroupDTO {
  signature: string;              // SHA-256 hash of message components
  aspect: ValidationAspect;        // structural | profile | terminology | reference | businessRule | metadata
  severity: ValidationSeverity;    // error | warning | information
  code?: string;                   // Error code (optional)
  canonicalPath: string;           // Normalized FHIR path (no array indices)
  sampleMessage: string;           // First message text as sample
  totalResources: number;          // Count of unique resources with this message
  firstSeenAt: Date;               // First detection timestamp
  lastSeenAt: Date;                // Last detection timestamp
}
```

### ValidationGroupMemberDTO

```typescript
interface ValidationGroupMemberDTO {
  resourceType: string;
  fhirId: string;
  validatedAt: Date;
  perAspect: {
    aspect: ValidationAspect;
    isValid: boolean;
    errorCount: number;
    warningCount: number;
    informationCount: number;
  }[];
}
```

### ResourceMessagesDTO

```typescript
interface ResourceMessagesDTO {
  serverId: number;
  resourceType: string;
  fhirId: string;
  aspects: {
    aspect: ValidationAspect;
    isValid: boolean;
    errorCount: number;
    warningCount: number;
    informationCount: number;
    score: number;
    validatedAt: Date;
    messages: {
      id: number;
      severity: ValidationSeverity;
      code?: string;
      canonicalPath: string;
      text: string;
      signature: string;
      createdAt: Date;
    }[];
  }[];
}
```

---

## Error Handling

All endpoints follow a consistent error response format:

```json
{
  "success": false,
  "error": "Brief error description",
  "message": "Detailed error message",
  "details": [] // Optional: validation errors or additional context
}
```

### Common Error Codes

- `400 Bad Request`: Invalid query parameters or request body
- `404 Not Found`: Resource or signature not found
- `500 Internal Server Error`: Unexpected server error
- `503 Service Unavailable`: Service temporarily unavailable

---

## Performance Targets

| Endpoint | Target p95 Latency | Notes |
|----------|-------------------|-------|
| GET /validation/issues/groups | < 500ms | With 25K-250K resources |
| GET /validation/issues/groups/:signature/resources | < 500ms | Paginated results |
| GET /validation/resources/:type/:id/messages | < 300ms | Cached per-aspect results |
| GET /validation/progress | < 100ms | Lightweight state query |

---

## Signature Computation

Message signatures are computed using SHA-256 hash of normalized components:

```
signature = SHA-256(aspect + '|' + severity + '|' + (code||'') + '|' + canonicalPath + '|' + (ruleId||'') + '|' + normalizedText)
```

**Normalization Rules:**

- **Canonical Path**: Remove array indices, lowercase, remove whitespace, max 256 chars
- **Normalized Text**: Trim, collapse whitespace, lowercase, remove control chars, max 512 chars
- **Severity**: Lowercase
- **Code & RuleId**: Trim (if present)

**Stability:** Signatures are stable as long as normalization rules remain unchanged. Rule changes are versioned via `signature_version` field.

---

## Examples

### Example 1: Get all structural errors

```bash
GET /api/validation/issues/groups?aspect=structural&severity=error&sort=count:desc&page=1&size=25
```

### Example 2: Get resources with a specific message

```bash
GET /api/validation/issues/groups/a1b2c3d4e5f6.../resources?resourceType=Patient&page=1&size=25
```

### Example 3: Get all messages for a patient

```bash
GET /api/validation/resources/Patient/patient-001/messages?serverId=1
```

### Example 4: Edit a single resource

```bash
PUT /api/fhir/resources/Patient/patient-001
Headers:
  If-Match: W/"1"
  Content-Type: application/json
Body:
{
  "resourceType": "Patient",
  "id": "patient-001",
  "name": [{ "family": "Smith", "given": ["John"] }],
  "active": true
}
```

### Example 5: Batch edit multiple patients

```bash
POST /api/fhir/resources/batch-edit
Body:
{
  "resourceType": "Patient",
  "filter": { "ids": ["patient-001", "patient-002", "patient-003"] },
  "operations": [
    { "op": "replace", "path": "/active", "value": true }
  ],
  "maxBatchSize": 100
}
```

---

## Changelog

### Version 2.0 (2025-09-30)
- Added per-aspect validation endpoints
- Added signature-based message grouping
- Added pagination and filtering support
- Added consistent error handling

### Version 1.0 (2025-09-15)
- Initial API documentation
- Basic validation endpoints

---

## Related Documentation

- [PRD: Records FHIR Platform](../../requirements/prd-records-fhir-platform.md)
- [Validation Architecture](./VALIDATION_ARCHITECTURE.md)
- [Configuration Guide](./CONFIGURATION_GUIDE.md)
- [Troubleshooting Guide](./TROUBLESHOOTING_GUIDE.md)