/**
 * Reference Type Extractor Unit Tests
 * 
 * Comprehensive tests for resource type extraction from various FHIR reference formats.
 * Tests relative, absolute, canonical, contained, and invalid reference formats.
 * 
 * Task 6.1: Unit tests for reference type extraction
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { 
  ReferenceTypeExtractor,
  extractResourceType,
  parseReference,
  isValidReference,
  getKnownResourceTypes,
  type ReferenceParseResult 
} from '../reference-type-extractor';

// ============================================================================
// Test Data
// ============================================================================

const TEST_REFERENCES = {
  // Relative references
  validRelative: [
    'Patient/123',
    'Observation/obs-001',
    'Organization/acme-corp',
    'Practitioner/dr-smith',
    'Patient/test-patient/_history/2',
  ],
  
  // Absolute references
  validAbsolute: [
    'https://example.com/fhir/Patient/123',
    'http://localhost:8080/fhir/Observation/obs-001',
    'https://hapi.fhir.org/baseR4/Patient/example',
    'https://server.example.com/fhir/Medication/med-123',
  ],
  
  // Canonical references
  validCanonical: [
    'http://hl7.org/fhir/StructureDefinition/Patient',
    'http://hl7.org/fhir/ValueSet/administrative-gender',
    'https://build.fhir.org/ig/HL7/fhir-ips/StructureDefinition/IPS-Patient',
    'http://hl7.org/fhir/CodeSystem/observation-status|4.0.1',
  ],
  
  // Contained references
  validContained: [
    '#patient1',
    '#medication-details',
    '#practitioner-role-001',
  ],
  
  // Invalid references
  invalid: [
    '',
    'InvalidFormat',
    'patient/123', // Lowercase resource type
    'Patient/', // Missing ID
    '/123', // Missing resource type
    'https://example.com', // URL without resource info
    '#', // Contained reference without ID
    'Patient/123/extra/parts',
  ],
};

// ============================================================================
// Test Suite
// ============================================================================

describe('ReferenceTypeExtractor', () => {
  let extractor: ReferenceTypeExtractor;

  beforeEach(() => {
    extractor = new ReferenceTypeExtractor({
      validateResourceType: true,
      allowContained: true,
      allowCanonical: true,
      extractVersion: true,
    });
  });

  // ========================================================================
  // Basic Extraction Tests
  // ========================================================================

  describe('Basic Resource Type Extraction', () => {
    it('should extract resource type from relative references', () => {
      expect(extractor.extractResourceType('Patient/123')).toBe('Patient');
      expect(extractor.extractResourceType('Observation/obs-001')).toBe('Observation');
      expect(extractor.extractResourceType('Organization/acme-corp')).toBe('Organization');
    });

    it('should extract resource type from absolute references', () => {
      expect(extractor.extractResourceType('https://example.com/fhir/Patient/123')).toBe('Patient');
      expect(extractor.extractResourceType('http://localhost:8080/fhir/Observation/obs-001')).toBe('Observation');
    });

    it('should extract resource type from canonical references', () => {
      expect(extractor.extractResourceType('http://hl7.org/fhir/StructureDefinition/Patient')).toBe('StructureDefinition');
      expect(extractor.extractResourceType('http://hl7.org/fhir/ValueSet/administrative-gender')).toBe('ValueSet');
    });

    it('should return null for contained references', () => {
      expect(extractor.extractResourceType('#patient1')).toBe(null);
      expect(extractor.extractResourceType('#medication-details')).toBe(null);
    });

    it('should return null for invalid references', () => {
      expect(extractor.extractResourceType('')).toBe(null);
      expect(extractor.extractResourceType('invalid-format')).toBe(null);
      expect(extractor.extractResourceType('patient/123')).toBe(null); // Lowercase
    });
  });

  // ========================================================================
  // Detailed Parsing Tests
  // ========================================================================

  describe('Detailed Reference Parsing', () => {
    it('should parse relative references correctly', () => {
      const result = extractor.parseReference('Patient/123');
      
      expect(result).toEqual({
        resourceType: 'Patient',
        resourceId: '123',
        referenceType: 'relative',
        isValid: true,
        originalReference: 'Patient/123',
      });
    });

    it('should parse historical references with version', () => {
      const result = extractor.parseReference('Patient/123/_history/2');
      
      expect(result).toEqual({
        resourceType: 'Patient',
        resourceId: '123',
        referenceType: 'relative',
        isValid: true,
        originalReference: 'Patient/123/_history/2',
        version: '2',
        metadata: {
          isHistorical: true,
          hasVersion: true,
        },
      });
    });

    it('should parse absolute references correctly', () => {
      const result = extractor.parseReference('https://example.com/fhir/Patient/123');
      
      expect(result.resourceType).toBe('Patient');
      expect(result.resourceId).toBe('123');
      expect(result.referenceType).toBe('absolute');
      expect(result.isValid).toBe(true);
      expect(result.baseUrl).toBe('https://example.com/fhir');
    });

    it('should parse canonical references with version', () => {
      const result = extractor.parseReference('http://hl7.org/fhir/CodeSystem/observation-status|4.0.1');
      
      expect(result.resourceType).toBe('CodeSystem');
      expect(result.referenceType).toBe('canonical');
      expect(result.isValid).toBe(true);
      expect(result.version).toBe('4.0.1');
      expect(result.metadata?.hasVersion).toBe(true);
    });

    it('should parse contained references correctly', () => {
      const result = extractor.parseReference('#patient1');
      
      expect(result).toEqual({
        resourceType: null,
        resourceId: 'patient1',
        referenceType: 'contained',
        isValid: true,
        originalReference: '#patient1',
      });
    });

    it('should handle invalid references gracefully', () => {
      const result = extractor.parseReference('invalid-format');
      
      expect(result.resourceType).toBe(null);
      expect(result.isValid).toBe(false);
      expect(result.referenceType).toBe('invalid');
    });
  });

  // ========================================================================
  // Batch Processing Tests
  // ========================================================================

  describe('Batch Processing', () => {
    it('should process multiple references', () => {
      const references = ['Patient/123', 'Observation/obs-001', 'invalid-ref'];
      const results = extractor.extractMultiple(references);
      
      expect(results).toHaveLength(3);
      expect(results[0].resourceType).toBe('Patient');
      expect(results[1].resourceType).toBe('Observation');
      expect(results[2].isValid).toBe(false);
    });

    it('should get only valid references', () => {
      const references = ['Patient/123', 'invalid-ref', 'Observation/obs-001'];
      const validRefs = extractor.getValidReferences(references);
      
      expect(validRefs).toHaveLength(2);
      expect(validRefs.every(r => r.isValid)).toBe(true);
    });

    it('should extract unique resource types', () => {
      const references = [
        'Patient/123',
        'Patient/456', 
        'Observation/obs-001',
        'Observation/obs-002',
        'Organization/acme'
      ];
      
      const uniqueTypes = extractor.getUniqueResourceTypes(references);
      
      expect(uniqueTypes).toHaveLength(3);
      expect(uniqueTypes).toContain('Patient');
      expect(uniqueTypes).toContain('Observation');
      expect(uniqueTypes).toContain('Organization');
    });

    it('should filter references by resource type', () => {
      const references = ['Patient/123', 'Observation/obs-001', 'Patient/456'];
      const patientRefs = extractor.filterByResourceType(references, 'Patient');
      
      expect(patientRefs).toHaveLength(2);
      expect(patientRefs).toEqual(['Patient/123', 'Patient/456']);
    });
  });

  // ========================================================================
  // Configuration Tests
  // ========================================================================

  describe('Configuration Options', () => {
    it('should respect allowContained option', () => {
      const restrictiveExtractor = new ReferenceTypeExtractor({
        allowContained: false
      });
      
      const result = restrictiveExtractor.parseReference('#patient1');
      expect(result.isValid).toBe(false);
    });

    it('should respect allowCanonical option', () => {
      const restrictiveExtractor = new ReferenceTypeExtractor({
        allowCanonical: false
      });
      
      const result = restrictiveExtractor.parseReference('http://hl7.org/fhir/StructureDefinition/Patient');
      expect(result.isValid).toBe(false);
    });

    it('should respect validateResourceType option', () => {
      const permissiveExtractor = new ReferenceTypeExtractor({
        validateResourceType: false
      });
      
      // Should accept unknown resource types when validation is disabled
      const result = permissiveExtractor.parseReference('UnknownResourceType/123');
      expect(result.resourceType).toBe('UnknownResourceType');
      expect(result.isValid).toBe(true);
    });
  });

  // ========================================================================
  // Edge Cases and Error Handling
  // ========================================================================

  describe('Edge Cases', () => {
    it('should handle null and undefined references', () => {
      expect(extractor.extractResourceType(null as any)).toBe(null);
      expect(extractor.extractResourceType(undefined as any)).toBe(null);
      expect(extractor.parseReference('').isValid).toBe(false);
    });

    it('should handle malformed URLs', () => {
      const result = extractor.parseReference('https://malformed url with spaces');
      expect(result.isValid).toBe(false);
      expect(result.referenceType).toBe('invalid');
    });

    it('should handle references with extra slashes', () => {
      const result = extractor.parseReference('Patient/123/extra/parts');
      expect(result.isValid).toBe(false);
    });

    it('should handle references with special characters', () => {
      const result1 = extractor.parseReference('Patient/test-patient-001');
      expect(result1.isValid).toBe(true);
      expect(result1.resourceType).toBe('Patient');
      
      const result2 = extractor.parseReference('Patient/test.patient.001');
      expect(result2.isValid).toBe(true);
      expect(result2.resourceType).toBe('Patient');
    });
  });

  // ========================================================================
  // Real-World Examples
  // ========================================================================

  describe('Real-World Examples', () => {
    it('should handle US Core Patient references', () => {
      const references = [
        'Patient/example-patient',
        'Organization/example-organization',
        'Practitioner/example-practitioner'
      ];
      
      references.forEach(ref => {
        const result = extractor.parseReference(ref);
        expect(result.isValid).toBe(true);
        expect(result.resourceType).toBeTruthy();
        expect(result.referenceType).toBe('relative');
      });
    });

    it('should handle German profile canonical references', () => {
      const canonicalRefs = [
        'https://fhir.kbv.de/StructureDefinition/KBV_PR_MIO_ULB_Patient',
        'http://fhir.de/StructureDefinition/Patient-de-basis',
        'https://www.medizininformatik-initiative.de/fhir/core/StructureDefinition/Patient'
      ];
      
      canonicalRefs.forEach(ref => {
        const result = extractor.parseReference(ref);
        expect(result.isValid).toBe(true);
        expect(result.referenceType).toBe('canonical');
        expect(result.resourceType).toBe('StructureDefinition');
      });
    });

    it('should handle FHIR server URLs correctly', () => {
      const serverRefs = [
        'https://hapi.fhir.org/baseR4/Patient/example',
        'https://r4.ontoserver.csiro.au/fhir/Patient/123',
        'https://tx.fhir.org/r4/Patient/test',
      ];
      
      serverRefs.forEach(ref => {
        const result = extractor.parseReference(ref);
        expect(result.isValid).toBe(true);
        expect(result.resourceType).toBe('Patient');
        expect(result.referenceType).toBe('absolute');
      });
    });

    it('should handle Bundle entry references', () => {
      const bundleRefs = [
        '#contained-patient',
        'Patient/bundle-patient-1',
        'urn:uuid:12345678-1234-5678-9abc-123456789012'
      ];
      
      const result1 = extractor.parseReference(bundleRefs[0]);
      expect(result1.referenceType).toBe('contained');
      expect(result1.resourceId).toBe('contained-patient');
      
      const result2 = extractor.parseReference(bundleRefs[1]);
      expect(result2.referenceType).toBe('relative');
      expect(result2.resourceType).toBe('Patient');
      
      // URN UUIDs are a special case - should be handled gracefully
      const result3 = extractor.parseReference(bundleRefs[2]);
      expect(result3).toBeDefined();
    });
  });

  // ========================================================================
  // Performance Tests
  // ========================================================================

  describe('Performance', () => {
    it('should handle large batches of references efficiently', () => {
      const references = Array.from({ length: 1000 }, (_, i) => `Patient/${i}`);
      
      const startTime = Date.now();
      const results = extractor.extractMultiple(references);
      const endTime = Date.now();
      
      expect(results).toHaveLength(1000);
      expect(results.every(r => r.resourceType === 'Patient')).toBe(true);
      expect(endTime - startTime).toBeLessThan(100); // Should complete quickly
    });

    it('should handle repeated extractions efficiently', () => {
      const reference = 'Patient/123';
      
      const startTime = Date.now();
      for (let i = 0; i < 10000; i++) {
        extractor.extractResourceType(reference);
      }
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(100); // Should be very fast
    });
  });
});

// ============================================================================
// Static Function Tests
// ============================================================================

describe('Static Utility Functions', () => {
  describe('extractResourceType', () => {
    it('should extract resource types correctly', () => {
      expect(extractResourceType('Patient/123')).toBe('Patient');
      expect(extractResourceType('Observation/obs-001')).toBe('Observation');
      expect(extractResourceType('invalid')).toBe(null);
    });
  });

  describe('parseReference', () => {
    it('should parse references correctly', () => {
      const result = parseReference('Patient/123');
      expect(result.resourceType).toBe('Patient');
      expect(result.resourceId).toBe('123');
      expect(result.isValid).toBe(true);
    });

    it('should respect options', () => {
      const result = parseReference('#patient1', { allowContained: false });
      expect(result.isValid).toBe(false);
    });
  });

  describe('isValidReference', () => {
    it('should validate references correctly', () => {
      expect(isValidReference('Patient/123')).toBe(true);
      expect(isValidReference('#patient1')).toBe(true);
      expect(isValidReference('invalid')).toBe(false);
    });
  });

  describe('getKnownResourceTypes', () => {
    it('should return array of known resource types', () => {
      const types = getKnownResourceTypes();
      
      expect(Array.isArray(types)).toBe(true);
      expect(types.length).toBeGreaterThan(100);
      expect(types).toContain('Patient');
      expect(types).toContain('Observation');
      expect(types).toContain('StructureDefinition');
    });
  });
});

// ============================================================================
// Comprehensive Format Tests
// ============================================================================

describe('Reference Format Validation', () => {
  const extractor = new ReferenceTypeExtractor({ validateResourceType: true });

  describe('Relative References', () => {
    TEST_REFERENCES.validRelative.forEach(ref => {
      it(`should validate relative reference: ${ref}`, () => {
        const result = extractor.parseReference(ref);
        expect(result.isValid).toBe(true);
        expect(result.referenceType).toBe('relative');
        expect(result.resourceType).toBeTruthy();
      });
    });
  });

  describe('Absolute References', () => {
    TEST_REFERENCES.validAbsolute.forEach(ref => {
      it(`should validate absolute reference: ${ref}`, () => {
        const result = extractor.parseReference(ref);
        expect(result.isValid).toBe(true);
        expect(result.referenceType).toBe('absolute');
        expect(result.baseUrl).toBeTruthy();
      });
    });
  });

  describe('Canonical References', () => {
    TEST_REFERENCES.validCanonical.forEach(ref => {
      it(`should validate canonical reference: ${ref}`, () => {
        const result = extractor.parseReference(ref);
        expect(result.isValid).toBe(true);
        expect(result.referenceType).toBe('canonical');
      });
    });
  });

  describe('Contained References', () => {
    TEST_REFERENCES.validContained.forEach(ref => {
      it(`should validate contained reference: ${ref}`, () => {
        const result = extractor.parseReference(ref);
        expect(result.isValid).toBe(true);
        expect(result.referenceType).toBe('contained');
        expect(result.resourceType).toBe(null);
        expect(result.resourceId).toBeTruthy();
      });
    });
  });

  describe('Invalid References', () => {
    TEST_REFERENCES.invalid.forEach(ref => {
      it(`should reject invalid reference: "${ref}"`, () => {
        const result = extractor.parseReference(ref);
        expect(result.isValid).toBe(false);
        expect(result.referenceType).toBe('invalid');
      });
    });
  });
});
