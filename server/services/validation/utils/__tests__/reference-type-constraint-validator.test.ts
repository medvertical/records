/**
 * Reference Type Constraint Validator Unit Tests
 * 
 * Tests for validating references against StructureDefinition type constraints.
 * Ensures references point to allowed resource types for each field.
 * 
 * Task 6.2: Unit tests for reference type constraint validation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { 
  ReferenceTypeConstraintValidator,
  REFERENCE_TYPE_CONSTRAINTS,
  getReferenceTypeConstraintValidator,
  resetReferenceTypeConstraintValidator,
  type ReferenceTypeConstraint 
} from '../reference-type-constraint-validator';

// ============================================================================
// Test Suite
// ============================================================================

describe('ReferenceTypeConstraintValidator', () => {
  let validator: ReferenceTypeConstraintValidator;

  beforeEach(() => {
    resetReferenceTypeConstraintValidator();
    validator = getReferenceTypeConstraintValidator();
  });

  // ========================================================================
  // Basic Validation Tests
  // ========================================================================

  describe('Basic Validation', () => {
    it('should validate correct Patient.managingOrganization reference', () => {
      const result = validator.validateReferenceType(
        'Organization/acme-corp',
        'Patient',
        'managingOrganization'
      );

      expect(result.isValid).toBe(true);
      expect(result.actualType).toBe('Organization');
      expect(result.expectedTypes).toContain('Organization');
    });

    it('should reject incorrect Patient.managingOrganization reference', () => {
      const result = validator.validateReferenceType(
        'Patient/123',
        'Patient',
        'managingOrganization'
      );

      expect(result.isValid).toBe(false);
      expect(result.severity).toBe('error');
      expect(result.code).toBe('reference-type-mismatch');
      expect(result.actualType).toBe('Patient');
      expect(result.expectedTypes).toContain('Organization');
    });

    it('should validate correct Observation.subject reference to Patient', () => {
      const result = validator.validateReferenceType(
        'Patient/example-patient',
        'Observation',
        'subject'
      );

      expect(result.isValid).toBe(true);
      expect(result.actualType).toBe('Patient');
      expect(result.expectedTypes).toContain('Patient');
    });

    it('should validate correct Observation.subject reference to Group', () => {
      const result = validator.validateReferenceType(
        'Group/example-group',
        'Observation',
        'subject'
      );

      expect(result.isValid).toBe(true);
      expect(result.actualType).toBe('Group');
      expect(result.expectedTypes).toContain('Group');
    });

    it('should reject incorrect Observation.subject reference', () => {
      const result = validator.validateReferenceType(
        'Organization/acme',
        'Observation',
        'subject'
      );

      expect(result.isValid).toBe(false);
      expect(result.severity).toBe('error');
      expect(result.actualType).toBe('Organization');
      expect(result.expectedTypes).not.toContain('Organization');
    });
  });

  // ========================================================================
  // Multiple Allowed Types Tests
  // ========================================================================

  describe('Multiple Allowed Types', () => {
    it('should accept Patient.generalPractitioner as Practitioner', () => {
      const result = validator.validateReferenceType(
        'Practitioner/dr-smith',
        'Patient',
        'generalPractitioner'
      );

      expect(result.isValid).toBe(true);
      expect(result.actualType).toBe('Practitioner');
    });

    it('should accept Patient.generalPractitioner as PractitionerRole', () => {
      const result = validator.validateReferenceType(
        'PractitionerRole/role-001',
        'Patient',
        'generalPractitioner'
      );

      expect(result.isValid).toBe(true);
      expect(result.actualType).toBe('PractitionerRole');
    });

    it('should accept Patient.generalPractitioner as Organization', () => {
      const result = validator.validateReferenceType(
        'Organization/acme',
        'Patient',
        'generalPractitioner'
      );

      expect(result.isValid).toBe(true);
      expect(result.actualType).toBe('Organization');
    });

    it('should reject invalid type for Patient.generalPractitioner', () => {
      const result = validator.validateReferenceType(
        'Patient/123',
        'Patient',
        'generalPractitioner'
      );

      expect(result.isValid).toBe(false);
      expect(result.actualType).toBe('Patient');
    });
  });

  // ========================================================================
  // Absolute and Canonical Reference Tests
  // ========================================================================

  describe('Absolute and Canonical References', () => {
    it('should validate absolute URL references', () => {
      const result = validator.validateReferenceType(
        'https://example.com/fhir/Organization/acme',
        'Patient',
        'managingOrganization'
      );

      expect(result.isValid).toBe(true);
      expect(result.actualType).toBe('Organization');
    });

    it('should validate canonical URL references', () => {
      const result = validator.validateReferenceType(
        'http://hl7.org/fhir/StructureDefinition/Patient',
        'StructureDefinition',
        'baseDefinition'
      );

      // This should be valid even without explicit constraints
      expect(result.isValid).toBe(true);
    });
  });

  // ========================================================================
  // Contained Reference Tests
  // ========================================================================

  describe('Contained References', () => {
    it('should handle contained references appropriately', () => {
      const result = validator.validateReferenceType(
        '#patient1',
        'Observation',
        'subject'
      );

      // Contained references can't be type-validated without resolution
      expect(result.isValid).toBe(true);
      expect(result.code).toBe('contained-reference-type-unknown');
      expect(result.severity).toBe('info');
    });
  });

  // ========================================================================
  // Unconstrained Fields Tests
  // ========================================================================

  describe('Unconstrained Fields', () => {
    it('should allow any reference when no constraints exist', () => {
      const result = validator.validateReferenceType(
        'Patient/123',
        'UnknownResourceType',
        'someField'
      );

      expect(result.isValid).toBe(true);
      expect(result.severity).toBe('info');
    });

    it('should allow any reference for unconstrained fields', () => {
      const result = validator.validateReferenceType(
        'Organization/acme',
        'Patient',
        'unconstrainedField'
      );

      expect(result.isValid).toBe(true);
      expect(result.severity).toBe('info');
    });
  });

  // ========================================================================
  // Reference Object Validation Tests
  // ========================================================================

  describe('Reference Object Validation', () => {
    it('should validate reference object with matching type', () => {
      const refObject = {
        reference: 'Organization/acme',
        type: 'Organization',
        display: 'Acme Corporation'
      };

      const result = validator.validateReferenceObject(
        refObject,
        'Patient',
        'managingOrganization'
      );

      expect(result.isValid).toBe(true);
      expect(result.actualType).toBe('Organization');
    });

    it('should reject reference object with mismatched type', () => {
      const refObject = {
        reference: 'Organization/acme',
        type: 'Patient', // Wrong type declared
        display: 'Acme Corporation'
      };

      const result = validator.validateReferenceObject(
        refObject,
        'Patient',
        'managingOrganization'
      );

      expect(result.isValid).toBe(false);
      expect(result.severity).toBe('error');
      expect(result.code).toBe('reference-type-mismatch');
    });

    it('should validate reference object without type property', () => {
      const refObject = {
        reference: 'Organization/acme',
        display: 'Acme Corporation'
      };

      const result = validator.validateReferenceObject(
        refObject,
        'Patient',
        'managingOrganization'
      );

      expect(result.isValid).toBe(true);
      expect(result.actualType).toBe('Organization');
    });
  });

  // ========================================================================
  // Constraint Management Tests
  // ========================================================================

  describe('Constraint Management', () => {
    it('should get constraints for a field', () => {
      const constraints = validator.getConstraintsForField('Patient', 'managingOrganization');
      
      expect(constraints).toBeDefined();
      expect(constraints?.targetTypes).toContain('Organization');
      expect(constraints?.fieldPath).toBe('managingOrganization');
    });

    it('should return null for non-existent field', () => {
      const constraints = validator.getConstraintsForField('Patient', 'nonExistentField');
      expect(constraints).toBe(null);
    });

    it('should check if field has constraints', () => {
      expect(validator.hasConstraints('Patient', 'managingOrganization')).toBe(true);
      expect(validator.hasConstraints('Patient', 'nonExistentField')).toBe(false);
      expect(validator.hasConstraints('UnknownResource', 'someField')).toBe(false);
    });

    it('should get all constrained fields for a resource type', () => {
      const fields = validator.getConstrainedFields('Patient');
      
      expect(Array.isArray(fields)).toBe(true);
      expect(fields.length).toBeGreaterThan(0);
      expect(fields).toContain('managingOrganization');
      expect(fields).toContain('generalPractitioner');
    });

    it('should allow adding custom constraints', () => {
      const customConstraint: ReferenceTypeConstraint = {
        fieldPath: 'customField',
        targetTypes: ['CustomType'],
        required: true
      };

      validator.setConstraints('CustomResource', 'customField', customConstraint);
      
      expect(validator.hasConstraints('CustomResource', 'customField')).toBe(true);
      const retrieved = validator.getConstraintsForField('CustomResource', 'customField');
      expect(retrieved?.targetTypes).toContain('CustomType');
    });
  });

  // ========================================================================
  // Batch Validation Tests
  // ========================================================================

  describe('Batch Validation', () => {
    it('should validate multiple references', () => {
      const references = [
        { reference: 'Organization/acme', fieldPath: 'managingOrganization' },
        { reference: 'Practitioner/dr-smith', fieldPath: 'generalPractitioner' },
        { reference: 'Patient/invalid', fieldPath: 'managingOrganization' }, // Invalid
      ];

      const results = validator.validateMultipleReferences(references, 'Patient');
      
      expect(results).toHaveLength(3);
      expect(results[0].isValid).toBe(true);
      expect(results[1].isValid).toBe(true);
      expect(results[2].isValid).toBe(false);
    });

    it('should handle empty reference array', () => {
      const results = validator.validateMultipleReferences([], 'Patient');
      expect(results).toHaveLength(0);
    });
  });

  // ========================================================================
  // Real-World Scenarios
  // ========================================================================

  describe('Real-World Scenarios', () => {
    it('should validate Condition.subject must be Patient or Group', () => {
      const validPatient = validator.validateReferenceType('Patient/123', 'Condition', 'subject');
      const validGroup = validator.validateReferenceType('Group/family', 'Condition', 'subject');
      const invalid = validator.validateReferenceType('Organization/acme', 'Condition', 'subject');

      expect(validPatient.isValid).toBe(true);
      expect(validGroup.isValid).toBe(true);
      expect(invalid.isValid).toBe(false);
    });

    it('should validate Encounter.serviceProvider must be Organization', () => {
      const valid = validator.validateReferenceType('Organization/hospital', 'Encounter', 'serviceProvider');
      const invalid = validator.validateReferenceType('Patient/123', 'Encounter', 'serviceProvider');

      expect(valid.isValid).toBe(true);
      expect(invalid.isValid).toBe(false);
      expect(invalid.message).toContain('Organization');
    });

    it('should validate DiagnosticReport.result must be Observation', () => {
      const valid = validator.validateReferenceType('Observation/lab-result-1', 'DiagnosticReport', 'result');
      const invalid = validator.validateReferenceType('Patient/123', 'DiagnosticReport', 'result');

      expect(valid.isValid).toBe(true);
      expect(invalid.isValid).toBe(false);
    });

    it('should allow multiple valid types for Observation.performer', () => {
      const validPractitioner = validator.validateReferenceType('Practitioner/dr-jones', 'Observation', 'performer');
      const validOrganization = validator.validateReferenceType('Organization/lab', 'Observation', 'performer');
      const validPatient = validator.validateReferenceType('Patient/self-reported', 'Observation', 'performer');
      const invalid = validator.validateReferenceType('Medication/med-123', 'Observation', 'performer');

      expect(validPractitioner.isValid).toBe(true);
      expect(validOrganization.isValid).toBe(true);
      expect(validPatient.isValid).toBe(true);
      expect(invalid.isValid).toBe(false);
    });
  });

  // ========================================================================
  // Edge Cases
  // ========================================================================

  describe('Edge Cases', () => {
    it('should handle invalid reference format gracefully', () => {
      const result = validator.validateReferenceType(
        'invalid-format',
        'Patient',
        'managingOrganization'
      );

      expect(result.isValid).toBe(false);
      expect(result.code).toBe('invalid-reference-format');
    });

    it('should handle empty reference gracefully', () => {
      const result = validator.validateReferenceType(
        '',
        'Patient',
        'managingOrganization'
      );

      expect(result.isValid).toBe(false);
    });

    it('should handle references without extractable type', () => {
      const result = validator.validateReferenceType(
        'https://example.com/unknown-path',
        'Patient',
        'managingOrganization'
      );

      // Should fail due to unable to extract type
      expect(result.isValid).toBe(false);
    });
  });

  // ========================================================================
  // Performance Tests
  // ========================================================================

  describe('Performance', () => {
    it('should handle many validations efficiently', () => {
      const startTime = Date.now();

      for (let i = 0; i < 1000; i++) {
        validator.validateReferenceType('Organization/org-' + i, 'Patient', 'managingOrganization');
      }

      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(500); // Should be very fast
    });

    it('should handle batch validation efficiently', () => {
      const references = Array.from({ length: 100 }, (_, i) => ({
        reference: `Organization/org-${i}`,
        fieldPath: 'managingOrganization'
      }));

      const startTime = Date.now();
      const results = validator.validateMultipleReferences(references, 'Patient');
      const endTime = Date.now();

      expect(results).toHaveLength(100);
      expect(results.every(r => r.isValid)).toBe(true);
      expect(endTime - startTime).toBeLessThan(100);
    });
  });
});

// ============================================================================
// Constraint Configuration Tests
// ============================================================================

describe('Reference Type Constraints Configuration', () => {
  it('should have constraints defined for common resource types', () => {
    expect(REFERENCE_TYPE_CONSTRAINTS.Patient).toBeDefined();
    expect(REFERENCE_TYPE_CONSTRAINTS.Observation).toBeDefined();
    expect(REFERENCE_TYPE_CONSTRAINTS.Condition).toBeDefined();
    expect(REFERENCE_TYPE_CONSTRAINTS.Encounter).toBeDefined();
  });

  it('should have correct constraints for Patient fields', () => {
    const patientConstraints = REFERENCE_TYPE_CONSTRAINTS.Patient;
    
    expect(patientConstraints.managingOrganization.targetTypes).toEqual(['Organization']);
    expect(patientConstraints.generalPractitioner.targetTypes).toContain('Practitioner');
    expect(patientConstraints.generalPractitioner.targetTypes).toContain('PractitionerRole');
    expect(patientConstraints.generalPractitioner.targetTypes).toContain('Organization');
  });

  it('should have correct constraints for Observation fields', () => {
    const observationConstraints = REFERENCE_TYPE_CONSTRAINTS.Observation;
    
    expect(observationConstraints.subject.targetTypes).toContain('Patient');
    expect(observationConstraints.subject.targetTypes).toContain('Group');
    expect(observationConstraints.encounter.targetTypes).toEqual(['Encounter']);
    expect(observationConstraints.specimen.targetTypes).toEqual(['Specimen']);
  });

  it('should have correct constraints for Condition fields', () => {
    const conditionConstraints = REFERENCE_TYPE_CONSTRAINTS.Condition;
    
    expect(conditionConstraints.subject.targetTypes).toContain('Patient');
    expect(conditionConstraints.subject.required).toBe(true);
    expect(conditionConstraints.encounter.targetTypes).toEqual(['Encounter']);
  });
});

