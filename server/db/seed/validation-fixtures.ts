import type { 
  InsertValidationResultPerAspect, 
  InsertValidationMessage,
  InsertValidationMessageGroup,
  ValidationAspectType,
  ValidationSeverityType
} from '../../../shared/schema-validation-per-aspect';
import crypto from 'crypto';

/**
 * Compute SHA-256 hash for a string
 */
function sha256(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

/**
 * Generate settings snapshot hash
 */
export function generateSettingsSnapshotHash(aspects: Record<string, { enabled: boolean }>): string {
  const normalized = JSON.stringify(aspects, Object.keys(aspects).sort());
  return sha256(normalized);
}

/**
 * Generate message signature
 */
export function generateMessageSignature(
  aspect: string,
  severity: string,
  code: string | undefined,
  canonicalPath: string,
  ruleId: string | undefined,
  normalizedText: string
): string {
  const components = [
    aspect,
    severity.toLowerCase(),
    code || '',
    canonicalPath,
    ruleId || '',
    normalizedText
  ].join('|');
  
  return sha256(components);
}

/**
 * Basic fixture: Settings snapshot for default validation settings
 */
export const defaultSettingsSnapshot = {
  structural: { enabled: true },
  profile: { enabled: true },
  terminology: { enabled: true },
  reference: { enabled: true },
  businessRule: { enabled: true },
  metadata: { enabled: true },
};

export const defaultSettingsHash = generateSettingsSnapshotHash(defaultSettingsSnapshot);

/**
 * Fixture: Sample per-aspect validation results
 */
export function createValidationResultFixtures(serverId: number): InsertValidationResultPerAspect[] {
  return [
    // Patient resource - structural validation (has errors)
    {
      serverId,
      resourceType: 'Patient',
      fhirId: 'patient-001',
      aspect: 'structural',
      isValid: false,
      errorCount: 2,
      warningCount: 1,
      informationCount: 0,
      score: 0,
      settingsSnapshotHash: defaultSettingsHash,
      durationMs: 45,
      validationEngineVersion: '1.0.0',
      detailedResult: {},
    },
    // Patient resource - profile validation (valid)
    {
      serverId,
      resourceType: 'Patient',
      fhirId: 'patient-001',
      aspect: 'profile',
      isValid: true,
      errorCount: 0,
      warningCount: 0,
      informationCount: 1,
      score: 100,
      settingsSnapshotHash: defaultSettingsHash,
      durationMs: 120,
      validationEngineVersion: '1.0.0',
      detailedResult: {},
    },
    // Observation resource - terminology validation (warnings)
    {
      serverId,
      resourceType: 'Observation',
      fhirId: 'obs-001',
      aspect: 'terminology',
      isValid: true,
      errorCount: 0,
      warningCount: 3,
      informationCount: 0,
      score: 70,
      settingsSnapshotHash: defaultSettingsHash,
      durationMs: 230,
      validationEngineVersion: '1.0.0',
      detailedResult: {},
    },
    // Observation resource - reference validation (valid)
    {
      serverId,
      resourceType: 'Observation',
      fhirId: 'obs-001',
      aspect: 'reference',
      isValid: true,
      errorCount: 0,
      warningCount: 0,
      informationCount: 0,
      score: 100,
      settingsSnapshotHash: defaultSettingsHash,
      durationMs: 85,
      validationEngineVersion: '1.0.0',
      detailedResult: {},
    },
  ];
}

/**
 * Fixture: Sample validation messages
 */
export function createValidationMessageFixtures(validationResultIds: number[], serverId: number): InsertValidationMessage[] {
  const messages: InsertValidationMessage[] = [];
  
  // Messages for Patient structural validation (index 0)
  if (validationResultIds[0]) {
    const msg1 = {
      validationResultId: validationResultIds[0],
      serverId,
      resourceType: 'Patient',
      fhirId: 'patient-001',
      aspect: 'structural' as ValidationAspectType,
      severity: 'error' as ValidationSeverityType,
      code: 'required',
      canonicalPath: 'patient.name',
      text: 'Patient.name: minimum required = 1, but only found 0',
      normalizedText: 'patient.name: minimum required = 1, but only found 0',
      ruleId: 'dom-6',
      signature: '',
      signatureVersion: 1,
      pathTruncated: false,
      textTruncated: false,
    };
    msg1.signature = generateMessageSignature(
      msg1.aspect,
      msg1.severity,
      msg1.code,
      msg1.canonicalPath,
      msg1.ruleId,
      msg1.normalizedText
    );
    messages.push(msg1);
    
    const msg2 = {
      validationResultId: validationResultIds[0],
      serverId,
      resourceType: 'Patient',
      fhirId: 'patient-001',
      aspect: 'structural' as ValidationAspectType,
      severity: 'error' as ValidationSeverityType,
      code: 'structure',
      canonicalPath: 'patient.identifier.system',
      text: 'Patient.identifier[0]: system is required when value is present',
      normalizedText: 'patient.identifier: system is required when value is present',
      ruleId: 'ident-1',
      signature: '',
      signatureVersion: 1,
      pathTruncated: false,
      textTruncated: false,
    };
    msg2.signature = generateMessageSignature(
      msg2.aspect,
      msg2.severity,
      msg2.code,
      msg2.canonicalPath,
      msg2.ruleId,
      msg2.normalizedText
    );
    messages.push(msg2);
  }
  
  // Messages for Observation terminology validation (index 2)
  if (validationResultIds[2]) {
    const msg3 = {
      validationResultId: validationResultIds[2],
      serverId,
      resourceType: 'Observation',
      fhirId: 'obs-001',
      aspect: 'terminology' as ValidationAspectType,
      severity: 'warning' as ValidationSeverityType,
      code: 'code-unknown',
      canonicalPath: 'observation.code.coding.code',
      text: 'The code "12345-6" is not found in the LOINC value set',
      normalizedText: 'the code "12345-6" is not found in the loinc value set',
      signature: '',
      signatureVersion: 1,
      pathTruncated: false,
      textTruncated: false,
    };
    msg3.signature = generateMessageSignature(
      msg3.aspect,
      msg3.severity,
      msg3.code,
      msg3.canonicalPath,
      msg3.ruleId,
      msg3.normalizedText
    );
    messages.push(msg3);
  }
  
  return messages;
}

/**
 * Fixture: Sample message groups (for caching)
 */
export function createMessageGroupFixtures(serverId: number): InsertValidationMessageGroup[] {
  const groups: InsertValidationMessageGroup[] = [];
  
  // Group for "name required" error
  const group1Sig = generateMessageSignature(
    'structural',
    'error',
    'required',
    'patient.name',
    'dom-6',
    'patient.name: minimum required = 1, but only found 0'
  );
  
  groups.push({
    serverId,
    signature: group1Sig,
    signatureVersion: 1,
    aspect: 'structural',
    severity: 'error',
    code: 'required',
    canonicalPath: 'patient.name',
    sampleText: 'Patient.name: minimum required = 1, but only found 0',
    totalResources: 1,
  });
  
  // Group for terminology warning
  const group2Sig = generateMessageSignature(
    'terminology',
    'warning',
    'code-unknown',
    'observation.code.coding.code',
    undefined,
    'the code "12345-6" is not found in the loinc value set'
  );
  
  groups.push({
    serverId,
    signature: group2Sig,
    signatureVersion: 1,
    aspect: 'terminology',
    severity: 'warning',
    code: 'code-unknown',
    canonicalPath: 'observation.code.coding.code',
    sampleText: 'The code "12345-6" is not found in the LOINC value set',
    totalResources: 1,
  });
  
  return groups;
}

/**
 * Export all fixtures for easy seeding
 */
export const validationFixtures = {
  defaultSettingsHash,
  createValidationResultFixtures,
  createValidationMessageFixtures,
  createMessageGroupFixtures,
};
