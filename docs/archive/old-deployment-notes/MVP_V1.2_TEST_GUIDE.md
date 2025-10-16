# MVP v1.2 - Manual Test Guide

**Test URL:** http://localhost:5174  
**API URL:** http://localhost:3000

---

## ✅ Test Checklist

### 1. FHIR Version Awareness

**Sidebar Test:**
- [ ] Navigate to http://localhost:5174
- [ ] Check sidebar - should show "Fire.ly Server" with **R4** badge (gray/secondary color)
- [ ] If multiple servers exist, switch between them
- [ ] Version badge should update automatically

**Expected:**
```
Fire.ly Server [R4]  ← Gray badge
HAPI FHIR Server [R4]  ← Gray badge
```

**Resource Detail Test:**
- [ ] Click on any resource in the list
- [ ] Check header - should show prominent "FHIR R4" badge
- [ ] Badge color: R4 = gray, R5 = blue, R6 = yellow + "Preview" badge

**Database Verification:**
```sql
SELECT id, name, fhir_version FROM fhir_servers;
-- Expected: All servers should have fhir_version populated
```

---

### 2. Hybrid Online/Offline Mode

**Settings Page Test:**
- [ ] Navigate to Settings → Validation Settings
- [ ] Find "Validation Mode" card
- [ ] Check current mode badge (Online = 🌐 blue / Offline = 📦 gray)
- [ ] Toggle switch between Online/Offline

**Offline Mode Configuration:**
- [ ] Switch to Offline mode
- [ ] Verify "Offline Mode Configuration" section appears
- [ ] Check fields:
  - [ ] Ontoserver URL (default: http://localhost:8081/fhir)
  - [ ] Profile Cache Path (default: /opt/fhir/igs/)
- [ ] Verify warning message about local Ontoserver requirement

**Terminology Server URLs:**
- [ ] Check both URL fields are editable:
  - Remote Server: https://tx.fhir.org/r4
  - Local Server: http://localhost:8081/fhir

**Database Verification:**
```sql
SELECT settings->'mode', settings->'terminologyFallback', settings->'offlineConfig' 
FROM validation_settings 
LIMIT 1;
```

---

### 3. Error Mapping Engine

**Validation Test:**
- [ ] Select a resource with validation errors
- [ ] Check validation messages panel
- [ ] Verify friendly German messages are displayed (not technical)

**Expected UI Features:**
- [ ] **"📖 Übersetzt" badge** on mapped messages
- [ ] **Hover tooltip** shows original technical message
- [ ] **"💡 Lösungsvorschläge"** section with bullet points
- [ ] **"🔧 Technische Details"** expandable section with:
  - Original message (font-mono)
  - Error code (badge)

**Example Error Mapping:**
```
Technical: "Unable to resolve reference to profile 'http://...'"
Friendly: "Das System kann die Validierungsregeln (Profil) für diese Ressource nicht finden..."
Suggestions:
  - Überprüfen Sie die Profil-URL auf Tippfehler.
  - Stellen Sie sicher, dass das erforderliche IG-Paket installiert ist.
```

**Error Map Configuration:**
- [ ] Check file exists: `server/config/error_map.json`
- [ ] Contains 15 German/English mappings

---

### 4. Auto-Revalidation After Edit

**Settings Test:**
- [ ] Navigate to Settings → Validation Settings
- [ ] Scroll to "Auto-Revalidation" section
- [ ] Toggle "Automatically revalidate resources after editing"
- [ ] Verify blue info alert appears when enabled

**Resource Editor Test:**
- [ ] Open any resource for editing
- [ ] Check "Automatically revalidate after save" checkbox (should be checked by default)
- [ ] Make a small change (e.g., modify a field)
- [ ] Click "Save Changes"

**Expected Behavior:**
- [ ] Save progress indicator appears
- [ ] "Validating changes..." message shows
- [ ] Validation completes automatically
- [ ] Resource detail updates with new validation results

**Backend Verification:**
```sql
-- Check edit was recorded with FHIR version
SELECT * FROM edit_audit_trail 
ORDER BY edited_at DESC 
LIMIT 5;

-- Check validation was triggered
SELECT * FROM validation_results 
ORDER BY validated_at DESC 
LIMIT 5;
```

**Logs to check:**
```
[Edit] Auto-revalidation queued for Patient/123
[Audit] Recorded successful edit: Patient/123 (R4)
```

---

## 🔍 Database Schema Verification

```sql
-- Check all fhir_version columns exist
\d fhir_servers;
\d validation_results;
\d edit_audit_trail;

-- Verify indexes
SELECT indexname, tablename 
FROM pg_indexes 
WHERE indexname LIKE '%fhir_version%';

-- Expected indexes:
-- idx_fhir_servers_version
-- idx_validation_results_version
-- idx_edit_audit_trail_version
```

---

## 🎯 Success Criteria

### Phase 1: FHIR Version Awareness ✅
- [x] Database migration completed
- [x] fhir_version columns in all tables
- [x] Automatic version detection from CapabilityStatement
- [x] Version badges in Sidebar
- [x] Version badges in Resource Detail Header
- [x] R6 Preview warning badge

### Phase 2: Hybrid Mode ✅
- [x] ValidationSettings schema extended
- [x] TerminologyAdapter service created
- [x] Online/Offline toggle in Settings
- [x] Conditional Ontoserver configuration UI
- [x] Fallback chain: Ontoserver → Cache → tx.fhir.org

### Phase 3: Error Mapping ✅
- [x] error_map.json with 15 mappings
- [x] ErrorMappingService backend
- [x] Pattern matching with placeholders
- [x] German/English bilingual support
- [x] UI shows friendly messages + suggestions
- [x] Technical details expandable

### Phase 4: Auto-Revalidation ✅
- [x] autoRevalidateAfterEdit setting
- [x] Backend hook in PUT endpoint
- [x] FHIR version in audit trail
- [x] Checkbox in ResourceEditor
- [x] Progress indicators
- [x] Non-blocking validation queue

---

## 📊 PRD Compliance: ~85%

**Achieved:**
- ✅ Multi-Version Support (R4, R5, R6)
- ✅ Hybrid Online/Offline Mode
- ✅ Error Mapping Engine (15 patterns)
- ✅ Auto-Revalidation After Edit
- ✅ Six-Aspect Validation
- ✅ In-Place Editing
- ✅ Polling-based Updates

**Optional (Not Critical):**
- ⚪ Worker Threads for Batch Processing
- ⚪ UI Dead Code Cleanup

---

## 🐛 Known Issues / Limitations

1. **Version Detection:** Currently set to R4 for existing servers. Automatic detection via CapabilityStatement works for new servers.

2. **Ontoserver:** Requires manual installation. Fallback to tx.fhir.org works if local server unavailable.

3. **Error Mapping:** Only 15 patterns covered. Can be extended via `error_map.json`.

4. **Worker Threads:** Not implemented yet. Current implementation uses Promise.all for parallel processing.

---

## 🚀 Next Steps

1. **Manual Testing:** Follow this checklist
2. **UI Cleanup:** Remove demo components (next task)
3. **E2E Tests:** Optional Playwright tests
4. **Production Deployment:** After successful testing

---

**Test Date:** 2025-01-09  
**Version:** MVP v1.2  
**Tester:** _________

