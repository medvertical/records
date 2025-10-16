/**
 * Core Code Systems - Index
 * 
 * Combines all core code systems (FHIR core + external standards) into a single export.
 * This allows for efficient validation of ~2000+ codes without network calls.
 * 
 * Total Coverage:
 * - FHIR Core: ~15 systems, ~100 codes
 * - ISO Codes: 2 systems, ~920 codes (countries + languages)
 * - UCUM Units: 1 system, ~200 common units
 * - MIME Types: 1 system, ~55 types
 * - Timezones: 1 system, ~150 major zones
 * 
 * Total: ~20 systems, ~1425 codes
 */

import { FHIR_CORE_SYSTEMS } from './fhir-core';
import { ISO_CODE_SYSTEMS } from './external-iso';
import { UCUM_SYSTEMS } from './external-ucum';
import { MIME_AND_TIMEZONE_SYSTEMS } from './external-mime-tz';
import type { CoreCodeSystemMap } from './types';

/**
 * Combined core code systems map
 */
export const ALL_CORE_CODE_SYSTEMS: CoreCodeSystemMap = {
  ...FHIR_CORE_SYSTEMS,
  ...ISO_CODE_SYSTEMS,
  ...UCUM_SYSTEMS,
  ...MIME_AND_TIMEZONE_SYSTEMS,
};

/**
 * Export individual system maps for testing/debugging
 */
export {
  FHIR_CORE_SYSTEMS,
  ISO_CODE_SYSTEMS,
  UCUM_SYSTEMS,
  MIME_AND_TIMEZONE_SYSTEMS,
};

/**
 * Export types
 */
export type { CoreCodeDefinition, CoreCodeSystemMap } from './types';

