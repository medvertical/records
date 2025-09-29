/**
 * FHIR R4 Test Resource Suite
 * 
 * Comprehensive test resources for validating the FHIR validation engine
 * across different scenarios and expected score ranges.
 */

export const validR4TestResources = {
  /**
   * Valid Patient Resource - Should score 90-100%
   * Complete with all required fields and proper metadata
   */
  validPatient: {
    resourceType: 'Patient',
    id: 'patient-valid-001',
    meta: {
      lastUpdated: '2023-01-15T10:30:00.000Z',
      versionId: '1',
      profile: ['http://hl7.org/fhir/StructureDefinition/Patient']
    },
    text: {
      status: 'generated',
      div: '<div xmlns="http://www.w3.org/1999/xhtml">John Smith, Male, Born 1990-01-01</div>'
    },
    identifier: [
      {
        use: 'usual',
        system: 'http://hospital.example.org/patients',
        value: '12345'
      }
    ],
    active: true,
    name: [
      {
        use: 'official',
        family: 'Smith',
        given: ['John', 'Michael']
      }
    ],
    gender: 'male',
    birthDate: '1990-01-01',
    telecom: [
      {
        system: 'phone',
        value: '+1-555-123-4567',
        use: 'home'
      },
      {
        system: 'email',
        value: 'john.smith@example.com',
        use: 'home'
      }
    ],
    address: [
      {
        use: 'home',
        line: ['123 Main Street'],
        city: 'Anytown',
        state: 'NY',
        postalCode: '12345',
        country: 'US'
      }
    ],
    maritalStatus: {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/v3-MaritalStatus',
          code: 'M',
          display: 'Married'
        }
      ]
    },
    contact: [
      {
        relationship: [
          {
            coding: [
              {
                system: 'http://terminology.hl7.org/CodeSystem/v2-0131',
                code: 'C',
                display: 'Emergency Contact'
              }
            ]
          }
        ],
        name: {
          family: 'Smith',
          given: ['Jane']
        },
        telecom: [
          {
            system: 'phone',
            value: '+1-555-987-6543',
            use: 'mobile'
          }
        ]
      }
    ]
  },

  /**
   * Valid Observation Resource - Should score 90-100%
   * Complete with proper coding, values, and metadata
   */
  validObservation: {
    resourceType: 'Observation',
    id: 'observation-valid-001',
    meta: {
      lastUpdated: '2023-01-15T14:30:00.000Z',
      versionId: '1',
      profile: ['http://hl7.org/fhir/StructureDefinition/vitalsigns']
    },
    text: {
      status: 'generated',
      div: '<div xmlns="http://www.w3.org/1999/xhtml">Blood pressure: 120/80 mmHg</div>'
    },
    status: 'final',
    category: [
      {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/observation-category',
            code: 'vital-signs',
            display: 'Vital Signs'
          }
        ]
      }
    ],
    code: {
      coding: [
        {
          system: 'http://loinc.org',
          code: '85354-9',
          display: 'Blood pressure panel with all children optional'
        }
      ],
      text: 'Blood pressure'
    },
    subject: {
      reference: 'Patient/patient-valid-001',
      display: 'John Smith'
    },
    effectiveDateTime: '2023-01-15T14:30:00.000Z',
    valueQuantity: {
      value: 120,
      unit: 'mm[Hg]',
      system: 'http://unitsofmeasure.org',
      code: 'mm[Hg]'
    },
    component: [
      {
        code: {
          coding: [
            {
              system: 'http://loinc.org',
              code: '8480-6',
              display: 'Systolic blood pressure'
            }
          ]
        },
        valueQuantity: {
          value: 120,
          unit: 'mm[Hg]',
          system: 'http://unitsofmeasure.org',
          code: 'mm[Hg]'
        }
      },
      {
        code: {
          coding: [
            {
              system: 'http://loinc.org',
              code: '8462-4',
              display: 'Diastolic blood pressure'
            }
          ]
        },
        valueQuantity: {
          value: 80,
          unit: 'mm[Hg]',
          system: 'http://unitsofmeasure.org',
          code: 'mm[Hg]'
        }
      }
    ],
    interpretation: [
      {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation',
            code: 'N',
            display: 'Normal'
          }
        ]
      }
    ]
  },

  /**
   * Valid Encounter Resource - Should score 90-100%
   * Complete with proper period, status, and metadata
   */
  validEncounter: {
    resourceType: 'Encounter',
    id: 'encounter-valid-001',
    meta: {
      lastUpdated: '2023-01-15T16:45:00.000Z',
      versionId: '1',
      profile: ['http://hl7.org/fhir/StructureDefinition/Encounter']
    },
    text: {
      status: 'generated',
      div: '<div xmlns="http://www.w3.org/1999/xhtml">Outpatient visit on 2023-01-15</div>'
    },
    status: 'finished',
    class: {
      system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
      code: 'AMB',
      display: 'ambulatory'
    },
    type: [
      {
        coding: [
          {
            system: 'http://www.ama-assn.org/go/cpt',
            code: '99213',
            display: 'Office or other outpatient visit for the evaluation and management of an established patient'
          }
        ]
      }
    ],
    subject: {
      reference: 'Patient/patient-valid-001',
      display: 'John Smith'
    },
    period: {
      start: '2023-01-15T09:00:00.000Z',
      end: '2023-01-15T09:30:00.000Z'
    },
    reasonCode: [
      {
        coding: [
          {
            system: 'http://snomed.info/sct',
            code: '185349003',
            display: 'Consultation for check up'
          }
        ]
      }
    ],
    serviceProvider: {
      reference: 'Organization/hospital-001',
      display: 'Example Hospital'
    }
  },

  /**
   * Valid Condition Resource - Should score 90-100%
   * Complete with proper coding, clinical status, and metadata
   */
  validCondition: {
    resourceType: 'Condition',
    id: 'condition-valid-001',
    meta: {
      lastUpdated: '2023-01-15T11:00:00.000Z',
      versionId: '1',
      profile: ['http://hl7.org/fhir/StructureDefinition/Condition']
    },
    text: {
      status: 'generated',
      div: '<div xmlns="http://www.w3.org/1999/xhtml">Essential hypertension</div>'
    },
    clinicalStatus: {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
          code: 'active',
          display: 'Active'
        }
      ]
    },
    verificationStatus: {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status',
          code: 'confirmed',
          display: 'Confirmed'
        }
      ]
    },
    category: [
      {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/condition-category',
            code: 'encounter-diagnosis',
            display: 'Encounter Diagnosis'
          }
        ]
      }
    ],
    code: {
      coding: [
        {
          system: 'http://snomed.info/sct',
          code: '38341003',
          display: 'Hypertensive disorder, systemic arterial'
        }
      ],
      text: 'Essential hypertension'
    },
    subject: {
      reference: 'Patient/patient-valid-001',
      display: 'John Smith'
    },
    onsetDateTime: '2023-01-01T00:00:00.000Z',
    recordedDate: '2023-01-15T11:00:00.000Z',
    recorder: {
      reference: 'Practitioner/practitioner-001',
      display: 'Dr. Jane Doe'
    }
  }
};

export const invalidR4TestResources = {
  /**
   * Invalid Patient Resource - Should score 20-50%
   * Missing required fields and has invalid data
   */
  invalidPatient: {
    resourceType: 'Patient',
    id: 'patient-invalid-001',
    // Missing meta field
    // Missing required name field
    gender: 'invalid-gender', // Invalid gender value
    birthDate: '2030-01-01', // Future birth date
    telecom: [
      {
        // Missing system and value
        use: 'home'
      }
    ]
  },

  /**
   * Invalid Observation Resource - Should score 20-50%
   * Missing required fields and has invalid data
   */
  invalidObservation: {
    resourceType: 'Observation',
    id: 'observation-invalid-001',
    // Missing meta field
    // Missing required status field
    // Missing required code field
    // Missing required subject field
    effectiveDateTime: 'invalid-date', // Invalid date format
    valueQuantity: {
      value: 'not-a-number', // Invalid numeric value
      unit: 'invalid-unit'
    }
  },

  /**
   * Invalid Encounter Resource - Should score 20-50%
   * Missing required fields and has invalid data
   */
  invalidEncounter: {
    resourceType: 'Encounter',
    id: 'encounter-invalid-001',
    // Missing meta field
    // Missing required status field
    // Missing required class field
    // Missing required subject field
    period: {
      start: '2023-01-15T09:30:00.000Z',
      end: '2023-01-15T09:00:00.000Z' // End before start
    }
  }
};

export const terminologyIssueTestResources = {
  /**
   * Patient with Invalid Terminology Codes - Should score 60-80%
   * Valid structure but invalid codes in terminology fields
   */
  patientWithInvalidCodes: {
    resourceType: 'Patient',
    id: 'patient-terminology-invalid-001',
    meta: {
      lastUpdated: '2023-01-15T10:30:00.000Z',
      versionId: '1'
    },
    name: [
      {
        use: 'official',
        family: 'Smith',
        given: ['John']
      }
    ],
    gender: 'invalid-gender-code', // Invalid gender code
    maritalStatus: {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/v3-MaritalStatus',
          code: 'INVALID-STATUS', // Invalid marital status code
          display: 'Invalid Status'
        }
      ]
    }
  },

  /**
   * Observation with Invalid Terminology Codes - Should score 60-80%
   * Valid structure but invalid codes in terminology fields
   */
  observationWithInvalidCodes: {
    resourceType: 'Observation',
    id: 'observation-terminology-invalid-001',
    meta: {
      lastUpdated: '2023-01-15T14:30:00.000Z',
      versionId: '1'
    },
    status: 'final',
    code: {
      coding: [
        {
          system: 'http://loinc.org',
          code: 'INVALID-LOINC-CODE', // Invalid LOINC code
          display: 'Invalid observation'
        }
      ]
    },
    subject: {
      reference: 'Patient/patient-valid-001'
    },
    effectiveDateTime: '2023-01-15T14:30:00.000Z',
    valueQuantity: {
      value: 120,
      unit: 'mm[Hg]'
    }
  }
};

export const referenceIssueTestResources = {
  /**
   * Observation with Broken References - Should score 70-90%
   * Valid structure but references to non-existent resources
   */
  observationWithBrokenReferences: {
    resourceType: 'Observation',
    id: 'observation-reference-invalid-001',
    meta: {
      lastUpdated: '2023-01-15T14:30:00.000Z',
      versionId: '1'
    },
    status: 'final',
    code: {
      coding: [
        {
          system: 'http://loinc.org',
          code: '33747-0',
          display: 'Pressure'
        }
      ]
    },
    subject: {
      reference: 'Patient/non-existent-patient', // Broken reference
      display: 'Non-existent Patient'
    },
    encounter: {
      reference: 'Encounter/non-existent-encounter' // Broken reference
    },
    effectiveDateTime: '2023-01-15T14:30:00.000Z',
    valueQuantity: {
      value: 120,
      unit: 'mm[Hg]'
    }
  },

  /**
   * Condition with Broken References - Should score 70-90%
   * Valid structure but references to non-existent resources
   */
  conditionWithBrokenReferences: {
    resourceType: 'Condition',
    id: 'condition-reference-invalid-001',
    meta: {
      lastUpdated: '2023-01-15T11:00:00.000Z',
      versionId: '1'
    },
    clinicalStatus: {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
          code: 'active'
        }
      ]
    },
    code: {
      coding: [
        {
          system: 'http://snomed.info/sct',
          code: '38341003',
          display: 'Hypertensive disorder'
        }
      ]
    },
    subject: {
      reference: 'Patient/non-existent-patient', // Broken reference
      display: 'Non-existent Patient'
    },
    onsetDateTime: '2023-01-01T00:00:00.000Z'
  }
};

/**
 * Test Resource Suite Summary
 */
export const testResourceSuite = {
  valid: validR4TestResources,
  invalid: invalidR4TestResources,
  terminologyIssues: terminologyIssueTestResources,
  referenceIssues: referenceIssueTestResources,
  
  /**
   * Get all test resources as an array
   */
  getAllResources: () => {
    return [
      ...Object.values(validR4TestResources),
      ...Object.values(invalidR4TestResources),
      ...Object.values(terminologyIssueTestResources),
      ...Object.values(referenceIssueTestResources)
    ];
  },

  /**
   * Get test resources by category
   */
  getByCategory: (category: 'valid' | 'invalid' | 'terminologyIssues' | 'referenceIssues') => {
    switch (category) {
      case 'valid':
        return Object.values(validR4TestResources);
      case 'invalid':
        return Object.values(invalidR4TestResources);
      case 'terminologyIssues':
        return Object.values(terminologyIssueTestResources);
      case 'referenceIssues':
        return Object.values(referenceIssueTestResources);
      default:
        return [];
    }
  },

  /**
   * Get expected score ranges for each category
   */
  getExpectedScoreRanges: () => {
    return {
      valid: { min: 90, max: 100, description: 'Should score 90-100%' },
      invalid: { min: 20, max: 50, description: 'Should score 20-50%' },
      terminologyIssues: { min: 60, max: 80, description: 'Should score 60-80%' },
      referenceIssues: { min: 70, max: 90, description: 'Should score 70-90%' }
    };
  }
};
