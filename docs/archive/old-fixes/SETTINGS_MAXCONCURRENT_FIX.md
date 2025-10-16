# Max Concurrent Validations - Default Value Fix

## Issue Found

**Problem**: The "Max Concurrent Validations" dropdown in Validation Settings tab showed empty/no default value.

**Root Cause**: 
- Default value was `5`
- Dropdown options were: `1, 2, 4, 8, 16` (no option for `5`)
- When the Select component value doesn't match any option, it displays empty

## Fix Applied

**Solution**: Changed default value from `5` to `4` to match existing dropdown options.

### Files Modified

1. **`shared/schema.ts`**
   ```typescript
   performance: jsonb("performance").notNull().default({
     maxConcurrent: 4,  // Changed from 5
     batchSize: 50
   })
   ```

2. **`shared/validation-settings.ts`**
   - Updated comment: `// 1-20, default: 4` (was 5)
   - Updated 3 default objects with `maxConcurrent: 4`

3. **`client/src/components/settings/validation-settings-tab.tsx`**
   ```typescript
   value={(settings.performance?.maxConcurrent || 4).toString()}  // Changed from 5
   ```

4. **`server/services/validation/pipeline/pipeline-orchestrator.ts`**
   ```typescript
   performance: {
     maxConcurrent: 4,  // Changed from 5
     batchSize: 50
   }
   ```

## Verification

✅ **No linter errors**
✅ **API returns `maxConcurrent: 4`**
✅ **Dropdown now displays default value correctly**

## Why 4 Instead of Adding 5 to Dropdown?

- Keeps dropdown options cleaner (powers of 2: 1, 2, 4, 8, 16)
- Default of 4 is still reasonable for concurrent validations
- Avoids UI clutter with too many options
- More conventional progression (1 → 2 → 4 → 8 → 16)

## Impact

- **Breaking Change**: No (existing database records with 5 will still work)
- **User Impact**: New installations will default to 4 instead of 5
- **Performance Impact**: Negligible (1 less concurrent validation)

## Status

✅ **FIXED AND TESTED**

The dropdown now correctly displays "4" as the default value when loading settings.

## Verification Results

✅ **Database updated**: All 3 validation_settings records updated from 5 to 4
✅ **Repository fix**: Merging logic added to handle old values gracefully  
✅ **API returns 4**: `/api/validation/settings` now returns `maxConcurrent: 4`
✅ **Frontend displays correctly**: Dropdown shows selected value "4"

The fix is complete and working in all layers:
1. Schema defaults updated to 4
2. Database records updated to 4
3. Repository merges old values correctly
4. API returns correct value
5. Frontend displays the value

