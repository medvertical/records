# FHIR Validation Configuration

This directory contains configuration files for the FHIR Validation MVP.

## Environment Variables

To configure the FHIR validation system, create a `.env` file in the project root with the following variables:

### Required Environment Variables

```bash
# FHIR Ontoserver Configuration
FHIR_R4_ONTOSERVER_URL=https://r4.ontoserver.csiro.au/fhir
FHIR_R5_ONTOSERVER_URL=https://r5.ontoserver.csiro.au/fhir

# Firely Server Configuration
FHIR_FIRELY_SERVER_URL=http://localhost:8080/fhir
```

### Optional Environment Variables

```bash
# Server Configuration
PORT=3000
NODE_ENV=development

# Validation Configuration
FHIR_VALIDATION_TIMEOUT=5000
FHIR_VALIDATION_RETRY_ATTEMPTS=3
FHIR_VALIDATION_RETRY_DELAY=1000

# Caching Configuration
FHIR_CACHE_TTL_MS=300000
FHIR_CACHE_MAX_SIZE=1000
```

## Configuration Files

- `fhir-validation.env.ts` - Main configuration file that reads environment variables and provides typed configuration
- `README.md` - This documentation file

## Usage

```typescript
import { fhirValidationConfig, ontoserverR4Url, validateFHIRConfig } from './config/fhir-validation.env';

// Use configuration
const config = fhirValidationConfig;

// Validate configuration
const { isValid, errors } = validateFHIRConfig();
if (!isValid) {
  console.error('Configuration errors:', errors);
}
```

## Default Values

The configuration system provides sensible defaults for all optional variables:

- **FHIR_R4_ONTOSERVER_URL**: `https://r4.ontoserver.csiro.au/fhir`
- **FHIR_R5_ONTOSERVER_URL**: `https://r5.ontoserver.csiro.au/fhir`
- **FHIR_FIRELY_SERVER_URL**: `http://localhost:8080/fhir`
- **FHIR_VALIDATION_TIMEOUT**: `5000` (5 seconds)
- **FHIR_VALIDATION_RETRY_ATTEMPTS**: `3`
- **FHIR_VALIDATION_RETRY_DELAY**: `1000` (1 second)
- **FHIR_CACHE_TTL_MS**: `300000` (5 minutes)
- **FHIR_CACHE_MAX_SIZE**: `1000`
