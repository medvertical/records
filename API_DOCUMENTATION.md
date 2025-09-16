# Records FHIR Validation Platform - API Documentation

## Overview

The Records FHIR Validation Platform provides a RESTful API for FHIR server validation, resource management, and real-time monitoring. This document describes the available API endpoints and their usage.

## Base URL

- **Local Development**: `http://localhost:3000`
- **Production**: `https://records-bay.vercel.app`

## Authentication

Currently, the API does not require authentication. All endpoints are publicly accessible.

## API Endpoints

### Validation Endpoints

#### GET `/api/validation/bulk/progress`

Get the current validation progress status.

**Response:**
```json
{
  "status": "not_running" | "running" | "paused" | "completed" | "error",
  "totalResources": 807575,
  "processedResources": 42000,
  "validResources": 39800,
  "errorResources": 2200,
  "currentResourceType": "Patient",
  "nextResourceType": "Observation",
  "startTime": "2025-01-16T14:00:00.000Z",
  "estimatedTimeRemaining": 1800,
  "isComplete": false,
  "errors": ["Validation error 1", "Validation error 2"]
}
```

#### POST `/api/validation/start`

Start a new validation process.

**Response:**
```json
{
  "success": true,
  "message": "Validation started successfully"
}
```

#### POST `/api/validation/stop`

Stop the current validation process.

**Response:**
```json
{
  "success": true,
  "message": "Validation stopped"
}
```

#### GET `/api/validation/errors/recent`

Get recent validation errors.

**Response:**
```json
[
  {
    "id": "error-1",
    "resourceType": "Patient",
    "resourceId": "patient-123",
    "error": "Missing required field: name",
    "timestamp": "2025-01-16T14:00:00.000Z"
  }
]
```

### Real-time Updates

#### GET `/api/validation/stream` (Server-Sent Events)

Establish a Server-Sent Events (SSE) connection for real-time validation updates.

**Headers:**
- `Accept: text/event-stream`
- `Cache-Control: no-cache`

**Event Types:**
- `connected`: Initial connection confirmation
- `validation-progress`: Progress updates
- `validation-started`: Validation process started
- `validation-completed`: Validation process completed
- `validation-stopped`: Validation process stopped
- `validation-error`: Validation error occurred

**Example Event:**
```
data: {"type": "validation-progress", "data": {"totalResources": 807575, "processedResources": 42000, "validResources": 39800, "errorResources": 2200, "isComplete": false}}

```

**Usage Example (JavaScript):**
```javascript
const eventSource = new EventSource('/api/validation/stream');

eventSource.onmessage = (event) => {
  const message = JSON.parse(event.data);
  console.log('Received:', message);
};

eventSource.onerror = (error) => {
  console.error('SSE connection error:', error);
};
```

### FHIR Server Endpoints

#### GET `/api/fhir/servers`

Get list of configured FHIR servers.

**Response:**
```json
[
  {
    "id": 1,
    "name": "Fire.ly Server",
    "url": "http://hapi.fhir.org/baseR4",
    "version": "4.0.1",
    "isActive": true
  }
]
```

#### GET `/api/fhir/connection/test`

Test connection to the active FHIR server.

**Response:**
```json
{
  "connected": true,
  "version": "4.0.1",
  "serverInfo": {
    "name": "HAPI FHIR Server",
    "version": "6.8.0"
  }
}
```

#### GET `/api/fhir/resource-counts`

Get resource counts for all resource types on the active FHIR server.

**Response:**
```json
{
  "Patient": 125000,
  "Observation": 450000,
  "Encounter": 89000,
  "Medication": 15000
}
```

#### GET `/api/fhir/version`

Get FHIR version information.

**Response:**
```json
{
  "version": "4.0.1",
  "release": "R4",
  "fhirVersion": "4.0.1"
}
```

### Dashboard Endpoints

#### GET `/api/dashboard/stats`

Get overall dashboard statistics.

**Response:**
```json
{
  "totalResources": 807575,
  "validatedResources": 42000,
  "validationProgress": 5.2,
  "lastValidation": "2025-01-16T14:00:00.000Z"
}
```

#### GET `/api/dashboard/fhir-server-stats`

Get FHIR server statistics.

**Response:**
```json
{
  "serverName": "Fire.ly Server",
  "serverUrl": "http://hapi.fhir.org/baseR4",
  "version": "4.0.1",
  "totalResources": 807575,
  "resourceTypes": 146,
  "lastUpdated": "2025-01-16T14:00:00.000Z"
}
```

#### GET `/api/dashboard/validation-stats`

Get validation statistics.

**Response:**
```json
{
  "totalValidations": 42000,
  "successfulValidations": 39800,
  "failedValidations": 2200,
  "successRate": 94.8,
  "averageValidationTime": 0.5,
  "resourceTypeBreakdown": {
    "Patient": {
      "total": 10000,
      "valid": 9500,
      "errors": 500,
      "successRate": 95.0
    }
  }
}
```

#### GET `/api/dashboard/combined`

Get combined dashboard data.

**Response:**
```json
{
  "fhirServerStats": { /* FHIR server stats */ },
  "validationStats": { /* Validation stats */ },
  "resourceCounts": { /* Resource counts */ },
  "fhirVersionInfo": { /* FHIR version info */ }
}
```

#### GET `/api/dashboard/fhir-version-info`

Get FHIR version information for dashboard.

**Response:**
```json
{
  "version": "4.0.1",
  "release": "R4",
  "supportedResourceTypes": 143,
  "priorityResourceTypes": ["Patient", "Observation", "Encounter"]
}
```

#### GET `/api/dashboard/cards`

Get dashboard card data.

**Response:**
```json
{
  "serverStats": { /* Server statistics */ },
  "validationStats": { /* Validation statistics */ },
  "resourceBreakdown": { /* Resource breakdown */ },
  "validationTrends": { /* Validation trends */ }
}
```

## Error Responses

All endpoints may return error responses in the following format:

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "timestamp": "2025-01-16T14:00:00.000Z"
}
```

**Common HTTP Status Codes:**
- `200 OK`: Request successful
- `400 Bad Request`: Invalid request parameters
- `404 Not Found`: Resource not found
- `500 Internal Server Error`: Server error

## Rate Limiting

Currently, there are no rate limits implemented. However, it's recommended to:
- Use reasonable polling intervals (2+ seconds) for progress endpoints
- Implement exponential backoff for retry logic
- Use Server-Sent Events for real-time updates instead of frequent polling

## CORS

The API supports Cross-Origin Resource Sharing (CORS) with the following configuration:
- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS`
- `Access-Control-Allow-Headers: Content-Type, Authorization`

## WebSocket vs Server-Sent Events

**Note**: The platform has migrated from WebSocket to Server-Sent Events (SSE) for real-time updates. SSE provides better reliability and compatibility, especially in serverless environments like Vercel.

**Benefits of SSE:**
- Better browser compatibility
- Automatic reconnection handling
- Works through firewalls and proxies
- More reliable in serverless environments
- Simpler implementation and debugging

**Migration Guide:**
- Replace WebSocket connections with EventSource
- Use `/api/validation/stream` endpoint for real-time updates
- Handle SSE events instead of WebSocket messages
- Implement proper error handling and reconnection logic

## Examples

### Starting Validation with Real-time Updates

```javascript
// Start validation
const startResponse = await fetch('/api/validation/start', {
  method: 'POST'
});

// Connect to SSE stream for real-time updates
const eventSource = new EventSource('/api/validation/stream');

eventSource.onmessage = (event) => {
  const message = JSON.parse(event.data);
  
  switch (message.type) {
    case 'validation-progress':
      updateProgressBar(message.data);
      break;
    case 'validation-completed':
      showCompletionMessage();
      eventSource.close();
      break;
    case 'validation-error':
      showErrorMessage(message.data);
      break;
  }
};
```

### Getting Dashboard Data

```javascript
// Get combined dashboard data
const dashboardData = await fetch('/api/dashboard/combined')
  .then(response => response.json());

console.log('FHIR Server:', dashboardData.fhirServerStats);
console.log('Validation Stats:', dashboardData.validationStats);
console.log('Resource Counts:', dashboardData.resourceCounts);
```

## Support

For API support and questions, please refer to the main project documentation or create an issue in the project repository.
