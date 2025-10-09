# Records FHIR Platform - MVP API Documentation

## Overview

This document provides comprehensive documentation for all API endpoints in the Records FHIR Validation Platform MVP.

**Base URL:** `http://localhost:3000/api`  
**API Version:** 1.0.0  
**Last Updated:** 2025-10-09

---

## Table of Contents

1. [Validation Groups API](#validation-groups-api)
2. [Validation Progress API](#validation-progress-api)
3. [Resource Messages API](#resource-messages-api)
4. [Resource Edit API](#resource-edit-api)
5. [Batch Edit API](#batch-edit-api)
6. [Validation Settings API](#validation-settings-api)
7. [Health Check API](#health-check-api)
8. [Error Codes](#error-codes)

---

## Validation Groups API

### Get Validation Issue Groups

Groups validation issues by message signature to identify systemic problems.

**Endpoint:** `GET /api/validation/issues/groups`

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `serverId` | number | No | Server ID (default: 1) |
| `aspect` | string | No | Filter by aspect (structural, profile, terminology, reference, businessRule, metadata) |
| `severity` | string | No | Filter by severity (error, warning, information) |
| `code` | string | No | Filter by error code |
| `path` | string | No | Filter by canonical path (partial match) |
| `resourceType` | string | No | Filter by resource type |
| `page` | number | No | Page number (default: 1) |
| `size` | number | No | Page size (default: 25) |
| `sort` | string | No | Sort order: `count:desc`, `count:asc`, `severity:desc`, `severity:asc` (default: `count:desc`) |

**Response:**

```json
{
  "groups": [
    {
      "signature": "a1b2c3d4e5f6...",
      "aspect": "structural",
      "severity": "error",
      "code": "required",
      "canonicalPath": "patient.name",
      "sampleText": "Patient.name: minimum required = 1, but only found 0",
      "totalResources": 42
    }
  ],
  "total": 15
}
```

**Example Request:**

```bash
GET /api/validation/issues/groups?serverId=1&aspect=structural&severity=error&sort=count:desc&page=1&size=25
```

---

### Get Group Members

Get resources affected by a specific validation issue.

**Endpoint:** `GET /api/validation/issues/groups/:signature/resources`

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `signature` | string | Yes | Message signature hash |

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `serverId` | number | No | Server ID (default: 1) |
| `resourceType` | string | No | Filter by resource type |
| `page` | number | No | Page number (default: 1) |
| `size` | number | No | Page size (default: 25) |
| `sort` | string | No | Sort order: `validatedAt:desc`, `validatedAt:asc` (default: `validatedAt:desc`) |

**Response:**

```json
{
  "members": [
    {
      "resourceType": "Patient",
      "fhirId": "patient-001",
      "validatedAt": "2025-10-09T10:30:00Z",
      "perAspect": [
        {
          "aspect": "structural",
          "isValid": false,
          "errorCount": 1,
          "warningCount": 0,
          "informationCount": 0,
          "score": 0
        }
      ]
    }
  ],
  "total": 42
}
```

**Example Request:**

```bash
GET /api/validation/issues/groups/a1b2c3d4e5f6.../resources?serverId=1&resourceType=Patient&page=1&size=25
```

---

## Resource Messages API

### Get Resource Validation Messages

Get all validation messages for a specific resource, organized by aspect.

**Endpoint:** `GET /api/validation/resources/:resourceType/:id/messages`

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `resourceType` | string | Yes | FHIR resource type (e.g., Patient, Observation) |
| `id` | string | Yes | FHIR resource ID |

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `serverId` | number | No | Server ID (default: 1) |

**Response:**

```json
{
  "resourceType": "Patient",
  "fhirId": "patient-001",
  "aspects": [
    {
      "aspect": "structural",
      "messages": [
        {
          "severity": "error",
          "code": "required",
          "canonicalPath": "patient.name",
          "text": "Patient.name: minimum required = 1, but only found 0",
          "signature": "a1b2c3d4e5f6...",
          "timestamp": "2025-10-09T10:30:00Z"
        }
      ]
    }
  ]
}
```

**Example Request:**

```bash
GET /api/validation/resources/Patient/patient-001/messages?serverId=1
```

---

## Validation Progress API

### Get Validation Progress

Get current batch validation progress.

**Endpoint:** `GET /api/validation/progress`

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `serverId` | number | No | Server ID (default: 1) |

**Response:**

```json
{
  "state": "running",
  "total": 1000,
  "processed": 450,
  "failed": 5,
  "startedAt": "2025-10-09T10:00:00Z",
  "updatedAt": "2025-10-09T10:15:00Z",
  "etaSeconds": 600
}
```

**States:** `queued`, `running`, `paused`, `completed`, `failed`

---

### Pause Validation

Pause the current batch validation process.

**Endpoint:** `POST /api/validation/progress/pause`

**Request Body:**

```json
{
  "serverId": 1
}
```

**Response:**

```json
{
  "success": true,
  "message": "Validation paused successfully"
}
```

---

### Resume Validation

Resume a paused validation process.

**Endpoint:** `POST /api/validation/progress/resume`

**Request Body:**

```json
{
  "serverId": 1
}
```

**Response:**

```json
{
  "success": true,
  "message": "Validation resumed successfully"
}
```

---

### Start Validation

Start a new batch validation process.

**Endpoint:** `POST /api/validation/progress/start`

**Request Body:**

```json
{
  "serverId": 1,
  "resourceTypes": ["Patient", "Observation"]
}
```

**Response:**

```json
{
  "success": true,
  "message": "Validation started successfully",
  "jobId": "job-123abc"
}
```

---

## Resource Edit API

### Update Single Resource

Update a FHIR resource with optimistic concurrency control.

**Endpoint:** `PUT /api/fhir/resources/:resourceType/:id`

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `resourceType` | string | Yes | FHIR resource type |
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
  "timestamp": "2025-10-09T10:30:00Z"
}
```

**Status Codes:**

- `200 OK` - Resource updated successfully
- `400 Bad Request` - Invalid resource structure
- `404 Not Found` - Resource not found
- `409 Conflict` - Version conflict (If-Match failed)
- `422 Unprocessable Entity` - FHIR validation failed
- `500 Internal Server Error` - Server error

**Example Request:**

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

---

## Batch Edit API

### Batch Edit Resources

Apply JSON Patch operations to multiple resources.

**Endpoint:** `POST /api/fhir/resources/batch-edit`

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

**Request Schema:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `resourceType` | string | Yes | FHIR resource type |
| `filter` | object | Yes | Filter criteria (ids or searchParams) |
| `filter.ids` | string[] | No | Array of resource IDs |
| `filter.searchParams` | object | No | FHIR search parameters |
| `operations` | array | Yes | JSON Patch operations (RFC 6902) |
| `maxBatchSize` | number | No | Max resources to edit (default: 100, max: 5000) |

**Operations:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `op` | string | Yes | Operation: `add`, `remove`, `replace` |
| `path` | string | Yes | JSON pointer path (e.g., "/name/0/family") |
| `value` | any | No | Value for add/replace operations |

**Response:**

```json
{
  "success": true,
  "matched": 50,
  "modified": 45,
  "failed": 5,
  "results": [
    {
      "id": "patient-001",
      "success": true,
      "changed": true,
      "beforeHash": "a1b2c3d4...",
      "afterHash": "e5f6g7h8...",
      "versionId": "2"
    }
  ],
  "queuedRevalidation": 45,
  "timestamp": "2025-10-09T10:30:00Z"
}
```

---

## Validation Settings API

### Update Validation Settings

Update validation settings and automatically invalidate existing results.

**Endpoint:** `PUT /api/validation/settings`

**Request Body:**

```json
{
  "serverId": 1,
  "aspects": {
    "structural": { "enabled": true, "severity": "error" },
    "profile": { "enabled": true, "severity": "warning" },
    "terminology": { "enabled": false, "severity": "warning" }
  },
  "performance": {
    "maxConcurrent": 10,
    "batchSize": 100
  }
}
```

**Response:**

```json
{
  "success": true,
  "settings": { /* updated settings */ },
  "invalidated": true,
  "invalidatedCount": 1523,
  "revalidationStarted": false,
  "message": "Settings updated successfully. 1523 validation results invalidated. Resources will be revalidated when browsed."
}
```

---

## Health Check API

### Basic Health Check

Check if the service is running.

**Endpoint:** `GET /api/health`

**Response:**

```json
{
  "status": "healthy",
  "timestamp": "2025-10-09T10:30:00Z",
  "uptime": 3600.5,
  "service": "records-fhir-platform",
  "version": "1.0.0"
}
```

---

### Readiness Check

Check if the service is ready to accept requests (checks database and FHIR server).

**Endpoint:** `GET /api/health/ready`

**Response:**

```json
{
  "status": "ready",
  "timestamp": "2025-10-09T10:30:00Z",
  "checks": {
    "database": {
      "status": "healthy",
      "message": "Database connection successful"
    },
    "fhirServer": {
      "status": "healthy",
      "message": "Connected to http://localhost:8080/fhir"
    }
  }
}
```

**Status Codes:**

- `200 OK` - Service is ready
- `503 Service Unavailable` - Service is not ready

---

### Metrics Endpoint

Get service metrics.

**Endpoint:** `GET /api/health/metrics`

**Response:**

```json
{
  "process_uptime_seconds": 3600.5,
  "process_memory_usage_bytes": {
    "rss": 50331648,
    "heapTotal": 20971520,
    "heapUsed": 15728640,
    "external": 1048576
  },
  "process_cpu_usage": {
    "user": 1234567,
    "system": 234567
  },
  "nodejs_version": "v18.17.0",
  "environment": "production",
  "timestamp": "2025-10-09T10:30:00Z"
}
```

---

### Liveness Probe

Kubernetes-style liveness probe.

**Endpoint:** `GET /api/health/live`

**Response:**

```json
{
  "status": "alive"
}
```

---

## Error Codes

### Standard HTTP Status Codes

| Code | Description |
|------|-------------|
| 200 | OK - Request successful |
| 201 | Created - Resource created successfully |
| 400 | Bad Request - Invalid request parameters or body |
| 401 | Unauthorized - Authentication required |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource not found |
| 409 | Conflict - Resource conflict (version mismatch) |
| 422 | Unprocessable Entity - Validation failed |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Internal Server Error - Server error |
| 503 | Service Unavailable - Service not ready |

### Custom Error Response Format

```json
{
  "success": false,
  "error": "Error type",
  "message": "Human-readable error message",
  "code": "ERROR_CODE",
  "details": []
}
```

### Common Error Codes

| Code | Description |
|------|-------------|
| `INVALID_REQUEST` | Request body or parameters are invalid |
| `VALIDATION_FAILED` | Resource validation failed |
| `VERSION_CONFLICT` | Resource version conflict |
| `RESOURCE_NOT_FOUND` | Requested resource not found |
| `SERVER_ERROR` | Internal server error |
| `SERVICE_UNAVAILABLE` | Required service is unavailable |

---

## Rate Limiting

- Standard rate limit: 100 requests per minute per IP
- Batch operations: 10 requests per minute per IP
- Edit operations: 20 requests per minute per IP

Rate limit headers:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1696857600
```

---

## Authentication

MVP version does not implement authentication. All endpoints are publicly accessible.

**Note:** Authentication and authorization will be added in future releases.

---

## Versioning

API version is currently `1.0.0`. Breaking changes will result in a new major version.

Version information is available in the health check endpoint: `GET /api/health`

---

## Related Documentation

- [PRD: Records FHIR Platform](../requirements/prd-records-fhir-platform.md)
- [Validation Architecture](../technical/validation/VALIDATION_ARCHITECTURE.md)
- [Deployment Guide](../deployment/DEPLOYMENT_GUIDE.md)

---

**Last Updated:** 2025-10-09  
**API Version:** 1.0.0  
**Document Version:** 1.0

