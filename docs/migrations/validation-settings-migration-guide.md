# Validation Settings Migration Guide

## Overview

This guide helps users migrate from the complex validation settings system to the new simplified validation settings interface. The migration focuses on essential functionality while removing complexity.

## What Changed

### Removed Features
- **Complex Presets**: Multiple preset configurations have been removed
- **Audit Trails**: Version history and audit logging are no longer available
- **Advanced Validation Rules**: Complex custom validation rules are not supported
- **Real-time Synchronization**: Server-Sent Events (SSE) and WebSocket connections are removed
- **Backup/Restore**: Manual backup and restore functionality is no longer available

### Simplified Features
- **6 Core Validation Aspects**: Only essential validation aspects are supported
- **Basic Performance Settings**: Simple concurrent and batch size configuration
- **Resource Type Filtering**: Basic include/exclude resource type filtering
- **FHIR Version Migration**: Automatic migration between FHIR R4 and R5

## Migration Process

### Automatic Migration

The system automatically migrates existing settings when you first access the new interface:

1. **Settings Detection**: The system detects existing complex settings
2. **Compatibility Check**: Validates which features can be migrated
3. **Migration Execution**: Converts settings to simplified format
4. **Validation**: Ensures migrated settings are valid
5. **Fallback**: Resets to defaults if migration fails

### Manual Migration Steps

If automatic migration fails or you want to review the process:

1. **Backup Current Settings**
   ```bash
   # Export current settings (if available)
   curl -X GET http://localhost:3000/api/validation/settings/export?serverId=1
   ```

2. **Review Migration Impact**
   - Check which settings will be preserved
   - Identify settings that will be removed
   - Plan for any functionality gaps

3. **Execute Migration**
   ```bash
   # Trigger manual migration
   curl -X POST http://localhost:3000/api/validation/settings/migrate \
     -H "Content-Type: application/json" \
     -d '{"serverId": 1, "fromVersion": "complex", "toVersion": "simplified"}'
   ```

4. **Verify Results**
   - Test validation functionality
   - Check that essential settings are preserved
   - Verify performance settings are appropriate

## Settings Mapping

### Validation Aspects

| Old Complex Setting | New Simplified Setting | Migration Notes |
|-------------------|----------------------|-----------------|
| `structural.enabled` | `aspects.structural.enabled` | Direct mapping |
| `structural.severity` | `aspects.structural.severity` | Direct mapping |
| `profile.enabled` | `aspects.profile.enabled` | Direct mapping |
| `profile.severity` | `aspects.profile.severity` | Direct mapping |
| `terminology.enabled` | `aspects.terminology.enabled` | Direct mapping |
| `terminology.severity` | `aspects.terminology.severity` | Direct mapping |
| `reference.enabled` | `aspects.reference.enabled` | Direct mapping |
| `reference.severity` | `aspects.reference.severity` | Direct mapping |
| `businessRules.enabled` | `aspects.businessRules.enabled` | Direct mapping |
| `businessRules.severity` | `aspects.businessRules.severity` | Direct mapping |
| `metadata.enabled` | `aspects.metadata.enabled` | Direct mapping |
| `metadata.severity` | `aspects.metadata.severity` | Direct mapping |

### Performance Settings

| Old Complex Setting | New Simplified Setting | Migration Notes |
|-------------------|----------------------|-----------------|
| `performance.maxConcurrent` | `performance.maxConcurrent` | Direct mapping, clamped to 1-20 |
| `performance.batchSize` | `performance.batchSize` | Direct mapping, clamped to 10-100 |
| `performance.timeout` | *Removed* | Timeout settings are no longer configurable |
| `performance.retryAttempts` | *Removed* | Retry logic is handled automatically |
| `performance.cacheSize` | *Removed* | Cache management is automatic |

### Resource Type Filtering

| Old Complex Setting | New Simplified Setting | Migration Notes |
|-------------------|----------------------|-----------------|
| `resourceTypes.enabled` | `resourceTypes.enabled` | Direct mapping |
| `resourceTypes.included` | `resourceTypes.includedTypes` | Array format preserved |
| `resourceTypes.excluded` | `resourceTypes.excludedTypes` | Array format preserved |
| `resourceTypes.priority` | *Removed* | Priority-based filtering is no longer supported |
| `resourceTypes.conditions` | *Removed* | Conditional filtering is no longer supported |

### Removed Settings

The following settings are no longer supported and will be removed during migration:

- **Preset Configurations**: All preset-related settings
- **Audit Trail**: Version history and change tracking
- **Advanced Validation Rules**: Custom business logic rules
- **Real-time Features**: SSE/WebSocket configuration
- **Backup Settings**: Manual backup and restore configuration
- **Complex Filtering**: Advanced resource type filtering conditions
- **Performance Tuning**: Advanced performance optimization settings

## FHIR Version Migration

### R4 to R5 Migration

When migrating between FHIR versions, the system automatically adapts resource types:

1. **Version Detection**: Automatically detects FHIR server version
2. **Resource Type Validation**: Validates selected resource types against new version
3. **Automatic Adaptation**: Adds/removes resource types as needed
4. **Settings Update**: Updates settings to reflect new version

#### Resource Type Changes

**R4 to R5 Additions:**
- `DeviceMetric` - Device measurement data
- `Substance` - Chemical substances
- `TestScript` - Test automation scripts
- `ClinicalImpression` - Clinical assessment

**R4 to R5 Removals:**
- None (R5 is backward compatible)

#### Migration Example

```json
// Before (R4)
{
  "resourceTypes": {
    "enabled": true,
    "includedTypes": ["Patient", "Observation", "Encounter"],
    "excludedTypes": ["Binary"]
  }
}

// After (R5)
{
  "resourceTypes": {
    "enabled": true,
    "includedTypes": ["Patient", "Observation", "Encounter", "DeviceMetric"],
    "excludedTypes": ["Binary"]
  }
}
```

## Troubleshooting Migration

### Common Issues

1. **Migration Fails**
   - **Cause**: Invalid settings or database connection issues
   - **Solution**: Check database connectivity and settings validity
   - **Fallback**: Reset to default settings

2. **Settings Not Preserved**
   - **Cause**: Incompatible settings format
   - **Solution**: Review migration logs for specific issues
   - **Fallback**: Manually reconfigure essential settings

3. **Performance Degradation**
   - **Cause**: Inappropriate performance settings after migration
   - **Solution**: Adjust maxConcurrent and batchSize settings
   - **Fallback**: Use default performance settings

4. **Resource Types Not Available**
   - **Cause**: FHIR version mismatch
   - **Solution**: Verify FHIR server version and resource type availability
   - **Fallback**: Use default resource type selection

### Migration Logs

Check migration logs for detailed information:

```bash
# View migration logs
tail -f /var/log/records/migration.log

# Check specific server migration
grep "serverId:1" /var/log/records/migration.log
```

### Rollback Procedure

If migration causes issues, you can rollback:

1. **Stop the application**
   ```bash
   npm stop
   ```

2. **Restore database backup**
   ```bash
   pg_restore -d records backup_before_migration.sql
   ```

3. **Restart the application**
   ```bash
   npm start
   ```

## Post-Migration Checklist

After migration, verify the following:

### ✅ Settings Verification
- [ ] All 6 validation aspects are configured correctly
- [ ] Performance settings (maxConcurrent, batchSize) are appropriate
- [ ] Resource type filtering is working as expected
- [ ] FHIR version is detected correctly

### ✅ Functionality Testing
- [ ] Validation can be started and stopped
- [ ] Progress tracking is working
- [ ] Results are displayed correctly
- [ ] Settings changes are saved and applied

### ✅ Performance Testing
- [ ] Validation performance is acceptable
- [ ] Memory usage is within expected ranges
- [ ] API response times are reasonable
- [ ] No memory leaks or performance degradation

### ✅ Error Handling
- [ ] Network errors are handled gracefully
- [ ] Invalid settings are rejected with clear messages
- [ ] Migration warnings are displayed appropriately
- [ ] Fallback behavior works correctly

## Best Practices

### Settings Configuration

1. **Start with Defaults**: Begin with default settings and adjust as needed
2. **Test Incrementally**: Make small changes and test each one
3. **Monitor Performance**: Watch for performance impact of settings changes
4. **Document Changes**: Keep track of settings that work well for your use case

### Resource Type Selection

1. **Use Common Types**: Start with common resource types (Patient, Observation, Encounter)
2. **Exclude Problematic Types**: Exclude types that cause issues (Binary, OperationOutcome)
3. **Version Awareness**: Be aware of resource type differences between FHIR versions
4. **Performance Impact**: Consider the performance impact of validating many resource types

### Performance Tuning

1. **Start Conservative**: Begin with low maxConcurrent values (3-5)
2. **Monitor Resources**: Watch CPU and memory usage during validation
3. **Adjust Gradually**: Increase settings gradually while monitoring performance
4. **Batch Size**: Use appropriate batch sizes (50-100) for your server capacity

## Support

If you encounter issues during migration:

1. **Check Documentation**: Review this guide and API documentation
2. **Review Logs**: Check application and migration logs for errors
3. **Test Defaults**: Try resetting to default settings
4. **Contact Support**: Reach out to the development team for assistance

### Migration Support

For migration-specific support:
- **Email**: migration-support@records-platform.com
- **GitHub Issues**: Create an issue with migration label
- **Documentation**: Check the troubleshooting guide
- **Community**: Join the community forum for peer support

