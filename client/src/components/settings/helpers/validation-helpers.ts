/**
 * Validation Settings Helper Functions
 */

export function getAspectDescription(aspectKey: string): string {
  const descriptions: Record<string, string> = {
    structural: 'Validates FHIR resource structure and required fields',
    profile: 'Validates against FHIR profiles and extensions',
    terminology: 'Validates terminology bindings and code systems',
    reference: 'Validates resource references and relationships',
    businessRule: 'Validates business rules and constraints',
    metadata: 'Validates metadata and administrative information'
  };
  
  return descriptions[aspectKey] || 'Validation aspect';
}

export function getAvailableEngines(aspectKey: string): string[] {
  const engineOptions: Record<string, string[]> = {
    structural: ['schema', 'hapi', 'server'],
    profile: ['hapi', 'server', 'auto'],
    terminology: ['server', 'ontoserver', 'cached'],
    reference: ['internal', 'server'],
    businessRule: ['fhirpath', 'custom'],
    metadata: ['schema', 'hapi']
  };
  
  return engineOptions[aspectKey] || ['hapi'];
}

export function formatAspectName(aspectKey: string): string {
  return aspectKey.replace(/([A-Z])/g, ' $1').trim();
}

