# Auto-Revalidation on Version Change

## Overview

This feature enables automatic detection and revalidation of FHIR resources when their `versionId` changes in list views, providing intelligent, real-time validation updates without manual intervention.

## Features

### 1. Smart Version Change Detection

The system uses a hash-based approach to detect when resources have changed:

- **Resource Hash**: Generated from `resourceType`, `id`, `meta.versionId`, `meta.lastUpdated`, and `meta.profile`
- **Automatic Invalidation**: When the hash changes, cached validation results are automatically invalidated
- **Backend Detection**: Implemented in `server/utils/validation-cache-manager.ts`

### 2. Configurable List View Polling

New validation settings allow users to control auto-revalidation behavior:

| Setting | Type | Default | Range | Description |
|---------|------|---------|-------|-------------|
| `autoRevalidateOnVersionChange` | boolean | `true` | - | Enable/disable automatic revalidation when `versionId` changes |
| `listViewPollingInterval` | number | `30000` | 10000-300000 | Polling interval in milliseconds (10s-5min) |

### 3. Frontend Version Tracking

**New Hook**: `useResourceVersionTracker` (`client/src/hooks/use-resource-version-tracker.ts`)

- Tracks `versionId` for each resource in the list
- Compares current data with cached data on each refetch
- Emits change events when `versionId` differs
- Automatically resets when navigating between pages or changing filters

### 4. Automatic Revalidation Workflow

1. **Polling**: List view polls FHIR server every N seconds (configurable)
2. **Detection**: Version tracker compares `versionId` of each resource
3. **Batching**: Changed resources are collected and enqueued together
4. **Priority**: Auto-revalidation uses "high" priority queue
5. **Notification**: Subtle toast shows number of resources queued
6. **Refresh**: Results are automatically refetched after 3 seconds

### 5. Performance Optimizations

- **Background Polling Disabled**: Only polls when browser tab is visible
- **Batch Processing**: Multiple changed resources are enqueued in parallel
- **Debouncing**: Version tracker resets on page/filter changes to prevent false positives
- **First Mount Skip**: Initial load doesn't trigger change detection
- **Intelligent Caching**: Results cached for 2 minutes in non-filtered views

## Implementation Details

### Database Schema Changes

**Migration**: `migrations/025_add_auto_revalidation_settings.sql`

```sql
ALTER TABLE validation_settings 
ADD COLUMN auto_revalidate_after_edit BOOLEAN DEFAULT false,
ADD COLUMN auto_revalidate_on_version_change BOOLEAN DEFAULT true,
ADD COLUMN list_view_polling_interval INTEGER DEFAULT 30000;
```

### Key Files Modified

1. **Schema & Types**
   - `shared/schema.ts` - Database schema
   - `shared/validation-settings.ts` - TypeScript types and defaults

2. **Frontend**
   - `client/src/hooks/use-resource-version-tracker.ts` - New hook for version tracking
   - `client/src/pages/resource-browser.tsx` - Polling and auto-revalidation integration

3. **Backend**
   - `server/routes/api/validation/validation-settings.ts` - API endpoint updates
   - `server/services/validation/settings/validation-settings-service.ts` - Service layer updates
   - `server/repositories/validation-settings-repository.ts` - Database layer updates

### API Changes

#### GET /api/validation/settings

**Response** (new fields):
```json
{
  "autoRevalidateOnVersionChange": true,
  "listViewPollingInterval": 30000,
  ...
}
```

#### PUT /api/validation/settings

**Request** (new fields):
```json
{
  "autoRevalidateOnVersionChange": false,
  "listViewPollingInterval": 60000
}
```

## User Experience

### Default Behavior

- **Auto-revalidation**: Enabled by default (`autoRevalidateOnVersionChange: true`)
- **Polling interval**: 30 seconds
- **User feedback**: Subtle toast notification when resources are queued
- **No disruption**: Existing view remains stable while revalidation happens in background

### Console Logging

When version changes are detected:
```
[ResourceBrowser] Detected 2 resource(s) with version changes: 
  Patient/123 (v2), Observation/456 (v3)
```

### Toast Notifications

When auto-revalidation is triggered:
```
Auto-Revalidation
2 resources queued for validation due to version changes
```

## Configuration

Users can configure auto-revalidation behavior through the validation settings UI (future enhancement) or API:

```bash
# Disable auto-revalidation
curl -X PUT http://localhost:5000/api/validation/settings \
  -H "Content-Type: application/json" \
  -d '{"autoRevalidateOnVersionChange": false}'

# Increase polling interval to 2 minutes
curl -X PUT http://localhost:5000/api/validation/settings \
  -H "Content-Type: application/json" \
  -d '{"listViewPollingInterval": 120000}'
```

## Comparison with Detail View

| Feature | List View | Detail View |
|---------|-----------|-------------|
| Polling | Configurable (default: 30s) | Fixed (30s) |
| Auto-revalidation | Configurable (default: on) | Always on |
| Detection | `versionId` comparison | `versionId` comparison |
| Priority | High | High |
| User Control | Full control via settings | No control |

## Future Enhancements

1. **UI Controls**: Add settings panel to validation settings page
2. **Per-Resource-Type Configuration**: Different polling intervals for different resource types
3. **Manual Refresh Button**: Allow users to manually trigger version check
4. **Activity Indicator**: Show polling status in UI
5. **Polling Statistics**: Track and display polling efficiency metrics

## Technical Notes

### Version Tracking Algorithm

The version tracker uses a two-step approach:

1. **Initialization**: On first mount, populate the `previousVersionsMap` without triggering changes
2. **Comparison**: On subsequent refetches, compare current `versionId` with previous `versionId`
3. **Reset**: When page/filters change, clear the map and re-initialize

### Edge Cases Handled

- **New resources**: Ignored (not considered a "change")
- **Removed resources**: Cleaned up automatically when out of view
- **Tab visibility**: Polling pauses when tab is hidden
- **Network failures**: Existing data remains visible, no error thrown
- **Rapid changes**: Batched automatically, only one enqueue per resource

### Performance Impact

- **Network**: 1 additional request every 30s (configurable)
- **CPU**: Minimal (simple `Map` comparison)
- **Memory**: Negligible (~100 bytes per resource for version tracking)
- **User Experience**: No blocking, no UI jank

## Related Documentation

- [Validation Settings](../core/VALIDATION_SETTINGS.md)
- [Validation Cache Manager](../technical/VALIDATION_CACHE_MANAGER.md)
- [Resource Browser](../components/RESOURCE_BROWSER.md)

