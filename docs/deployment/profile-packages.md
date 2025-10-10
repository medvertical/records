# FHIR Profile Package Installation Guide

## Overview

This document describes how to install, manage, and use FHIR Implementation Guide (IG) packages in the Records FHIR Validation Platform for profile-based validation.

---

## What are Profile Packages?

FHIR Implementation Guide (IG) packages are bundles of FHIR resources that define:
- **StructureDefinitions**: Profiles that constrain base FHIR resources
- **ValueSets**: Terminology bindings for coded elements
- **CodeSystems**: Custom terminologies
- **SearchParameters**: Custom search capabilities
- **Examples**: Sample resources conforming to profiles

### Supported Package Types
- **German Profiles**: MII, ISiK, KBV
- **International Extensions**: HL7 Core Extensions, UV Extensions, IPS
- **Custom IGs**: Organization-specific profiles

---

## Package Sources

### Simplifier.net
The primary source for FHIR packages is [Simplifier.net](https://simplifier.net/), the official FHIR package registry.

**Popular German Packages:**
- `de.medizininformatikinitiative.kerndatensatz` (MII Core Dataset)
- `de.gematik.isik` (ISiK - Informationssysteme im Krankenhaus)
- `de.kbv.basis` (KBV - Kassenärztliche Bundesvereinigung)
- `de.basisprofil.r4` (German Base Profiles)

**International Packages:**
- `hl7.fhir.r4.core` (FHIR R4 Core)
- `hl7.fhir.uv.extensions` (Universal Extensions)
- `hl7.fhir.uv.ips` (International Patient Summary)

---

## Installation Methods

### Method 1: Via Package Management UI

#### 1. Navigate to Package Management

In the Records platform:
1. Click **Package Management** in the sidebar
2. View the list of installed packages

#### 2. Search for Packages

Use the search bar to find packages by:
- Package name
- Publisher
- FHIR version

#### 3. Install Package

1. Click **Install Package** button
2. Enter package identifier (e.g., `de.medizininformatikinitiative.kerndatensatz`)
3. Select version (or use `latest`)
4. Click **Install**

#### 4. Monitor Installation

Watch the progress indicator:
- **Queued**: Package added to installation queue
- **Downloading**: Fetching package from Simplifier
- **Extracting**: Unpacking `.tgz` archive
- **Indexing**: Loading StructureDefinitions into database
- **Complete**: Package ready for use

---

### Method 2: Via API

#### Install Package

```bash
POST /api/validation/profile-packages
Content-Type: application/json

{
  "packageId": "de.medizininformatikinitiative.kerndatensatz",
  "version": "1.0.0",
  "fhirVersion": "R4"
}
```

#### List Installed Packages

```bash
GET /api/validation/profile-packages
```

#### Update Package

```bash
PUT /api/validation/profile-packages/{packageId}
Content-Type: application/json

{
  "version": "1.1.0"
}
```

#### Delete Package

```bash
DELETE /api/validation/profile-packages/{packageId}
```

---

### Method 3: Manual Installation (Advanced)

#### 1. Download Package

```bash
# From Simplifier (requires API key)
curl -H "Authorization: Bearer YOUR_API_KEY" \
  https://packages.simplifier.net/de.medizininformatikinitiative.kerndatensatz/1.0.0 \
  -o mii-kerndatensatz-1.0.0.tgz
```

#### 2. Extract Package

```bash
mkdir -p server/profiles/cache/mii-kerndatensatz-1.0.0
tar -xzf mii-kerndatensatz-1.0.0.tgz -C server/profiles/cache/mii-kerndatensatz-1.0.0
```

#### 3. Index StructureDefinitions

```bash
POST /api/validation/profile-packages/index
Content-Type: application/json

{
  "packagePath": "server/profiles/cache/mii-kerndatensatz-1.0.0"
}
```

---

## Package Directory Structure

### Storage Location

```
server/
└── profiles/
    ├── cache/
    │   ├── mii-kerndatensatz-1.0.0/
    │   │   ├── package/
    │   │   │   ├── StructureDefinition-*.json
    │   │   │   ├── ValueSet-*.json
    │   │   │   ├── CodeSystem-*.json
    │   │   │   └── package.json
    │   ├── isik-basismodul-3.0.0/
    │   └── ...
    └── installed-packages.json
```

### Package Metadata

Each package directory contains a `package.json`:

```json
{
  "name": "de.medizininformatikinitiative.kerndatensatz",
  "version": "1.0.0",
  "description": "MII Kerndatensatz - Core Dataset",
  "fhirVersions": ["4.0.1"],
  "dependencies": {
    "hl7.fhir.r4.core": "4.0.1",
    "de.basisprofil.r4": "1.0.0"
  }
}
```

---

## Using Installed Packages

### Profile-Based Validation

Once a package is installed, its profiles are automatically available for validation.

#### Example: Validate Against MII Patient Profile

```bash
POST /api/validation/validate-resource
Content-Type: application/fhir+json

{
  "resourceType": "Patient",
  "meta": {
    "profile": [
      "https://www.medizininformatik-initiative.de/fhir/core/modul-person/StructureDefinition/Patient"
    ]
  },
  "identifier": [
    {
      "system": "http://hospital.example.org/patients",
      "value": "123456"
    }
  ],
  "name": [
    {
      "family": "Mustermann",
      "given": ["Max"]
    }
  ]
}
```

The validator will:
1. Detect the profile URL in `meta.profile`
2. Load the MII Patient StructureDefinition from cache
3. Validate the resource against profile constraints
4. Return validation results with profile-specific messages

---

## Managing Package Versions

### Version Selection

Packages support semantic versioning (SemVer):
- **Specific Version**: `1.0.0`
- **Latest Version**: `latest`
- **Version Range**: `^1.0.0` (all 1.x versions)

### Updating Packages

#### Via UI

1. Navigate to **Package Management**
2. Find the package to update
3. Click **Update** button
4. Select new version
5. Review changes
6. Click **Confirm Update**

#### Via API

```bash
PUT /api/validation/profile-packages/de.medizininformatikinitiative.kerndatensatz
Content-Type: application/json

{
  "version": "1.1.0"
}
```

### Version Comparison

The UI shows:
- **Current Version**: `1.0.0`
- **Available Version**: `1.1.0`
- **Changes**: Added 5 profiles, Updated 12 profiles, Removed 1 profile

---

## Package Dependencies

### Automatic Dependency Resolution

The platform automatically resolves and installs package dependencies.

**Example**: Installing MII Kerndatensatz will also install:
- `de.basisprofil.r4` (German Base Profiles)
- `hl7.fhir.r4.core` (FHIR R4 Core)

### Dependency Graph

View the dependency tree in the UI:

```
de.medizininformatikinitiative.kerndatensatz@1.0.0
├── de.basisprofil.r4@1.0.0
│   └── hl7.fhir.r4.core@4.0.1
└── hl7.fhir.r4.core@4.0.1
```

---

## Validation Settings

### Profile Source Priority

Configure profile resolution order in **Settings → Validation**:

1. **Local Cache** (fastest)
2. **Simplifier.net** (fallback)
3. **Custom Repository** (optional)

### Enable/Disable Packages

Temporarily disable packages without uninstalling:

```bash
PATCH /api/validation/profile-packages/de.medizininformatikinitiative.kerndatensatz
Content-Type: application/json

{
  "enabled": false
}
```

---

## Common Packages

### German Healthcare

| Package | Description | Version | Size |
|---------|-------------|---------|------|
| **MII Kerndatensatz** | Medical Informatics Initiative Core Dataset | 1.0.0 | 5 MB |
| **ISiK Basismodul** | Information Systems in Hospitals | 3.0.0 | 3 MB |
| **KBV Basis** | Association of Statutory Health Insurance Physicians | 1.3.0 | 4 MB |
| **German Base Profile** | German FHIR base profiles | 1.0.0 | 2 MB |

### International

| Package | Description | Version | Size |
|---------|-------------|---------|------|
| **HL7 Core Extensions** | Standard FHIR extensions | 4.0.1 | 1 MB |
| **UV Extensions** | Universal extensions | 1.0.0 | 500 KB |
| **IPS** | International Patient Summary | 1.1.0 | 3 MB |

---

## Troubleshooting

### Issue: Package Installation Fails

**Symptoms**: Installation stuck at "Downloading" or "Extracting".

**Solutions**:
1. Check internet connectivity
2. Verify Simplifier.net is accessible: `curl https://packages.simplifier.net`
3. Check disk space: `df -h`
4. Retry installation after a few minutes
5. Check logs: `tail -f logs/combined.log`

### Issue: Profile Not Found

**Symptoms**: Validation fails with "StructureDefinition not found" error.

**Solutions**:
1. Verify package is installed: Check **Package Management** UI
2. Check profile URL matches package StructureDefinition canonical URL
3. Re-index package:
   ```bash
   POST /api/validation/profile-packages/de.medizininformatikinitiative.kerndatensatz/reindex
   ```
4. Check FHIR version compatibility (R4 vs R5 vs R6)

### Issue: Slow Validation

**Symptoms**: Profile validation takes > 10 seconds per resource.

**Solutions**:
1. Verify profiles are cached (not fetched from Simplifier on every request)
2. Check database indexes: `SELECT * FROM pg_indexes WHERE tablename = 'profile_definitions';`
3. Increase profile cache size in `validation-settings.json`:
   ```json
   {
     "profileCache": {
       "maxSize": 10000,
       "ttl": 3600
     }
   }
   ```

### Issue: Version Conflict

**Symptoms**: Package update fails with "Dependency conflict" error.

**Solutions**:
1. Check dependency versions in `package.json`
2. Update dependent packages first
3. Use compatible version ranges
4. Force update (caution: may break validation):
   ```bash
   PUT /api/validation/profile-packages/de.medizininformatikinitiative.kerndatensatz?force=true
   ```

---

## Performance Optimization

### Pre-Load Common Profiles

Install frequently used packages during system initialization:

```bash
# In deployment script
npm run profiles:install mii-kerndatensatz
npm run profiles:install isik-basismodul
npm run profiles:install kbv-basis
```

### Profile Cache Configuration

Optimize cache settings in `.env`:

```bash
PROFILE_CACHE_MAX_SIZE=10000
PROFILE_CACHE_TTL=3600  # 1 hour
PROFILE_CACHE_STRATEGY=lru  # Least Recently Used
```

### Database Indexing

Ensure StructureDefinitions are indexed:

```sql
CREATE INDEX idx_profile_defs_url ON profile_definitions(canonical_url);
CREATE INDEX idx_profile_defs_version ON profile_definitions(version);
CREATE INDEX idx_profile_defs_package ON profile_definitions(package_id);
```

---

## Security Considerations

### Package Verification

The platform verifies package integrity:
- **Checksum Validation**: SHA-256 hash comparison
- **Signature Verification**: (optional, if package is signed)

### Access Control

Restrict package management to admin users:

```bash
# In .env
PACKAGE_MANAGEMENT_ROLES=admin,package-manager
```

---

## Backup and Recovery

### Export Installed Packages List

```bash
GET /api/validation/profile-packages/export
```

Returns JSON with all installed packages and versions.

### Restore from Backup

```bash
POST /api/validation/profile-packages/import
Content-Type: application/json

{
  "packages": [
    {
      "packageId": "de.medizininformatikinitiative.kerndatensatz",
      "version": "1.0.0"
    },
    {
      "packageId": "de.gematik.isik",
      "version": "3.0.0"
    }
  ]
}
```

---

## Automation

### Automated Package Updates

Schedule automatic updates via cron job:

```bash
# /etc/cron.daily/update-fhir-packages
#!/bin/bash
curl -X POST http://localhost:5000/api/validation/profile-packages/update-all \
  -H "Authorization: Bearer YOUR_API_TOKEN"
```

### CI/CD Integration

Include package installation in deployment pipeline:

```yaml
# .github/workflows/deploy.yml
- name: Install FHIR Packages
  run: |
    npm run profiles:install mii-kerndatensatz
    npm run profiles:install isik-basismodul
    npm run profiles:install kbv-basis
```

---

## Resources

- **Simplifier.net**: [https://simplifier.net/](https://simplifier.net/)
- **MII Core Dataset**: [https://www.medizininformatik-initiative.de/](https://www.medizininformatik-initiative.de/)
- **ISiK**: [https://gematik.de/anwendungen/isik](https://gematik.de/anwendungen/isik)
- **KBV**: [https://www.kbv.de/](https://www.kbv.de/)
- **FHIR Package Specification**: [https://confluence.hl7.org/display/FHIR/NPM+Package+Specification](https://confluence.hl7.org/display/FHIR/NPM+Package+Specification)

---

*Last Updated: 2025-01-10*
*Records Platform Version: MVP V1.2*

