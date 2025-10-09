# HAPI FHIR Validator CLI

This directory contains the HAPI FHIR Validator CLI JAR file, which is used for comprehensive FHIR validation.

## Setup Instructions

### 1. Download the Validator CLI JAR

The HAPI FHIR Validator CLI is a Java application that must be downloaded separately (it's excluded from git due to its large size: ~162MB).

**Automatic Download:**
```bash
cd server/lib
curl -L -o validator_cli.jar https://github.com/hapifhir/org.hl7.fhir.core/releases/download/6.3.23/validator_cli.jar
```

**Manual Download:**
1. Visit: https://github.com/hapifhir/org.hl7.fhir.core/releases
2. Download the latest `validator_cli.jar` from the release assets
3. Place it in `server/lib/validator_cli.jar`

### 2. Install Java Runtime

The HAPI validator requires Java 11 or higher.

**macOS:**
```bash
# Using Homebrew
brew install openjdk@11

# Or download from Oracle:
# https://www.oracle.com/java/technologies/downloads/
```

**Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install openjdk-11-jre
```

**Windows:**
Download and install from: https://www.oracle.com/java/technologies/downloads/

**Verify Installation:**
```bash
java -version
# Should output: openjdk version "11.0.x" or higher
```

### 3. Test the Validator

```bash
# Test basic execution
java -jar server/lib/validator_cli.jar -help

# Test validation (requires a sample FHIR resource)
java -jar server/lib/validator_cli.jar \
  -version 4.0 \
  -ig hl7.fhir.r4.core \
  sample-patient.json
```

## Docker Setup

For containerized deployments, the Dockerfile includes Java Runtime:

```dockerfile
FROM node:18-alpine

# Install Java Runtime
RUN apk add --no-cache openjdk11-jre

# Copy validator JAR
COPY server/lib/validator_cli.jar /opt/hapi/validator_cli.jar

# Set environment variables
ENV HAPI_JAR_PATH=/opt/hapi/validator_cli.jar
```

## Environment Configuration

Configure the validator in your `.env` file:

```bash
# Path to validator JAR
HAPI_JAR_PATH=server/lib/validator_cli.jar

# Timeout for validation operations (milliseconds)
HAPI_TIMEOUT=30000

# Maximum parallel validator processes
HAPI_MAX_PARALLEL=4

# FHIR Version Support
HAPI_DEFAULT_VERSION=R4
HAPI_SUPPORT_R5=true
HAPI_SUPPORT_R6=true

# Terminology Servers
HAPI_TX_ONLINE_R4=https://tx.fhir.org/r4
HAPI_TX_OFFLINE_R4=http://localhost:8081/fhir
```

## Usage in Code

```typescript
import { HapiValidatorClient } from '../services/validation/engine/hapi-validator-client';
import { hapiValidatorConfig } from '../config/hapi-validator-config';

const client = new HapiValidatorClient(hapiValidatorConfig);

const outcome = await client.validateResource(patientResource, {
  fhirVersion: 'R4',
  profile: 'http://hl7.org/fhir/StructureDefinition/Patient',
  terminologyServer: 'https://tx.fhir.org/r4',
  igPackages: ['hl7.fhir.r4.core@4.0.1']
});
```

## Troubleshooting

### "Unable to locate a Java Runtime"

**Solution:** Install Java 11+ (see installation instructions above)

### "validator_cli.jar: No such file or directory"

**Solution:** Download the JAR file (see download instructions above)

### "OutOfMemoryError: Java heap space"

**Solution:** Increase Java heap size:
```bash
export JAVA_OPTS="-Xmx2G"
```

### Validation is slow (>30s)

**Possible causes:**
1. Large Bundle resources (split into smaller batches)
2. Complex profile validation (consider caching IG packages)
3. Slow terminology server (use local Ontoserver in offline mode)

**Solutions:**
- Enable IG package caching (`HAPI_IG_CACHE_PATH`)
- Use offline mode with local Ontoserver
- Increase `HAPI_MAX_PARALLEL` for batch processing

## Version Information

- **HAPI Validator Version:** 6.3.23
- **Supported FHIR Versions:** R4 (4.0.x), R5 (5.0.x), R6 (6.0.x-ballot2)
- **Java Requirement:** OpenJDK 11 or higher

## Additional Resources

- HAPI FHIR Validator Documentation: https://hapifhir.io/hapi-fhir/docs/validation/introduction.html
- HAPI CLI Usage Guide: https://confluence.hl7.org/display/FHIR/Using+the+FHIR+Validator
- HL7 FHIR Validation Specification: http://hl7.org/fhir/validation.html
- GitHub Releases: https://github.com/hapifhir/org.hl7.fhir.core/releases

## Notes

- The JAR file is excluded from git (see `.gitignore`)
- The validator supports offline mode with pre-downloaded IG packages
- For production, consider deploying the validator as a separate microservice (REST API)

