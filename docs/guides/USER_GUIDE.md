# Records FHIR Platform - User Guide

**Version:** MVP v1.2  
**Last Updated:** 2025-10-09

---

## 📋 Table of Contents

1. [Getting Started](#getting-started)
2. [Connecting to a FHIR Server](#connecting-to-a-fhir-server)
3. [Browsing Resources](#browsing-resources)
4. [Validation Workflow](#validation-workflow)
5. [Understanding Validation Results](#understanding-validation-results)
6. [Configuring Validation Settings](#configuring-validation-settings)
7. [Managing Profile Packages](#managing-profile-packages)
8. [Exporting Results](#exporting-results)
9. [Tips & Best Practices](#tips--best-practices)

---

## 🚀 Getting Started

### First Login

1. Open your browser and navigate to the application URL
   - **Local**: http://localhost:5174
   - **Production**: https://records.your-domain.com

2. You'll see the **Dashboard** with initial setup prompts

3. If no FHIR server is configured, you'll see a "Connect Server" prompt

---

## 🔌 Connecting to a FHIR Server

### Add a New Server

1. Click **"Connect Server"** or navigate to **Settings → Servers**

2. Click **"+ Add Server"** button

3. Fill in server details:
   ```
   Server Name: My HAPI FHIR Server
   Server URL:  https://hapi.fhir.org/baseR4
   ```

4. (Optional) Add authentication:
   - **Bearer Token**: `Authorization: Bearer your-token`
   - **Basic Auth**: Username + Password

5. Click **"Test Connection"** to verify

6. Click **"Save"** to add the server

### Server Indicators

**FHIR Version Badge:**
- 🔵 **R4** - Full support
- 🟢 **R5** - Full support
- 🟣 **R6** - Partial support (see limitations)

**Connection Status:**
- 🟢 **Connected** - Server is accessible
- 🔴 **Disconnected** - Connection failed
- 🟠 **Updating** - Reconnecting...

### Switch Between Servers

1. Click the **server name** in the sidebar header

2. Select a different server from the dropdown

3. The UI will reload with resources from the new server

---

## 📚 Browsing Resources

### Resource List

1. Click **"Browse Resources"** in the sidebar

2. You'll see:
   - **Resource Type** dropdown (Patient, Observation, etc.)
   - **Search bar** for filtering
   - **Resource cards** with summary info

3. Click a **resource card** to view details

### Resource Details

The resource detail view shows:

- **Resource JSON** (formatted, syntax-highlighted)
- **Metadata** (ID, last updated, version, profile)
- **References** (linked resources)
- **Validation Results** (if validated)

### Quick Actions

**From resource list:**
- ✅ **Validate** - Run validation on selected resources
- 📝 **Edit** - Modify resource (opens editor)
- 🗑️ **Delete** - Remove resource
- 📥 **Export** - Download as JSON

**From resource detail:**
- ✅ **Validate Now** - Immediate validation
- 📝 **Edit** - Open JSON editor
- 🔄 **Refresh** - Reload from server
- 📥 **Download** - Save JSON file

---

## ✅ Validation Workflow

### Single Resource Validation

**Method 1: From Resource List**
1. Browse to resource list
2. Click **checkbox** next to resource
3. Click **"Validate Selected"** button
4. View results in the **Validation tab**

**Method 2: From Resource Detail**
1. Open resource detail
2. Click **"Validate Now"** button
3. View results below resource JSON

**Method 3: From Dashboard**
1. Navigate to **Dashboard**
2. Click **"Start Validation"**
3. Select resources or use filters
4. Click **"Start"**

### Batch Validation

**Validate All Resources:**
1. Go to **Dashboard** → **Validation Control Panel**
2. Click **"Start Validation"**
3. Select **"All Resources"** or filter by type
4. Click **"Start"**
5. Monitor progress in real-time

**Filter Options:**
- **Resource Type**: Validate only specific types
- **FHIR Version**: Filter by R4/R5/R6 (if mixed servers)
- **Date Range**: Validate resources updated after date

### Real-Time Progress

During validation, you'll see:

- **Progress bar** (e.g., "45/100 resources validated")
- **Current resource** being validated
- **Estimated time remaining**
- **Error/Warning counts** updated live

### Auto-Revalidation

Resources are automatically revalidated when:

- ✅ You **edit** a resource
- ✅ A **reference** changes
- ✅ **Validation settings** change
- ✅ **Profile packages** are updated

**To enable:**
- Settings → Validation → Performance → **Auto-Revalidation** toggle

---

## 📊 Understanding Validation Results

### Validation Dashboard

The dashboard shows:

```
┌─────────────────────────────────────────────────────┐
│ Validation Score: 87%                    🟢 Online │
├─────────────────────────────────────────────────────┤
│ Total Resources:   250                              │
│ Validated:         250                              │
│ Errors:            12   (5%)                        │
│ Warnings:          31   (12%)                       │
│ Passed:            207  (83%)                       │
└─────────────────────────────────────────────────────┘
```

### Validation Aspects

Each resource is validated across **6 aspects**:

| Aspect | Icon | Description | Severity |
|--------|------|-------------|----------|
| **Structural** | 🏗️ | JSON structure, required fields | Error |
| **Profile** | 📋 | FHIR profile conformance | Warning |
| **Terminology** | 🏥 | CodeSystem/ValueSet bindings | Warning |
| **Reference** | 🔗 | Resource reference integrity | Error |
| **Business Rules** | 🧠 | Custom FHIRPath rules | Error |
| **Metadata** | 📝 | Meta field completeness | Error |

**Aspect Results:**
- ✅ **Passed** - No issues found
- ⚠️ **Warning** - Non-critical issues
- ❌ **Error** - Must be fixed
- ⏭️ **Skipped** - Aspect disabled or N/A

### Validation Messages

Each issue shows:

```
┌──────────────────────────────────────────────────────┐
│ ❌ Error: Missing required field 'name'             │
│                                                      │
│ Aspect:     Structural                              │
│ Severity:   Error                                   │
│ Code:       required-field-missing                  │
│ Location:   Patient (line 15)                       │
│                                                      │
│ Description:                                        │
│ Patient resources must include at least one name   │
│ element according to FHIR R4 specification.        │
│                                                      │
│ Suggested Fix:                                      │
│ Add a 'name' array with at least one HumanName     │
│ object containing family and/or given names.       │
│                                                      │
│ [Show Technical Details] [Dismiss]                 │
└──────────────────────────────────────────────────────┘
```

**Severity Levels:**
- 🔴 **Error**: Must fix (prevents conformance)
- 🟠 **Warning**: Should fix (best practice)
- 🔵 **Information**: Optional (guidance)

### Filtering Results

**By Severity:**
- Show **All** messages
- Show **Errors only**
- Show **Warnings only**
- Show **Info only**

**By Aspect:**
- Toggle aspects on/off in settings

**By Resource Type:**
- Filter by Patient, Observation, etc.

### R6 Warnings

Resources validated as **R6** show a warning banner:

```
┌──────────────────────────────────────────────────────┐
│ ⚠️ FHIR R6 Limited Support                          │
│                                                      │
│ Validation for R6 resources is limited to           │
│ structural and profile checks. Terminology,         │
│ reference, and business rule validation are not     │
│ available due to R6 specification changes.          │
└──────────────────────────────────────────────────────┘
```

---

## ⚙️ Configuring Validation Settings

### Access Settings

**Method 1: Header Dropdown**
- Click **"Validation Settings 6/6"** in header
- Quick access to toggle aspects

**Method 2: Settings Page**
- Sidebar → **Settings** → **Validation** tab
- Full configuration interface

### Validation Aspects

**Enable/Disable Aspects:**

```
┌──────────────────────────────────────────────────────┐
│ ☑️ Structural     [Enabled]  Severity: Error        │
│ ☑️ Profile        [Enabled]  Severity: Warning      │
│ ☑️ Terminology    [Enabled]  Severity: Warning      │
│ ☑️ Reference      [Enabled]  Severity: Error        │
│ ☑️ Business Rules [Enabled]  Severity: Error        │
│ ☑️ Metadata       [Enabled]  Severity: Error        │
└──────────────────────────────────────────────────────┘
```

**When to disable aspects:**
- **Profile**: If no specific profiles required
- **Terminology**: If offline and no Ontoserver
- **Reference**: For standalone resource testing
- **Business Rules**: If no custom rules defined

### Performance Settings

```
Max Concurrent Validations: [5]  (1-20)
  Number of resources validated simultaneously
  
Batch Size: [50]  (10-100)
  Number of resources per batch
  
Auto-Revalidation: [✅ Enabled]
  Automatically revalidate after edits
```

**Recommendations:**
- **Small dataset (<100 resources)**: Max Concurrent = 5, Batch Size = 50
- **Medium dataset (100-1000)**: Max Concurrent = 10, Batch Size = 100
- **Large dataset (>1000)**: Max Concurrent = 20, Batch Size = 100

### Validation Mode

**Online Mode** 🌐
- Uses **tx.fhir.org** for terminology
- Always up-to-date
- Requires internet connection

**Offline Mode** 📦
- Uses **local Ontoserver**
- Works without internet
- Requires Ontoserver setup

**Hybrid Mode** (Recommended)
- Tries **online first**
- Falls back to **offline** if unavailable
- Best of both worlds

**To switch modes:**
- Settings → Validation → **Validation Mode** toggle

---

## 📦 Managing Profile Packages

### View Installed Packages

1. Navigate to **Settings → Packages**

2. You'll see:
   - **German Profiles** (MII, ISiK, KBV)
   - **International Extensions**
   - **Custom Packages**

3. Each package shows:
   - Name and version
   - Install status (✅ Installed, ⏳ Downloading, ❌ Failed)
   - Size and update date

### Quick Install (German Profiles)

1. Click **"German Profiles"** tab

2. Click **"Quick Install All"** button

3. System automatically installs:
   - MII Kerndatensatz (Consent, Patient, etc.)
   - ISiK Basismodul
   - KBV Basis
   - HL7 Germany Base

4. Progress bar shows download and extraction status

5. ✅ **Done** when all packages installed

### Install Individual Package

1. Click **"+ Install Package"** button

2. Enter package details:
   ```
   Package ID: de.medizininformatik-initiative.kerndatensatz.consent
   Version:    1.0.10 (or leave empty for latest)
   ```

3. Click **"Install"**

4. Watch progress indicator

5. Installed packages appear in list

### Update Packages

1. Click **"Check for Updates"** button

2. System checks Simplifier.net for newer versions

3. Packages with updates show **"Update Available"** badge

4. Click **"Update"** button next to package

5. System downloads and installs new version

---

## 📥 Exporting Results

### Export Validation Results

1. Navigate to **Dashboard** → **Export** section

2. Configure export options:
   ```
   Format:       JSON ☑️ | CSV ☐
   Compression:  gzip ☑️
   ```

3. Apply filters (optional):
   - **Severity**: Errors, Warnings, Info
   - **Aspect**: Structural, Profile, etc.
   - **Resource Type**: Patient, Observation, etc.
   - **Date Range**: Last 7 days, Last 30 days, Custom

4. Click **"Create Export"**

5. Export job starts (shows progress)

6. Download link appears when ready

### Export Formats

**JSON:**
```json
{
  "metadata": {
    "exportDate": "2025-10-09T20:00:00Z",
    "totalRecords": 250,
    "filters": {...}
  },
  "results": [
    {
      "resourceId": "Patient/123",
      "resourceType": "Patient",
      "fhirVersion": "R4",
      "validationDate": "2025-10-09T19:55:00Z",
      "score": 95,
      "aspects": {
        "structural": { "passed": true, "issues": [] },
        "profile": { "passed": false, "issues": [...] }
      }
    }
  ]
}
```

**Compression:**
- gzip compression reduces file size by ~70%
- Useful for large exports (>1000 resources)

### Export Lifecycle

1. **Created** - Export job started
2. **Processing** - Gathering and filtering data
3. **Complete** - Download available (30-day retention)
4. **Expired** - Deleted after 30 days

---

## 💡 Tips & Best Practices

### Validation Best Practices

**1. Start Small**
- Validate 10-20 resources first
- Review results and adjust settings
- Then scale up to full dataset

**2. Profile-Specific Validation**
- Install relevant profile packages first
- Enable **Profile** aspect
- Resources will be validated against declared profiles

**3. Fix Errors Before Warnings**
- **Errors** prevent FHIR conformance
- **Warnings** are best practice recommendations
- Focus on errors first

**4. Use Auto-Revalidation**
- Enable for immediate feedback
- Validates on every edit
- Catches issues early

**5. Monitor Performance**
- Watch validation times
- Adjust **Max Concurrent** if slow
- Use **Batch Size** for large datasets

### Resource Management

**1. Organize by Resource Type**
- Use **Quick Access** sidebar
- Pin frequently used types
- Filter by type in lists

**2. Use References**
- Click reference links to navigate
- Validate referenced resources together
- Check **Reference** aspect for broken links

**3. Version Control**
- Resources have `meta.versionId`
- Track changes via **Audit Trail**
- Revert to previous versions if needed

### Troubleshooting Validation Issues

**Issue: All validations fail**
- ✅ Check FHIR server connectivity
- ✅ Verify HAPI validator is installed
- ✅ Check logs for error messages

**Issue: Terminology validation always fails**
- ✅ Check **Validation Mode** (Online/Offline)
- ✅ Verify tx.fhir.org is accessible
- ✅ Or setup Ontoserver for offline mode

**Issue: Slow validation**
- ✅ Reduce **Max Concurrent** validations
- ✅ Increase **Batch Size**
- ✅ Check server resources (CPU, RAM)

**Issue: Profile validation fails**
- ✅ Install required profile packages
- ✅ Check `meta.profile` URL is correct
- ✅ Verify profile package version

---

## 📞 Support

### Get Help

**Documentation:**
- 📖 [Troubleshooting Guide](./TROUBLESHOOTING.md)
- 🏗️ [Validation Architecture](../technical/validation/VALIDATION_ARCHITECTURE.md)
- 🚀 [Deployment Guide](./DEPLOYMENT_GUIDE.md)

**Issues:**
- 🐛 Report bugs on GitHub Issues
- 💬 Ask questions in GitHub Discussions

**Contact:**
- 📧 Email: support@example.com

---

## 🎓 Learning Resources

### Video Tutorials

*(Coming soon)*
- Getting Started (5 min)
- Validation Workflow (10 min)
- Advanced Configuration (15 min)

### Example Workflows

**Scenario 1: Validate German Patient Consent**
1. Install **MII Kerndatensatz Consent** package
2. Create Patient and Consent resources
3. Set `meta.profile` to MII Consent profile
4. Run validation
5. Review profile conformance results

**Scenario 2: Offline Validation Setup**
1. Setup Ontoserver via Docker
2. Import German CodeSystems (ICD-10-GM, OPS)
3. Switch to **Offline Mode**
4. Validate resources with terminology
5. Verify CodeSystem lookups work

**Scenario 3: Batch Validation Pipeline**
1. Connect to FHIR server with 1000+ resources
2. Configure **Max Concurrent = 10**, **Batch Size = 100**
3. Start batch validation
4. Monitor progress
5. Export results for analysis

---

**Last Updated:** 2025-10-09  
**Next Review:** Q1 2026

