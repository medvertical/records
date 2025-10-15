# Gender Validation Fix - Restart Required

## Issue
The warning "Code male not found in ValueSet" for the administrative-gender field is a false positive.

## Root Cause
The TerminologyServerManager was using URLSearchParams which double-encodes URL parameters, causing HTTP 422 errors from the terminology server.

## Fix Applied
Fixed URL encoding by manually building the query string:
```typescript
const queryString = `code=${encodeURIComponent(code)}&system=${encodeURIComponent(system)}&url=${encodeURIComponent(vsUrl)}`;
```

## Files Modified
1. `server/services/validation/terminology/terminology-server-manager.ts` - Fixed URL encoding
2. `server/services/validation/terminology/terminology-adapter.ts` - Re-enabled TerminologyServerManager
3. `server/services/validation/engine/terminology-validator.ts` - Added system inference

## ⚠️ RESTART REQUIRED

The code changes won't take effect until you restart the development server:

### Option 1: Restart in terminal
```bash
# Stop the current server (Ctrl+C in the terminal where start-dev.sh is running)
# Then restart:
./start-dev.sh
```

### Option 2: Use npm scripts
```bash
# Stop all processes
pkill -f "tsx watch"
pkill -f "node.*concurrently"

# Restart
npm run dev
```

### Option 3: Fresh start
```bash
# Stop everything
pkill -f "tsx"
pkill -f "vite"

# Start fresh
./start-dev.sh
```

## After Restart

1. **Navigate to the Patient resource:**
   ```
   http://localhost:5174/resources/Patient/8eab4236-f837-49f3-a7ec-cd318f31179a
   ```

2. **Hard refresh your browser:**
   - Mac: Cmd+Shift+R
   - Windows/Linux: Ctrl+Shift+R

3. **Verify the warning is gone:**
   - The "Code male not found in ValueSet" warning should no longer appear
   - Terminology validation should show as valid

## Expected Result

✅ No warnings for valid codes like "male" in administrative-gender  
✅ Terminology validation completes successfully  
✅ Response time < 1 second (with caching)  

## Verification

Test the fix with a new validation:
```bash
curl -s "http://localhost:3000/api/validation/validate-resource-detailed" \
  -H "Content-Type: application/json" \
  -d '{"resourceType": "Patient", "resource": {"resourceType": "Patient", "id": "test", "gender": "male", "name": [{"family": "Test"}]}}' \
  | jq '.data.aspects[] | select(.aspect == "terminology")'
```

Should return:
```json
{
  "aspect": "terminology",
  "isValid": true,
  "issues": [],
  "validationTime": 300,
  "status": "executed"
}
```

---

**Note:** If the issue persists after restart, there may be cached validation results in the database. In that case, we can invalidate the cache for specific resources.

