# Validation Pipeline Operations Guide

## Overview

The Validation Pipeline is the central orchestrator for FHIR resource validation in the Records platform. It replaces the legacy RobustValidationService and BulkValidationService with a unified, event-driven architecture.

## Architecture

### Core Components

- **ValidationPipeline**: Main orchestrator service (`server/services/validation/validation-pipeline.ts`)
- **RockSolidValidationEngine**: Default 6-layer validation engine
- **UnifiedValidationService**: Adapter layer for backward compatibility
- **Server-Sent Events (SSE)**: Real-time progress updates

### Validation Layers

The Rock Solid validation engine performs 6-layer validation:

1. **Structural Validation**: JSON schema and FHIR structure compliance
2. **Profile Validation**: Conformance to specific FHIR profiles
3. **Terminology Validation**: Code system and value set validation
4. **Reference Validation**: Resource reference integrity checking
5. **Business Rule Validation**: Cross-field logic and business constraints
6. **Metadata Validation**: Version, timestamp, and metadata compliance

## Batch Validation Operations

### Starting Batch Validation

```bash
POST /api/validation/bulk/start
Content-Type: application/json

{
  "resourceTypes": ["Patient", "Observation"], // Optional: specific types
  "batchSize": 100,                           // Optional: default 100
  "skipUnchanged": false                      // Optional: default false
}
```

### Monitoring Progress

**Real-time Updates via SSE:**
```javascript
const eventSource = new EventSource('/api/validation/stream');
eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === 'validation-progress') {
    console.log(`Progress: ${data.data.progress}%`);
    console.log(`Processed: ${data.data.processedResources}/${data.data.totalResources}`);
  }
};
```

**Polling Progress:**
```bash
GET /api/validation/bulk/progress
```

Response includes:
- `progress`: Numeric percentage (0-100)
- `processedResources`: Number of resources processed
- `totalResources`: Total resources to validate
- `validResources`: Count of valid resources
- `errorResources`: Count of resources with errors
- `status`: Current validation status

### Control Operations

**Pause Validation:**
```bash
POST /api/validation/bulk/pause
```

**Resume Validation:**
```bash
POST /api/validation/bulk/resume
```

**Stop Validation:**
```bash
POST /api/validation/bulk/stop
```

## Configuration

### Validation Settings

The pipeline respects settings from the ValidationSettingsService:

- `maxConcurrentValidations`: Parallel processing limit
- `timeoutSettings`: Per-aspect timeout configuration
- `cacheSettings`: Result caching configuration
- `terminologyServers`: Terminology validation servers
- `profileResolutionServers`: Profile resolution servers

### Performance Tuning

**Concurrency Control:**
- Default: 8 concurrent validations
- Adjust via `maxConcurrentValidations` setting
- Higher values increase throughput but may overwhelm target servers

**Batch Size:**
- Default: 100 resources per batch
- Larger batches reduce overhead but increase memory usage
- Smaller batches provide more granular progress updates

**Caching:**
- Results cached with TTL based on `cacheSettings`
- Reduces redundant validation of unchanged resources
- Cache invalidation on settings changes

## Error Handling

### Canonical Error Format

All endpoints return errors in a consistent format:

```json
{
  "success": false,
  "message": "Human-readable error message",
  "error": "ERROR_CODE",
  "details": "Technical details",
  "timestamp": "2025-01-XX..."
}
```

### Common Error Codes

- `BULK_START_FAILED`: Failed to start batch validation
- `BULK_PROGRESS_FAILED`: Failed to fetch progress
- `BULK_PAUSE_FAILED`: Failed to pause validation
- `BULK_RESUME_FAILED`: Failed to resume validation
- `BULK_STOP_FAILED`: Failed to stop validation

## Monitoring and Observability

### Event Types

The pipeline emits the following events:

- `pipelineProgress`: Progress updates during batch validation
- `pipelineCompleted`: Batch validation completed successfully
- `pipelineFailed`: Batch validation failed with error
- `pipelineCancelled`: Batch validation was cancelled

### Logging

All operations are logged with structured data:
- Service: `validation-pipeline`
- Operation: `executePipeline`, `pause`, `resume`, `stop`
- Context: Resource counts, timing, error details

## Migration from Legacy Services

### Deprecated Services

The following services have been removed:
- `RobustValidationService` (replaced by ValidationPipeline)
- `BulkValidationService` (replaced by ValidationPipeline batch mode)
- `EnhancedValidationEngine` (replaced by RockSolidValidationEngine)

### Backward Compatibility

The `UnifiedValidationService` provides backward compatibility:
- Maps legacy API calls to ValidationPipeline
- Preserves existing response formats
- Includes deprecation warnings in logs

## Troubleshooting

### Common Issues

**Validation Stuck:**
- Check server connectivity
- Verify resource access permissions
- Review timeout settings

**Memory Issues:**
- Reduce batch size
- Lower concurrent validation limit
- Enable result caching

**Performance Issues:**
- Increase concurrent validation limit
- Optimize terminology server configuration
- Review profile resolution server settings

### Debug Mode

Enable debug logging by setting:
```bash
LOG_LEVEL=debug
```

This provides detailed information about:
- Validation progress
- Engine configuration
- Performance metrics
- Error details
