# Quick Start: Auto-Revalidation on Version Change

## What's New?

Resources in list views now automatically revalidate when their `versionId` changes! 🎉

## How It Works

1. **Automatic Polling**: List view polls the FHIR server every 30 seconds
2. **Smart Detection**: Compares `versionId` of each resource
3. **Auto-Revalidation**: Changed resources are automatically queued for validation
4. **User Notification**: Subtle toast shows number of resources queued

## Try It Out

1. **Start the server**:
   ```bash
   npm run dev
   ```

2. **Open resource browser**: Navigate to any resource list view

3. **Edit a resource**: Change a resource on your FHIR server

4. **Watch the magic**: Within 30 seconds:
   - Version change is detected
   - Resource is auto-revalidated
   - Toast notification appears
   - Validation status updates

## Configuration (Optional)

### Via API:

```bash
# Disable auto-revalidation
curl -X PUT http://localhost:5000/api/validation/settings \
  -H "Content-Type: application/json" \
  -d '{"autoRevalidateOnVersionChange": false}'

# Change polling to 1 minute
curl -X PUT http://localhost:5000/api/validation/settings \
  -H "Content-Type: application/json" \
  -d '{"listViewPollingInterval": 60000}'
```

### Default Settings:

- **Auto-revalidation**: Enabled
- **Polling interval**: 30 seconds
- **Polling when hidden**: Disabled
- **Priority**: High

## Performance

- **Network**: +1 request per 30 seconds (minimal)
- **CPU**: Negligible (simple Map comparison)
- **Memory**: ~100 bytes per resource
- **UX**: No blocking, no jank ✨

## Console Logs

Watch for:
```
[ResourceBrowser] Detected 2 resource(s) with version changes: 
  Patient/123 (v2), Observation/456 (v3)
```

## Full Documentation

See `docs/features/AUTO_REVALIDATION_ON_VERSION_CHANGE.md` for complete details.

## Troubleshooting

**Q: Not seeing version changes detected?**
- Check Network tab for polling requests
- Verify `autoRevalidateOnVersionChange` is `true`
- Ensure resource's `versionId` actually changed

**Q: Polling too frequent/slow?**
- Adjust `listViewPollingInterval` via API (range: 10s - 5min)

**Q: Want to disable?**
- Set `autoRevalidateOnVersionChange` to `false` via API

---

**Status**: ✅ Ready to Use  
**Build**: ✅ Passing  
**Tests**: Awaiting manual verification

