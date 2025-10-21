# Settings Testing Guide

## Prerequisites

1. Start the development server
2. Navigate to Settings page in the application

## Test 1: System Settings

### Load Test
1. Navigate to Settings → System tab
2. Verify all fields load correctly:
   - ✅ Theme selector (Light/Dark/System)
   - ✅ Log Level dropdown (Error/Warn/Info/Debug)
   - ✅ Max Log File Size input
   - ✅ Telemetry toggle
   - ✅ Crash Reporting toggle
   - ✅ Data Retention Days input
   - ✅ SSE toggle
   - ✅ Auto-Updates toggle

### Verify Removed Fields
- ❌ Card Layout selector (should NOT be present)
- ❌ Error Stack Trace toggle (should NOT be present)
- ❌ Experimental Features toggle (should NOT be present)
- ❌ Advanced section with Debug Mode (should NOT be present)

### Verify No Individual Save Button
- ❌ Should NOT have a "Save Settings" button in System Settings tab
- ✅ Should use parent settings page save button (if present) OR auto-save

### Save & Persistence Test
1. Change Theme to "Dark"
2. Change Log Level to "Debug"
3. Set Max Log File Size to 200
4. Toggle Telemetry ON
5. Set Data Retention to 60 days
6. Use parent save button (if available) OR navigate away (auto-save)
7. Refresh the page (F5)
8. Verify all changes persisted

### API Test
Open browser DevTools → Network tab:
- Verify `GET /api/system-settings` returns nested structure
- Verify `PUT /api/system-settings` sends nested structure
- Check Response format matches:
  ```json
  {
    "theme": "dark",
    "logging": {
      "level": "debug",
      "maxFileSize": 200
    },
    "privacy": {
      "telemetry": true,
      "crashReporting": true
    },
    "dataRetentionDays": 60,
    "features": {
      "sse": true,
      "autoUpdate": true
    }
  }
  ```

---

## Test 2: Dashboard Settings

### Load Test
1. Navigate to Settings → Dashboard tab
2. Verify all fields load correctly:
   - ✅ Auto Refresh toggle
   - ✅ Refresh Interval slider
   - ✅ Dashboard Components checkboxes
   - ✅ Auto-Validate toggle
   - ✅ Polling Enabled toggle
   - ✅ Fast Interval input
   - ✅ Slow Interval input
   - ✅ Pause when hidden toggle

### Advanced Polling Test
1. Ensure Polling is Enabled
2. Expand "Advanced Polling Options" accordion
3. Verify new fields are present:
   - ✅ Very Slow Interval (ms)
   - ✅ Max Retries
   - ✅ Backoff Multiplier
   - ✅ Enable Jitter toggle

### Verify No Individual Save Button
- ❌ Should NOT have a "Save Settings" button in Dashboard Settings tab
- ✅ Should use parent settings page save button (if present)

### Modify & Persistence Test
1. Toggle Auto Refresh OFF
2. Change Refresh Interval to 60
3. Uncheck "Show Performance Metrics"
4. Set Fast Interval to 3000
5. Set Slow Interval to 20000
6. Expand Advanced Polling Options:
   - Set Very Slow Interval to 90000
   - Set Max Retries to 5
   - Set Backoff Multiplier to 2.5
   - Toggle Enable Jitter OFF
7. Use parent save button (if available) OR navigate away and back
8. Refresh the page (F5)
9. Verify all changes persisted including advanced polling settings

### API Test
Open browser DevTools → Network tab:
- Verify `GET /api/dashboard-settings` returns all fields
- Check Response includes new polling fields:
  ```json
  {
    "autoRefresh": false,
    "refreshInterval": 60,
    "polling": {
      "enabled": true,
      "fastIntervalMs": 3000,
      "slowIntervalMs": 20000,
      "verySlowIntervalMs": 90000,
      "maxRetries": 5,
      "backoffMultiplier": 2.5,
      "jitterEnabled": false,
      "pauseOnHidden": true
    }
  }
  ```

---

## Test 3: Validation Settings

### Load Test
1. Navigate to Settings → Validation tab
2. Verify already working (no changes made)
3. Verify Save Settings button is present

### Quick Verification
1. Change any validation aspect (e.g., toggle Profile validation)
2. Click Save Settings
3. Verify success toast
4. Refresh page
5. Verify change persisted

---

## Test 4: Integration Test

### Cross-Tab Consistency
1. Change settings in System tab → Save
2. Change settings in Dashboard tab → Save (parent button)
3. Change settings in Validation tab → Save
4. Refresh entire application
5. Verify all three categories retained their changes

### Error Handling
1. Stop the backend server
2. Try to load settings → Should show error toast
3. Try to save settings → Should show error toast
4. Restart backend server
5. Reload settings → Should work again

---

## Test 5: Database Verification (Optional)

If you have database access:

### System Settings Table
```sql
SELECT * FROM system_settings ORDER BY updated_at DESC LIMIT 1;
```

Verify the `settings` JSONB column has nested structure:
```json
{
  "theme": "dark",
  "logging": {...},
  "privacy": {...},
  "features": {...},
  "dataRetentionDays": 60
}
```

### Dashboard Settings Table
```sql
SELECT * FROM dashboard_settings ORDER BY updated_at DESC LIMIT 1;
```

Verify the `settings` JSONB column includes advanced polling:
```json
{
  "polling": {
    "verySlowIntervalMs": 90000,
    "maxRetries": 5,
    "backoffMultiplier": 2.5,
    "jitterEnabled": false
  }
}
```

---

## Expected Results

### ✅ All tests pass
- Settings load correctly
- All removed fields are gone
- All new fields are present
- Save functionality works
- Changes persist after refresh
- No console errors
- No linter errors
- Proper TypeScript types

### ❌ Failure Indicators
- Console errors when loading settings
- Settings don't persist after refresh
- 404 or 500 errors in Network tab
- TypeScript errors in browser console
- Missing fields in UI
- Extra fields that should be removed

---

## Troubleshooting

### Settings don't load
- Check backend is running
- Check Network tab for API errors
- Check browser console for errors
- Verify database tables exist

### Settings don't save
- Check Network tab for PUT request
- Verify request payload format
- Check backend logs for errors
- Verify database write permissions

### Changes don't persist
- Check if PUT request succeeded
- Verify GET request returns updated data
- Clear browser cache and retry
- Check database for updated timestamp

---

## Sign-off Checklist

- [ ] System Settings: All fields work ✓
- [ ] System Settings: Removed fields gone ✓
- [ ] System Settings: Save button works ✓
- [ ] Dashboard Settings: All fields work ✓
- [ ] Dashboard Settings: Advanced polling visible ✓
- [ ] Dashboard Settings: No individual save button ✓
- [ ] Validation Settings: Still works ✓
- [ ] All settings persist after refresh ✓
- [ ] No console errors ✓
- [ ] No TypeScript errors ✓
- [ ] API endpoints work correctly ✓

**Once all items are checked, the implementation is complete!** ✅

