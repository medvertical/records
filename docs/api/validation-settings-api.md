# Validation Settings API Documentation

## Overview

The Validation Settings API provides simplified endpoints for managing validation configuration. The API focuses on essential functionality: 6 validation aspects, performance settings, and resource type filtering.

## Base URL

```
http://localhost:3000/api/validation
```

## Authentication

All endpoints require valid authentication. Include authentication headers as configured in your environment.

## Endpoints

### 1. Get Validation Settings

Retrieve current validation settings for a server.

**Endpoint:** `GET /api/validation/settings`

**Query Parameters:**
- `serverId` (number, required): The ID of the FHIR server

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "serverId": 1,
    "aspects": {
      "structural": { "enabled": true, "severity": "error" },
      "profile": { "enabled": true, "severity": "warning" },
      "terminology": { "enabled": true, "severity": "warning" },
      "reference": { "enabled": true, "severity": "error" },
      "businessRules": { "enabled": true, "severity": "error" },
      "metadata": { "enabled": true, "severity": "error" }
    },
    "performance": {
      "maxConcurrent": 5,
      "batchSize": 50
    },
    "resourceTypes": {
      "enabled": true,
      "includedTypes": ["Patient", "Observation", "Encounter"],
      "excludedTypes": ["Binary", "OperationOutcome"]
    },
    "isActive": true,
    "createdAt": "2025-01-01T00:00:00.000Z",
    "updatedAt": "2025-01-01T00:00:00.000Z",
    "createdBy": "system",
    "updatedBy": "system"
  }
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Settings not found for server ID 1"
}
```

### 2. Update Validation Settings

Update validation settings for a server. Supports partial updates.

**Endpoint:** `PUT /api/validation/settings`

**Request Body:**
```json
{
  "serverId": 1,
  "aspects": {
    "structural": { "enabled": false, "severity": "warning" }
  },
  "performance": {
    "maxConcurrent": 10,
    "batchSize": 100
  },
  "resourceTypes": {
    "enabled": true,
    "includedTypes": ["Patient", "Observation", "Encounter", "Condition"],
    "excludedTypes": ["Binary"]
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "serverId": 1,
    "aspects": {
      "structural": { "enabled": false, "severity": "warning" },
      "profile": { "enabled": true, "severity": "warning" },
      "terminology": { "enabled": true, "severity": "warning" },
      "reference": { "enabled": true, "severity": "error" },
      "businessRules": { "enabled": true, "severity": "error" },
      "metadata": { "enabled": true, "severity": "error" }
    },
    "performance": {
      "maxConcurrent": 10,
      "batchSize": 100
    },
    "resourceTypes": {
      "enabled": true,
      "includedTypes": ["Patient", "Observation", "Encounter", "Condition"],
      "excludedTypes": ["Binary"]
    },
    "isActive": true,
    "createdAt": "2025-01-01T00:00:00.000Z",
    "updatedAt": "2025-01-01T12:00:00.000Z",
    "createdBy": "system",
    "updatedBy": "user"
  }
}
```

**Validation Errors:**
```json
{
  "success": false,
  "error": "Invalid severity value. Must be 'error', 'warning', or 'info'",
  "details": {
    "field": "aspects.structural.severity",
    "value": "invalid",
    "allowed": ["error", "warning", "info"]
  }
}
```

### 3. Reset to Default Settings

Reset validation settings to default values.

**Endpoint:** `POST /api/validation/settings/reset`

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
  "data": {
    "id": 1,
    "serverId": 1,
    "aspects": {
      "structural": { "enabled": true, "severity": "error" },
      "profile": { "enabled": true, "severity": "warning" },
      "terminology": { "enabled": true, "severity": "warning" },
      "reference": { "enabled": true, "severity": "error" },
      "businessRules": { "enabled": true, "severity": "error" },
      "metadata": { "enabled": true, "severity": "error" }
    },
    "performance": {
      "maxConcurrent": 5,
      "batchSize": 50
    },
    "resourceTypes": {
      "enabled": true,
      "includedTypes": [],
      "excludedTypes": []
    },
    "isActive": true,
    "createdAt": "2025-01-01T00:00:00.000Z",
    "updatedAt": "2025-01-01T12:00:00.000Z",
    "createdBy": "system",
    "updatedBy": "user"
  }
}
```

### 4. Get Resource Types by FHIR Version

Get available resource types for a specific FHIR version.

**Endpoint:** `GET /api/validation/resource-types/:version`

**Path Parameters:**
- `version` (string, required): FHIR version ('R4' or 'R5')

**Response:**
```json
{
  "success": true,
  "data": [
    "Patient",
    "Observation",
    "Encounter",
    "Condition",
    "Procedure",
    "Medication",
    "DiagnosticReport",
    "AllergyIntolerance",
    "Binary",
    "OperationOutcome"
  ]
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Invalid FHIR version. Must be 'R4' or 'R5'"
}
```

### 5. Migrate Settings Between FHIR Versions

Migrate validation settings from one FHIR version to another.

**Endpoint:** `POST /api/validation/settings/migrate`

**Request Body:**
```json
{
  "serverId": 1,
  "fromVersion": "R4",
  "toVersion": "R5"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "serverId": 1,
    "aspects": {
      "structural": { "enabled": true, "severity": "error" },
      "profile": { "enabled": true, "severity": "warning" },
      "terminology": { "enabled": true, "severity": "warning" },
      "reference": { "enabled": true, "severity": "error" },
      "businessRules": { "enabled": true, "severity": "error" },
      "metadata": { "enabled": true, "severity": "error" }
    },
    "performance": {
      "maxConcurrent": 5,
      "batchSize": 50
    },
    "resourceTypes": {
      "enabled": true,
      "includedTypes": ["Patient", "Observation", "Encounter", "DeviceMetric"],
      "excludedTypes": ["Binary", "OperationOutcome"]
    },
    "isActive": true,
    "createdAt": "2025-01-01T00:00:00.000Z",
    "updatedAt": "2025-01-01T12:00:00.000Z",
    "createdBy": "system",
    "updatedBy": "user"
  },
  "migration": {
    "fromVersion": "R4",
    "toVersion": "R5",
    "changes": {
      "resourceTypes": {
        "added": ["DeviceMetric", "Substance", "TestScript", "ClinicalImpression"],
        "removed": [],
        "modified": []
      }
    }
  }
}
```

## Data Models

### ValidationSettings

```typescript
interface ValidationSettings {
  id: number;
  serverId: number;
  aspects: {
    structural: ValidationAspectConfig;
    profile: ValidationAspectConfig;
    terminology: ValidationAspectConfig;
    reference: ValidationAspectConfig;
    businessRules: ValidationAspectConfig;
    metadata: ValidationAspectConfig;
  };
  performance: {
    maxConcurrent: number; // 1-20, default: 5
    batchSize: number;     // 10-100, default: 50
  };
  resourceTypes: {
    enabled: boolean;
    includedTypes: string[];
    excludedTypes: string[];
  };
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string;
}
```

### ValidationAspectConfig

```typescript
interface ValidationAspectConfig {
  enabled: boolean;
  severity: 'error' | 'warning' | 'info';
}
```

## Validation Rules

### Performance Settings
- `maxConcurrent`: Must be between 1 and 20
- `batchSize`: Must be between 10 and 100

### Aspect Severity
- Must be one of: 'error', 'warning', 'info'

### Resource Types
- Must be valid FHIR resource type names
- Cannot include both in `includedTypes` and `excludedTypes`

### FHIR Versions
- Supported versions: 'R4', 'R5'
- Resource types are validated against the specified version

## Error Handling

All endpoints return consistent error responses:

```json
{
  "success": false,
  "error": "Error message",
  "details": {
    "field": "fieldName",
    "value": "invalidValue",
    "allowed": ["valid", "values"]
  }
}
```

Common HTTP status codes:
- `200`: Success
- `400`: Bad Request (validation error)
- `404`: Not Found (settings not found)
- `500`: Internal Server Error

## Rate Limiting

API endpoints are rate-limited to prevent abuse:
- 100 requests per minute per IP address
- 1000 requests per hour per authenticated user

## Examples

### Update Only Performance Settings

```bash
curl -X PUT http://localhost:3000/api/validation/settings \
  -H "Content-Type: application/json" \
  -d '{
    "serverId": 1,
    "performance": {
      "maxConcurrent": 10,
      "batchSize": 100
    }
  }'
```

### Disable Specific Validation Aspects

```bash
curl -X PUT http://localhost:3000/api/validation/settings \
  -H "Content-Type: application/json" \
  -d '{
    "serverId": 1,
    "aspects": {
      "terminology": { "enabled": false, "severity": "warning" },
      "metadata": { "enabled": false, "severity": "info" }
    }
  }'
```

### Configure Resource Type Filtering

```bash
curl -X PUT http://localhost:3000/api/validation/settings \
  -H "Content-Type: application/json" \
  -d '{
    "serverId": 1,
    "resourceTypes": {
      "enabled": true,
      "includedTypes": ["Patient", "Observation", "Encounter", "Condition"],
      "excludedTypes": ["Binary", "OperationOutcome"]
    }
  }'
```

## Migration Guide

### From Complex to Simplified Settings

The API has been simplified from a complex schema to focus on essential functionality:

**Removed Features:**
- Audit trails and versioning
- Complex preset configurations
- Advanced validation rules
- Real-time synchronization (SSE/WebSocket)

**Simplified Features:**
- 6 core validation aspects only
- Basic performance settings (maxConcurrent, batchSize)
- Simple resource type filtering
- FHIR version-aware migration

**Migration Process:**
1. Existing complex settings are automatically migrated to simplified format
2. Unsupported features are removed or converted to defaults
3. Resource types are validated against current FHIR version
4. Settings are reset to safe defaults if migration fails

## Support

For API support and questions:
- Check the validation logs for detailed error information
- Verify FHIR server connectivity before making settings changes
- Test settings changes in a development environment first

