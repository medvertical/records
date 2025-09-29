# FHIR Validation API Documentation

## Overview

This document provides comprehensive API documentation for the FHIR validation system, including endpoints, request/response formats, authentication, and usage examples.

## Table of Contents

1. [Authentication](#authentication)
2. [Base URLs and Versioning](#base-urls-and-versioning)
3. [Validation Endpoints](#validation-endpoints)
4. [FHIR Version Support Endpoints](#fhir-version-support-endpoints)
5. [Settings Endpoints](#settings-endpoints)
6. [Health Check Endpoints](#health-check-endpoints)
7. [Metrics Endpoints](#metrics-endpoints)
8. [Error Handling](#error-handling)
9. [Rate Limiting](#rate-limiting)
10. [WebSocket/SSE Endpoints](#websocketsse-endpoints)
11. [Usage Examples](#usage-examples)

## Authentication

### JWT Authentication

The API uses JWT (JSON Web Tokens) for authentication. Include the token in the Authorization header:

```http
Authorization: Bearer <your-jwt-token>
```

### API Key Authentication

For service-to-service communication, API keys can be used:

```http
X-API-Key: <your-api-key>
```

### Authentication Endpoints

#### Login

```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "your-username",
  "password": "your-password"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": "24h",
    "user": {
      "id": "user-123",
      "username": "your-username",
      "role": "admin"
    }
  }
}
```

#### Refresh Token

```http
POST /api/auth/refresh
Authorization: Bearer <your-jwt-token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": "24h"
  }
}
```

## Base URLs and Versioning

### Base URL

```
Production: https://api.records-platform.com/v1
Development: http://localhost:3000/api/v1
```

### API Versioning

The API uses URL path versioning:
- `v1`: Current stable version
- `v2`: Next version (in development)

## Validation Endpoints

### Validate Single Resource

Validate a single FHIR resource:

```http
POST /api/v1/validation/validate
Authorization: Bearer <token>
Content-Type: application/json

{
  "resource": {
    "resourceType": "Patient",
    "id": "patient-001",
    "name": [{
      "family": "Smith",
      "given": ["John"]
    }],
    "gender": "male",
    "birthDate": "1990-01-01"
  },
  "options": {
    "aspects": ["structural", "profile", "terminology"],
    "strict": false,
    "includeWarnings": true
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "resourceType": "Patient",
    "resourceId": "patient-001",
    "isValid": true,
    "score": 95,
    "issues": [
      {
        "id": "issue-001",
        "severity": "warning",
        "message": "Patient name should include at least one given name",
        "path": "Patient.name[0].given",
        "aspect": "business-rule"
      }
    ],
    "aspects": [
      {
        "name": "structural",
        "score": 100,
        "issues": [],
        "validated": true
      },
      {
        "name": "profile",
        "score": 100,
        "issues": [],
        "validated": true
      },
      {
        "name": "terminology",
        "score": 85,
        "issues": [
          {
            "id": "term-001",
            "severity": "warning",
            "message": "Gender code 'male' is valid but consider using 'http://hl7.org/fhir/administrative-gender'",
            "path": "Patient.gender"
          }
        ],
        "validated": true
      }
    ],
    "performance": {
      "totalTimeMs": 150,
      "aspectTimes": {
        "structural": 25,
        "profile": 30,
        "terminology": 95
      }
    },
    "validatedAt": "2024-01-15T10:30:00Z"
  }
}
```

### Validate Multiple Resources

Validate multiple FHIR resources in batch:

```http
POST /api/v1/validation/validate/batch
Authorization: Bearer <token>
Content-Type: application/json

{
  "resources": [
    {
      "resourceType": "Patient",
      "id": "patient-001",
      "name": [{"family": "Smith", "given": ["John"]}]
    },
    {
      "resourceType": "Observation",
      "id": "obs-001",
      "status": "final",
      "code": {"coding": [{"system": "http://loinc.org", "code": "33747-0"}]}
    }
  ],
  "options": {
    "aspects": ["structural", "profile"],
    "concurrent": true,
    "maxConcurrent": 5
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "results": [
      {
        "resourceType": "Patient",
        "resourceId": "patient-001",
        "isValid": true,
        "score": 95,
        "issues": [],
        "aspects": [...],
        "performance": {...}
      },
      {
        "resourceType": "Observation",
        "resourceId": "obs-001",
        "isValid": false,
        "score": 60,
        "issues": [...],
        "aspects": [...],
        "performance": {...}
      }
    ],
    "summary": {
      "totalResources": 2,
      "validResources": 1,
      "invalidResources": 1,
      "averageScore": 77.5,
      "totalTimeMs": 300
    }
  }
}
```

### Get Validation Results

Retrieve previously stored validation results:

```http
GET /api/v1/validation/results/{resourceId}
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "resourceType": "Patient",
    "resourceId": "patient-001",
    "isValid": true,
    "score": 95,
    "issues": [...],
    "aspects": [...],
    "performance": {...},
    "validatedAt": "2024-01-15T10:30:00Z",
    "cached": false
  }
}
```

### List Validation Results

List validation results with filtering and pagination:

```http
GET /api/v1/validation/results?resourceType=Patient&scoreMin=80&limit=10&offset=0
Authorization: Bearer <token>
```

**Query Parameters:**
- `resourceType`: Filter by resource type
- `scoreMin`: Minimum validation score
- `scoreMax`: Maximum validation score
- `isValid`: Filter by validation status (true/false)
- `aspect`: Filter by validation aspect
- `limit`: Number of results per page (default: 20, max: 100)
- `offset`: Number of results to skip (default: 0)
- `sortBy`: Sort field (score, validatedAt, resourceType)
- `sortOrder`: Sort order (asc, desc)

**Response:**
```json
{
  "success": true,
  "data": {
    "results": [
      {
        "resourceType": "Patient",
        "resourceId": "patient-001",
        "isValid": true,
        "score": 95,
        "validatedAt": "2024-01-15T10:30:00Z"
      }
    ],
    "pagination": {
      "total": 150,
      "limit": 10,
      "offset": 0,
      "hasMore": true
    },
    "filters": {
      "resourceType": "Patient",
      "scoreMin": 80
    }
  }
}
```

## FHIR Version Support Endpoints

### Version Detection

#### Detect FHIR Version

Detect the FHIR version of a resource:

```http
POST /api/v1/validation/detect-version
Content-Type: application/json

{
  "resource": {
    "resourceType": "Patient",
    "id": "patient-001",
    "meta": {
      "profile": ["http://hl7.org/fhir/r5/StructureDefinition/Patient"]
    }
  }
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "fhirVersion": "R5",
    "confidence": 0.95,
    "detectionMethod": "profile-analysis",
    "details": {
      "profileIndicators": ["r5"],
      "featureIndicators": ["contained-resources"],
      "metadataIndicators": []
    }
  }
}
```

### Version-Specific Validation

#### Validate R4 Resource

Validate a resource against FHIR R4 specifications:

```http
POST /api/v1/validation/validate-r4
Content-Type: application/json

{
  "resource": {
    "resourceType": "Patient",
    "id": "patient-r4-001",
    "name": [
      {
        "use": "official",
        "family": "Smith",
        "given": ["John"]
      }
    ],
    "gender": "male",
    "birthDate": "1990-01-01"
  }
}
```

#### Validate R5 Resource

Validate a resource against FHIR R5 specifications:

```http
POST /api/v1/validation/validate-r5
Content-Type: application/json

{
  "resource": {
    "resourceType": "Patient",
    "id": "patient-r5-001",
    "meta": {
      "profile": ["http://hl7.org/fhir/r5/StructureDefinition/Patient"]
    },
    "name": [
      {
        "use": "official",
        "family": "Johnson",
        "given": ["Jane"]
      }
    ],
    "gender": "female",
    "birthDate": "1985-05-15",
    "contained": [
      {
        "resourceType": "Organization",
        "id": "org-001",
        "name": "Test Organization"
      }
    ]
  }
}
```

#### Validate R6 Resource

Validate a resource against FHIR R6 specifications:

```http
POST /api/v1/validation/validate-r6
Content-Type: application/json

{
  "resource": {
    "resourceType": "Patient",
    "id": "patient-r6-001",
    "meta": {
      "profile": ["http://hl7.org/fhir/r6/StructureDefinition/Patient"],
      "versionId": "2",
      "security": [
        {
          "system": "http://terminology.hl7.org/CodeSystem/v3-Confidentiality",
          "code": "R"
        }
      ]
    },
    "name": [
      {
        "use": "official",
        "family": "Williams",
        "given": ["Robert"]
      }
    ],
    "gender": "other",
    "birthDate": "1992-12-25"
  }
}
```

### Terminology Validation by Version

#### Validate Code Against R4 Ontoserver

```http
POST /api/v1/validation/terminology/r4/validate-code
Content-Type: application/json

{
  "code": "male",
  "system": "http://hl7.org/fhir/administrative-gender",
  "valueSet": "http://hl7.org/fhir/ValueSet/administrative-gender"
}
```

#### Validate Code Against R5 Ontoserver

```http
POST /api/v1/validation/terminology/r5/validate-code
Content-Type: application/json

{
  "code": "365873007",
  "system": "http://snomed.info/sct",
  "valueSet": "http://snomed.info/sct?fhir_vs=isa/365873007"
}
```

#### Validate Code Against R6 Ontoserver

```http
POST /api/v1/validation/terminology/r6/validate-code
Content-Type: application/json

{
  "code": "365873007",
  "system": "http://snomed.info/sct",
  "valueSet": "http://snomed.info/sct?fhir_vs=isa/365873007"
}
```

### Ontoserver Connectivity

#### Test R4 Ontoserver Connectivity

```http
GET /api/v1/validation/terminology/r4/test-connectivity
```

#### Test R5 Ontoserver Connectivity

```http
GET /api/v1/validation/terminology/r5/test-connectivity
```

#### Test R6 Ontoserver Connectivity

```http
GET /api/v1/validation/terminology/r6/test-connectivity
```

**Response:**

```json
{
  "success": true,
  "data": {
    "ontoserverVersion": "R5",
    "fhirVersion": "5.0.0",
    "responseTime": 245,
    "capabilities": {
      "terminology": true,
      "validation": true,
      "expansion": true
    }
  }
}
```

### Cross-Version Compatibility

#### Validate Resource Across All Versions

```http
POST /api/v1/validation/validate-cross-version
Content-Type: application/json

{
  "resource": {
    "resourceType": "Patient",
    "id": "patient-compat-001",
    "name": [
      {
        "use": "official",
        "family": "Compatibility",
        "given": ["Test"]
      }
    ]
  },
  "versions": ["R4", "R5", "R6"]
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "results": {
      "R4": {
        "valid": true,
        "issues": [],
        "score": 100
      },
      "R5": {
        "valid": true,
        "issues": [],
        "score": 100
      },
      "R6": {
        "valid": true,
        "issues": [],
        "score": 100
      }
    },
    "compatibility": "full",
    "recommendedVersion": "R4"
  }
}
```

## Settings Endpoints

### Get Validation Settings

Retrieve current validation settings:

```http
GET /api/v1/validation/settings
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "enabled": true,
    "aspects": {
      "structural": {
        "enabled": true,
        "strict": false
      },
      "profile": {
        "enabled": true,
        "strict": true
      },
      "terminology": {
        "enabled": true,
        "strict": false,
        "ontoserverUrl": "https://r4.ontoserver.csiro.au/fhir"
      },
      "reference": {
        "enabled": true,
        "strict": false,
        "firelyUrl": "https://server.fire.ly/R4"
      },
      "businessRule": {
        "enabled": true,
        "strict": false
      },
      "metadata": {
        "enabled": true,
        "strict": false
      }
    },
    "scoring": {
      "errorPenalty": 10,
      "warningPenalty": 5,
      "infoPenalty": 1,
      "maxScore": 100,
      "minScore": 0
    },
    "performance": {
      "timeout": 5000,
      "retryAttempts": 3,
      "retryDelay": 1000,
      "batchSize": 10,
      "maxConcurrent": 5
    },
    "updatedAt": "2024-01-15T10:00:00Z"
  }
}
```

### Update Validation Settings

Update validation settings:

```http
PUT /api/v1/validation/settings
Authorization: Bearer <token>
Content-Type: application/json

{
  "aspects": {
    "structural": {
      "enabled": true,
      "strict": false
    },
    "terminology": {
      "enabled": true,
      "strict": true,
      "ontoserverUrl": "https://r4.ontoserver.csiro.au/fhir"
    }
  },
  "scoring": {
    "errorPenalty": 15,
    "warningPenalty": 8
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "enabled": true,
    "aspects": {...},
    "scoring": {
      "errorPenalty": 15,
      "warningPenalty": 8,
      "infoPenalty": 1,
      "maxScore": 100,
      "minScore": 0
    },
    "performance": {...},
    "updatedAt": "2024-01-15T10:30:00Z"
  }
}
```

### Reset Validation Settings

Reset validation settings to defaults:

```http
POST /api/v1/validation/settings/reset
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Validation settings reset to defaults",
    "settings": {
      "enabled": true,
      "aspects": {...},
      "scoring": {...},
      "performance": {...}
    }
  }
}
```

## Health Check Endpoints

### System Health Check

Check overall system health:

```http
GET /api/v1/health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "services": {
    "database": {
      "status": "healthy",
      "responseTime": 5,
      "lastChecked": "2024-01-15T10:30:00Z"
    },
    "ontoserver": {
      "status": "healthy",
      "responseTime": 150,
      "lastChecked": "2024-01-15T10:30:00Z",
      "version": "R4"
    },
    "firely": {
      "status": "healthy",
      "responseTime": 200,
      "lastChecked": "2024-01-15T10:30:00Z",
      "version": "R4"
    },
    "cache": {
      "status": "healthy",
      "hitRate": 85.5,
      "size": 1250,
      "lastChecked": "2024-01-15T10:30:00Z"
    }
  },
  "performance": {
    "memory": {
      "used": 256,
      "total": 512,
      "unit": "MB"
    },
    "uptime": 86400,
    "cpu": {
      "usage": 25.5,
      "unit": "percent"
    }
  }
}
```

### Readiness Check

Check if the service is ready to accept requests:

```http
GET /api/v1/health/ready
```

**Response:**
```json
{
  "status": "ready",
  "timestamp": "2024-01-15T10:30:00Z",
  "checks": {
    "database": "ready",
    "externalServices": "ready",
    "cache": "ready"
  }
}
```

### Liveness Check

Check if the service is alive:

```http
GET /api/v1/health/live
```

**Response:**
```json
{
  "status": "alive",
  "timestamp": "2024-01-15T10:30:00Z",
  "uptime": 86400
}
```

## Metrics Endpoints

### Get Performance Metrics

Retrieve performance metrics:

```http
GET /api/v1/metrics
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "validation": {
      "totalValidations": 15420,
      "averageTime": 150,
      "errorRate": 0.02,
      "throughput": 25.5,
      "last24Hours": {
        "validations": 1250,
        "averageScore": 87.5,
        "topIssues": [
          {
            "message": "Missing required field",
            "count": 45,
            "percentage": 3.6
          }
        ]
      }
    },
    "cache": {
      "hitRate": 85.5,
      "missRate": 14.5,
      "size": 1250,
      "memoryUsage": 45.2
    },
    "external": {
      "ontoserver": {
        "totalCalls": 5420,
        "averageResponseTime": 150,
        "errorRate": 0.01,
        "successRate": 99.9
      },
      "firely": {
        "totalCalls": 3210,
        "averageResponseTime": 200,
        "errorRate": 0.02,
        "successRate": 98.8
      }
    },
    "performance": {
      "memory": {
        "used": 256,
        "total": 512,
        "unit": "MB"
      },
      "cpu": {
        "usage": 25.5,
        "unit": "percent"
      }
    }
  }
}
```

### Get Cache Statistics

Retrieve cache performance statistics:

```http
GET /api/v1/metrics/cache
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "global": {
      "hits": 12540,
      "misses": 2160,
      "hitRate": 85.3,
      "totalSize": 1250,
      "memoryUsage": 45.2
    },
    "codeSystem": {
      "hits": 5420,
      "misses": 580,
      "hitRate": 90.3,
      "size": 500,
      "ttl": 1800000
    },
    "valueSet": {
      "hits": 4320,
      "misses": 680,
      "hitRate": 86.4,
      "size": 750,
      "ttl": 900000
    },
    "validationResults": {
      "hits": 2800,
      "misses": 900,
      "hitRate": 75.7,
      "size": 1000,
      "ttl": 3600000
    }
  }
}
```

## Error Handling

### Error Response Format

All API errors follow a consistent format:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Resource validation failed",
    "details": "The provided FHIR resource is invalid",
    "timestamp": "2024-01-15T10:30:00Z",
    "requestId": "req-12345"
  }
}
```

### HTTP Status Codes

- `200 OK`: Request successful
- `201 Created`: Resource created successfully
- `400 Bad Request`: Invalid request data
- `401 Unauthorized`: Authentication required
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Resource not found
- `422 Unprocessable Entity`: Validation failed
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Server error
- `502 Bad Gateway`: External service error
- `503 Service Unavailable`: Service temporarily unavailable

### Common Error Codes

- `VALIDATION_ERROR`: Resource validation failed
- `EXTERNAL_SERVICE_ERROR`: External service unavailable
- `CONFIGURATION_ERROR`: Invalid configuration
- `AUTHENTICATION_ERROR`: Authentication failed
- `AUTHORIZATION_ERROR`: Insufficient permissions
- `RATE_LIMIT_ERROR`: Rate limit exceeded
- `TIMEOUT_ERROR`: Request timeout
- `DATABASE_ERROR`: Database operation failed

## Rate Limiting

### Rate Limit Headers

Rate limiting information is included in response headers:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1642248000
X-RateLimit-Window: 900000
```

### Rate Limit Exceeded Response

When rate limit is exceeded:

```http
HTTP/1.1 429 Too Many Requests
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1642248000

{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_ERROR",
    "message": "Rate limit exceeded",
    "details": "You have exceeded the rate limit of 100 requests per 15 minutes",
    "retryAfter": 300
  }
}
```

## WebSocket/SSE Endpoints

### Server-Sent Events for Real-time Updates

Subscribe to real-time validation updates:

```http
GET /api/v1/validation/events
Authorization: Bearer <token>
Accept: text/event-stream
```

**Event Types:**

#### Validation Completed

```
event: validation-completed
data: {
  "resourceId": "patient-001",
  "resourceType": "Patient",
  "score": 95,
  "isValid": true,
  "issues": [...],
  "timestamp": "2024-01-15T10:30:00Z"
}
```

#### Validation Error

```
event: validation-error
data: {
  "resourceId": "patient-001",
  "error": "External service timeout",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

#### Validation Progress

```
event: validation-progress
data: {
  "totalResources": 100,
  "processedResources": 45,
  "currentResource": "patient-045",
  "estimatedTimeRemaining": 120,
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### WebSocket Connection

For bidirectional communication:

```javascript
const ws = new WebSocket('wss://api.records-platform.com/v1/validation/ws', {
  headers: {
    'Authorization': 'Bearer <token>'
  }
});

ws.onopen = () => {
  console.log('WebSocket connected');
  
  // Subscribe to validation updates
  ws.send(JSON.stringify({
    type: 'subscribe',
    channel: 'validation-updates',
    resourceIds: ['patient-001', 'patient-002']
  }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Received:', data);
};

ws.onclose = () => {
  console.log('WebSocket disconnected');
};
```

## Usage Examples

### JavaScript/Node.js

```javascript
const axios = require('axios');

const validationClient = {
  baseURL: 'https://api.records-platform.com/v1',
  token: 'your-jwt-token',
  
  async validateResource(resource, options = {}) {
    const response = await axios.post(`${this.baseURL}/validation/validate`, {
      resource,
      options
    }, {
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      }
    });
    
    return response.data;
  },
  
  async getValidationResults(resourceId) {
    const response = await axios.get(`${this.baseURL}/validation/results/${resourceId}`, {
      headers: {
        'Authorization': `Bearer ${this.token}`
      }
    });
    
    return response.data;
  },
  
  async getSettings() {
    const response = await axios.get(`${this.baseURL}/validation/settings`, {
      headers: {
        'Authorization': `Bearer ${this.token}`
      }
    });
    
    return response.data;
  }
};

// Usage
const patient = {
  resourceType: 'Patient',
  id: 'patient-001',
  name: [{ family: 'Smith', given: ['John'] }],
  gender: 'male'
};

validationClient.validateResource(patient)
  .then(result => console.log('Validation result:', result))
  .catch(error => console.error('Validation error:', error));
```

### Python

```python
import requests
import json

class ValidationClient:
    def __init__(self, base_url, token):
        self.base_url = base_url
        self.headers = {
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json'
        }
    
    def validate_resource(self, resource, options=None):
        url = f"{self.base_url}/validation/validate"
        payload = {
            'resource': resource,
            'options': options or {}
        }
        
        response = requests.post(url, json=payload, headers=self.headers)
        response.raise_for_status()
        return response.json()
    
    def get_validation_results(self, resource_id):
        url = f"{self.base_url}/validation/results/{resource_id}"
        response = requests.get(url, headers=self.headers)
        response.raise_for_status()
        return response.json()
    
    def get_settings(self):
        url = f"{self.base_url}/validation/settings"
        response = requests.get(url, headers=self.headers)
        response.raise_for_status()
        return response.json()

# Usage
client = ValidationClient('https://api.records-platform.com/v1', 'your-jwt-token')

patient = {
    'resourceType': 'Patient',
    'id': 'patient-001',
    'name': [{'family': 'Smith', 'given': ['John']}],
    'gender': 'male'
}

try:
    result = client.validate_resource(patient)
    print('Validation result:', json.dumps(result, indent=2))
except requests.exceptions.RequestException as e:
    print('Validation error:', e)
```

### cURL Examples

#### Validate a Patient Resource

```bash
curl -X POST "https://api.records-platform.com/v1/validation/validate" \
  -H "Authorization: Bearer your-jwt-token" \
  -H "Content-Type: application/json" \
  -d '{
    "resource": {
      "resourceType": "Patient",
      "id": "patient-001",
      "name": [{"family": "Smith", "given": ["John"]}],
      "gender": "male",
      "birthDate": "1990-01-01"
    },
    "options": {
      "aspects": ["structural", "profile", "terminology"],
      "strict": false
    }
  }'
```

#### Get Validation Settings

```bash
curl -X GET "https://api.records-platform.com/v1/validation/settings" \
  -H "Authorization: Bearer your-jwt-token"
```

#### Get Health Status

```bash
curl -X GET "https://api.records-platform.com/v1/health"
```

## Conclusion

This API documentation provides comprehensive information for integrating with the FHIR validation system. The API is designed to be RESTful, consistent, and easy to use, with proper error handling, authentication, and real-time capabilities.

Key features of the API:

- **RESTful Design**: Consistent HTTP methods and status codes
- **Authentication**: JWT and API key support
- **Real-time Updates**: WebSocket and SSE support
- **Comprehensive Error Handling**: Detailed error responses
- **Rate Limiting**: Built-in protection against abuse
- **Health Monitoring**: Extensive health check endpoints
- **Performance Metrics**: Detailed performance and usage statistics
- **Flexible Validation**: Configurable validation aspects and options

For additional support or questions about the API, please refer to the troubleshooting guide or contact the development team.
