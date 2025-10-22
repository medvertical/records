/**
 * Mock data helper for testing when FHIR server is unavailable
 * Creates a mock FHIR Bundle with sample resources
 */
export function createMockBundle(resourceType: string, batchSize: number, offset: number): any {
  const entries = [];
  const actualBatchSize = Math.min(batchSize, 10); // Limit mock batch size
  
  for (let i = 0; i < actualBatchSize; i++) {
    const resourceId = `mock-${resourceType.toLowerCase()}-${offset + i + 1}`;
    const resource = {
      resourceType,
      id: resourceId,
      meta: {
        versionId: '1',
        lastUpdated: new Date().toISOString()
      },
      // Add minimal required fields for validation
      ...(resourceType === 'Patient' && {
        name: [{ family: `Test${i + 1}`, given: ['Patient'] }],
        gender: i % 2 === 0 ? 'male' : 'female',
        birthDate: '1990-01-01'
      }),
      ...(resourceType === 'Observation' && {
        status: 'final',
        code: { coding: [{ system: 'http://loinc.org', code: '33747-0', display: 'Test Observation' }] },
        subject: { reference: `Patient/mock-patient-${i + 1}` }
      }),
      ...(resourceType === 'Encounter' && {
        status: 'finished',
        class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'AMB' },
        subject: { reference: `Patient/mock-patient-${i + 1}` }
      })
    };
    
    entries.push({
      fullUrl: `https://mock.server/${resourceType}/${resourceId}`,
      resource,
      search: { mode: 'match' }
    });
  }
  
  return {
    resourceType: 'Bundle',
    type: 'searchset',
    total: 150, // Mock total
    entry: entries
  };
}

