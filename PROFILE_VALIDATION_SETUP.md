# Profile Validation Setup Complete

## Summary

Profile validation has been successfully configured to use validation settings, specifically the `profileSources` setting. The implementation is complete, but **Java 17 is required** for the HAPI FHIR Validator to function properly.

## What Was Fixed

1. ✅ **ProfileValidator now accepts ValidationSettings**: The validator receives and uses the `settings.profileSources` configuration
2. ✅ **Settings are passed through the validation chain**: ValidationEngine → ProfileValidator with full settings
3. ✅ **Profile resolution respects settings**: Uses 'local', 'simplifier', or 'both' based on configuration
4. ✅ **All meta.profile entries are validated**: When profile aspect is enabled, all profiles in `meta.profile` are automatically validated
5. ✅ **Java 17 installed**: OpenJDK 17 has been installed via Homebrew

## Critical Requirement: Java Setup

The HAPI FHIR Validator **requires Java 17** to be in the PATH. Java has been installed at:
```
/opt/homebrew/opt/openjdk@17/bin/java
```

### Starting the Development Server with Java

**Option 1: Start server with Java in PATH (Recommended)**
```bash
PATH="/opt/homebrew/opt/openjdk@17/bin:$PATH" npm run dev
```

**Option 2: Add Java to your shell profile permanently**
```bash
# Add to ~/.zshrc
echo 'export PATH="/opt/homebrew/opt/openjdk@17/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
npm run dev
```

**Option 3: Use the provided start script**
```bash
./start-dev.sh
```

## Validation Settings

The `profileSources` setting controls where profiles are resolved from:

- `'local'` - Use only locally cached profiles
- `'simplifier'` - Fetch profiles from Simplifier.net
- `'both'` - Use both local cache and Simplifier (default)

Set this via the API:
```bash
curl -X PUT "http://localhost:3000/api/validation/settings" \
  -H "Content-Type: application/json" \
  -d '{"profileSources": "both"}'
```

## Testing Profile Validation

Once the server is running with Java in the PATH:

```bash
# Test with a Patient resource that has US Core profile
curl -X POST "http://localhost:3000/api/validation/validate-resource-detailed" \
  -H "Content-Type: application/json" \
  -d '{
    "resource": {
      "resourceType": "Patient",
      "id": "test-patient",
      "meta": {
        "profile": ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient"]
      },
      "name": [{"family": "Test"}]
    }
  }' | jq '.data.issues'
```

You should now see validation messages for profile conformance issues!

## Files Modified

1. `server/services/validation/engine/profile-validator.ts` - Added `settings` parameter
2. `server/services/validation/core/validation-engine.ts` - Passes settings to ProfileValidator
3. `package.json` - Updated dev script to include Java in PATH
4. `start-dev.sh` - Created wrapper script for starting server with Java

## Troubleshooting

### No validation messages appearing

1. **Check Java is available**:
   ```bash
   java -version
   ```
   Should show: `openjdk version "17.0.16"`

2. **Check server logs for Java errors**:
   ```bash
   tail -f logs/combined*.log | grep -i "java\|hapi"
   ```

3. **Verify profile validation is enabled**:
   ```bash
   curl -s "http://localhost:3000/api/validation/settings" | jq '.aspects.profile'
   ```
   Should show: `{"enabled": true, "severity": "warning"}`

4. **Check profileSources setting**:
   ```bash
   curl -s "http://localhost:3000/api/validation/settings" | jq '.profileSources'
   ```
   Should show: `"both"` (or your configured value)

### HAPI validator errors

If you see "Unable to find/resolve/read -ig" errors, the FHIR packages may need to be downloaded. They are cached in `~/.fhir/packages/` and are downloaded automatically on first use.

## Next Steps

1. Start the server with Java in PATH using one of the options above
2. Set `profileSources` to your preferred value ('local', 'simplifier', or 'both')
3. Test validation with resources that have profiles in `meta.profile`
4. Validation messages will now appear for profile conformance issues!

