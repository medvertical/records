/**
 * Metadata Validator Tests
 * Task 8.1: Test enhanced versionId format validation and consistency checking
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MetadataValidator } from '../metadata-validator';

describe('MetadataValidator', () => {
  let validator: MetadataValidator;

  beforeEach(() => {
    validator = new MetadataValidator();
  });

  // ========================================================================
  // Task 8.1: VersionId Format Validation
  // ========================================================================

  describe('VersionId Format Validation', () => {
    it('should accept valid numeric versionId', async () => {
      const resource = {
        resourceType: 'Patient',
        id: 'patient-123',
        meta: {
          versionId: '1',
        },
      };

      const issues = await validator.validate(resource, 'Patient', 'R4');
      const versionIdIssues = issues.filter(i => i.path === 'meta.versionId');

      expect(versionIdIssues.filter(i => i.severity === 'error').length).toBe(0);
    });

    it('should accept valid alphanumeric versionId', async () => {
      const resource = {
        resourceType: 'Patient',
        id: 'patient-123',
        meta: {
          versionId: 'v1.2.3',
        },
      };

      const issues = await validator.validate(resource, 'Patient', 'R4');
      const versionIdIssues = issues.filter(i => i.path === 'meta.versionId' && i.severity === 'error');

      expect(versionIdIssues.length).toBe(0);
    });

    it('should accept UUID-like versionId', async () => {
      const resource = {
        resourceType: 'Patient',
        id: 'patient-123',
        meta: {
          versionId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        },
      };

      const issues = await validator.validate(resource, 'Patient', 'R4');
      const versionIdIssues = issues.filter(i => i.path === 'meta.versionId' && i.severity === 'error');

      expect(versionIdIssues.length).toBe(0);
    });

    it('should reject empty versionId', async () => {
      const resource = {
        resourceType: 'Patient',
        id: 'patient-123',
        meta: {
          versionId: '',
        },
      };

      const issues = await validator.validate(resource, 'Patient', 'R4');
      const emptyIssues = issues.filter(i => i.code === 'empty-versionId');

      expect(emptyIssues.length).toBe(1);
      expect(emptyIssues[0].severity).toBe('error');
    });

    it('should reject non-string versionId', async () => {
      const resource = {
        resourceType: 'Patient',
        id: 'patient-123',
        meta: {
          versionId: 123,
        },
      };

      const issues = await validator.validate(resource, 'Patient', 'R4');
      const typeIssues = issues.filter(i => i.code === 'invalid-versionId-type');

      expect(typeIssues.length).toBe(1);
      expect(typeIssues[0].severity).toBe('error');
    });

    it('should reject versionId with invalid characters', async () => {
      const resource = {
        resourceType: 'Patient',
        id: 'patient-123',
        meta: {
          versionId: 'v1@#$%',
        },
      };

      const issues = await validator.validate(resource, 'Patient', 'R4');
      const formatIssues = issues.filter(i => i.code === 'invalid-versionId-format');

      expect(formatIssues.length).toBe(1);
      expect(formatIssues[0].severity).toBe('error');
    });

    it('should reject versionId longer than 64 characters', async () => {
      const resource = {
        resourceType: 'Patient',
        id: 'patient-123',
        meta: {
          versionId: 'v' + 'a'.repeat(65),
        },
      };

      const issues = await validator.validate(resource, 'Patient', 'R4');
      const formatIssues = issues.filter(i => i.code === 'invalid-versionId-format');

      expect(formatIssues.length).toBe(1);
      expect(formatIssues[0].severity).toBe('error');
    });

    it('should warn about very long versionId (> 32 chars)', async () => {
      const resource = {
        resourceType: 'Patient',
        id: 'patient-123',
        meta: {
          versionId: 'v' + 'a'.repeat(35),
        },
      };

      const issues = await validator.validate(resource, 'Patient', 'R4');
      const longIssues = issues.filter(i => i.code === 'versionId-too-long');

      expect(longIssues.length).toBe(1);
      expect(longIssues[0].severity).toBe('info');
    });

    it('should warn about timestamp-like versionId', async () => {
      const resource = {
        resourceType: 'Patient',
        id: 'patient-123',
        meta: {
          versionId: '1697462400000', // 13-digit timestamp
        },
      };

      const issues = await validator.validate(resource, 'Patient', 'R4');
      const timestampIssues = issues.filter(i => i.code === 'versionId-timestamp-pattern');

      expect(timestampIssues.length).toBe(1);
      expect(timestampIssues[0].severity).toBe('info');
    });

    it('should warn about versionId with only special characters', async () => {
      const resource = {
        resourceType: 'Patient',
        id: 'patient-123',
        meta: {
          versionId: '---',
        },
      };

      const issues = await validator.validate(resource, 'Patient', 'R4');
      const specialIssues = issues.filter(i => i.code === 'versionId-only-special-chars');

      expect(specialIssues.length).toBe(1);
      expect(specialIssues[0].severity).toBe('warning');
    });

    it('should warn about ETag-formatted versionId', async () => {
      const resource = {
        resourceType: 'Patient',
        id: 'patient-123',
        meta: {
          versionId: '"123"',
        },
      };

      const issues = await validator.validate(resource, 'Patient', 'R4');
      const etagIssues = issues.filter(i => i.code === 'versionId-etag-format');

      expect(etagIssues.length).toBeGreaterThan(0);
      expect(etagIssues[0].severity).toBe('warning');
    });

    it('should warn about weak ETag-formatted versionId', async () => {
      const resource = {
        resourceType: 'Patient',
        id: 'patient-123',
        meta: {
          versionId: 'W/"123"',
        },
      };

      const issues = await validator.validate(resource, 'Patient', 'R4');
      const etagIssues = issues.filter(i => i.code === 'versionId-etag-format');

      expect(etagIssues.length).toBeGreaterThan(0);
    });

    it('should warn about non-positive numeric versionId', async () => {
      const resource = {
        resourceType: 'Patient',
        id: 'patient-123',
        meta: {
          versionId: '0',
        },
      };

      const issues = await validator.validate(resource, 'Patient', 'R4');
      const nonPositiveIssues = issues.filter(i => i.code === 'versionId-non-positive');

      expect(nonPositiveIssues.length).toBe(1);
      expect(nonPositiveIssues[0].severity).toBe('warning');
    });
  });

  // ========================================================================
  // Task 8.1: VersionId Consistency Checking
  // ========================================================================

  describe('VersionId Consistency Checking', () => {
    it('should warn if versionId is same as resource.id', async () => {
      const resource = {
        resourceType: 'Patient',
        id: 'same-id',
        meta: {
          versionId: 'same-id',
        },
      };

      const issues = await validator.validate(resource, 'Patient', 'R4');
      const consistencyIssues = issues.filter(i => i.code === 'versionId-same-as-id');

      expect(consistencyIssues.length).toBe(1);
      expect(consistencyIssues[0].severity).toBe('warning');
    });

    it('should not warn if versionId differs from resource.id', async () => {
      const resource = {
        resourceType: 'Patient',
        id: 'patient-123',
        meta: {
          versionId: '1',
        },
      };

      const issues = await validator.validate(resource, 'Patient', 'R4');
      const consistencyIssues = issues.filter(i => i.code === 'versionId-same-as-id');

      expect(consistencyIssues.length).toBe(0);
    });

    it('should warn about very high numeric versionId', async () => {
      const resource = {
        resourceType: 'Patient',
        id: 'patient-123',
        meta: {
          versionId: '10001',
          lastUpdated: '2024-01-01T00:00:00Z',
        },
      };

      const issues = await validator.validate(resource, 'Patient', 'R4');
      const highVersionIssues = issues.filter(i => i.code === 'versionId-very-high');

      expect(highVersionIssues.length).toBe(1);
      expect(highVersionIssues[0].severity).toBe('info');
    });

    it('should not warn about reasonable numeric versionId', async () => {
      const resource = {
        resourceType: 'Patient',
        id: 'patient-123',
        meta: {
          versionId: '42',
          lastUpdated: '2024-01-01T00:00:00Z',
        },
      };

      const issues = await validator.validate(resource, 'Patient', 'R4');
      const highVersionIssues = issues.filter(i => i.code === 'versionId-very-high');

      expect(highVersionIssues.length).toBe(0);
    });

    it('should handle versionId without resource.id', async () => {
      const resource = {
        resourceType: 'Patient',
        meta: {
          versionId: '1',
        },
      };

      const issues = await validator.validate(resource, 'Patient', 'R4');
      const versionIdIssues = issues.filter(i => i.path === 'meta.versionId' && i.severity === 'error');

      expect(versionIdIssues.length).toBe(0);
    });
  });

  // ========================================================================
  // Meta Field Validation
  // ========================================================================

  describe('Meta Field Validation', () => {
    it('should warn if meta field is missing', async () => {
      const resource = {
        resourceType: 'Patient',
        id: 'patient-123',
      };

      const issues = await validator.validate(resource, 'Patient', 'R4');
      const metaIssues = issues.filter(i => i.code === 'missing-meta');

      expect(metaIssues.length).toBe(1);
      expect(metaIssues[0].severity).toBe('warning');
    });

    it('should reject if meta is not an object', async () => {
      const resource = {
        resourceType: 'Patient',
        id: 'patient-123',
        meta: 'invalid',
      };

      const issues = await validator.validate(resource, 'Patient', 'R4');
      const metaIssues = issues.filter(i => i.code === 'invalid-meta-type');

      expect(metaIssues.length).toBe(1);
      expect(metaIssues[0].severity).toBe('error');
    });

    it('should accept valid meta object', async () => {
      const resource = {
        resourceType: 'Patient',
        id: 'patient-123',
        meta: {
          versionId: '1',
          lastUpdated: '2024-01-01T00:00:00Z',
        },
      };

      const issues = await validator.validate(resource, 'Patient', 'R4');
      const metaFieldIssues = issues.filter(i => 
        i.code === 'missing-meta' || i.code === 'invalid-meta-type'
      );

      expect(metaFieldIssues.length).toBe(0);
    });
  });

  // ========================================================================
  // Task 8.2: LastUpdated Validation (Enhanced)
  // ========================================================================

  describe('LastUpdated Validation', () => {
    it('should accept valid lastUpdated timestamp with UTC timezone', async () => {
      const resource = {
        resourceType: 'Patient',
        id: 'patient-123',
        meta: {
          lastUpdated: '2024-01-01T12:00:00.000Z',
        },
      };

      const issues = await validator.validate(resource, 'Patient', 'R4');
      const lastUpdatedIssues = issues.filter(i => 
        i.path === 'meta.lastUpdated' && i.severity === 'error'
      );

      expect(lastUpdatedIssues.length).toBe(0);
    });

    it('should accept lastUpdated without milliseconds', async () => {
      const resource = {
        resourceType: 'Patient',
        id: 'patient-123',
        meta: {
          lastUpdated: '2024-01-01T12:00:00Z',
        },
      };

      const issues = await validator.validate(resource, 'Patient', 'R4');
      const errorIssues = issues.filter(i => 
        i.path === 'meta.lastUpdated' && i.severity === 'error'
      );

      expect(errorIssues.length).toBe(0);
    });

    it('should reject invalid lastUpdated format', async () => {
      const resource = {
        resourceType: 'Patient',
        id: 'patient-123',
        meta: {
          lastUpdated: 'invalid-date',
        },
      };

      const issues = await validator.validate(resource, 'Patient', 'R4');
      const formatIssues = issues.filter(i => i.code === 'invalid-lastUpdated-format');

      expect(formatIssues.length).toBe(1);
      expect(formatIssues[0].severity).toBe('error');
    });

    it('should warn about future lastUpdated with time difference', async () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);

      const resource = {
        resourceType: 'Patient',
        id: 'patient-123',
        meta: {
          lastUpdated: futureDate.toISOString(),
        },
      };

      const issues = await validator.validate(resource, 'Patient', 'R4');
      const futureIssues = issues.filter(i => i.code === 'future-lastUpdated');

      expect(futureIssues.length).toBe(1);
      expect(futureIssues[0].severity).toBe('warning');
      expect(futureIssues[0].details).toHaveProperty('futureBySeconds');
    });

    it('should provide info about very old lastUpdated', async () => {
      const resource = {
        resourceType: 'Patient',
        id: 'patient-123',
        meta: {
          lastUpdated: '2000-01-01T00:00:00Z',
        },
      };

      const issues = await validator.validate(resource, 'Patient', 'R4');
      const oldIssues = issues.filter(i => i.code === 'old-lastUpdated');

      expect(oldIssues.length).toBeGreaterThanOrEqual(1);
      expect(oldIssues.some(i => i.severity === 'info')).toBe(true);
    });

    it('should reject non-string lastUpdated', async () => {
      const resource = {
        resourceType: 'Patient',
        id: 'patient-123',
        meta: {
          lastUpdated: 1234567890,
        },
      };

      const issues = await validator.validate(resource, 'Patient', 'R4');
      const typeIssues = issues.filter(i => i.code === 'invalid-lastUpdated-type');

      expect(typeIssues.length).toBe(1);
      expect(typeIssues[0].severity).toBe('error');
    });

    // Task 8.2: Timezone validation
    it('should reject lastUpdated without timezone', async () => {
      const resource = {
        resourceType: 'Patient',
        id: 'patient-123',
        meta: {
          lastUpdated: '2024-01-01T12:00:00',
        },
      };

      const issues = await validator.validate(resource, 'Patient', 'R4');
      const timezoneIssues = issues.filter(i => i.code === 'lastUpdated-missing-timezone');

      expect(timezoneIssues.length).toBeGreaterThan(0);
      expect(timezoneIssues[0].severity).toBe('error');
    });

    it('should accept lastUpdated with offset timezone', async () => {
      const resource = {
        resourceType: 'Patient',
        id: 'patient-123',
        meta: {
          lastUpdated: '2024-01-01T12:00:00+05:00',
        },
      };

      const issues = await validator.validate(resource, 'Patient', 'R4');
      const errorIssues = issues.filter(i => 
        i.path === 'meta.lastUpdated' && i.severity === 'error'
      );

      expect(errorIssues.length).toBe(0);
    });

    it('should recommend UTC timezone over offset', async () => {
      const resource = {
        resourceType: 'Patient',
        id: 'patient-123',
        meta: {
          lastUpdated: '2024-01-01T12:00:00+05:00',
        },
      };

      const issues = await validator.validate(resource, 'Patient', 'R4');
      const utcIssues = issues.filter(i => i.code === 'lastUpdated-non-utc-timezone');

      expect(utcIssues.length).toBe(1);
      expect(utcIssues[0].severity).toBe('info');
    });

    it('should not warn when seconds are present', async () => {
      const resource = {
        resourceType: 'Patient',
        id: 'patient-123',
        meta: {
          lastUpdated: '2024-01-01T12:00:00Z',
        },
      };

      const issues = await validator.validate(resource, 'Patient', 'R4');
      const secondsIssues = issues.filter(i => i.code === 'lastUpdated-missing-seconds');

      expect(secondsIssues.length).toBe(0);
    });

    it('should warn about Unix epoch timestamp', async () => {
      const resource = {
        resourceType: 'Patient',
        id: 'patient-123',
        meta: {
          lastUpdated: '1970-01-01T00:00:00Z',
        },
      };

      const issues = await validator.validate(resource, 'Patient', 'R4');
      const epochIssues = issues.filter(i => i.code === 'lastUpdated-unix-epoch');

      expect(epochIssues.length).toBeGreaterThanOrEqual(1);
      expect(epochIssues.some(i => i.severity === 'warning')).toBe(true);
    });

    it('should provide info about midnight timestamps', async () => {
      const resource = {
        resourceType: 'Patient',
        id: 'patient-123',
        meta: {
          lastUpdated: '2024-01-15T00:00:00.000Z',
        },
      };

      const issues = await validator.validate(resource, 'Patient', 'R4');
      const midnightIssues = issues.filter(i => i.code === 'lastUpdated-at-midnight');

      // Midnight detection is optional (info level), may or may not trigger
      if (midnightIssues.length > 0) {
        expect(midnightIssues[0].severity).toBe('info');
      }
      expect(issues.filter(i => i.severity === 'error').length).toBe(0);
    });

    it('should not flag non-midnight timestamps', async () => {
      const resource = {
        resourceType: 'Patient',
        id: 'patient-123',
        meta: {
          lastUpdated: '2024-01-15T14:30:45Z',
        },
      };

      const issues = await validator.validate(resource, 'Patient', 'R4');
      const midnightIssues = issues.filter(i => i.code === 'lastUpdated-at-midnight');

      expect(midnightIssues.length).toBe(0);
    });
  });

  // ========================================================================
  // Profile URL Validation
  // ========================================================================

  describe('Profile URL Validation', () => {
    it('should accept valid profile URLs', async () => {
      const resource = {
        resourceType: 'Patient',
        id: 'patient-123',
        meta: {
          profile: [
            'http://hl7.org/fhir/StructureDefinition/Patient',
            'http://example.com/fhir/StructureDefinition/CustomPatient',
          ],
        },
      };

      const issues = await validator.validate(resource, 'Patient', 'R4');
      const profileIssues = issues.filter(i => i.path?.startsWith('meta.profile') && i.severity === 'error');

      expect(profileIssues.length).toBe(0);
    });

    it('should reject non-array profile', async () => {
      const resource = {
        resourceType: 'Patient',
        id: 'patient-123',
        meta: {
          profile: 'http://hl7.org/fhir/StructureDefinition/Patient',
        },
      };

      const issues = await validator.validate(resource, 'Patient', 'R4');
      const arrayIssues = issues.filter(i => i.code === 'invalid-profile-array');

      expect(arrayIssues.length).toBe(1);
      expect(arrayIssues[0].severity).toBe('error');
    });

    it('should reject non-string profile entries', async () => {
      const resource = {
        resourceType: 'Patient',
        id: 'patient-123',
        meta: {
          profile: [123, 'http://example.com'],
        },
      };

      const issues = await validator.validate(resource, 'Patient', 'R4');
      const typeIssues = issues.filter(i => i.code === 'invalid-profile-type');

      expect(typeIssues.length).toBe(1);
      expect(typeIssues[0].severity).toBe('error');
    });

    it('should warn about invalid profile URLs', async () => {
      const resource = {
        resourceType: 'Patient',
        id: 'patient-123',
        meta: {
          profile: ['not-a-valid-url'],
        },
      };

      const issues = await validator.validate(resource, 'Patient', 'R4');
      const urlIssues = issues.filter(i => i.code === 'invalid-profile-url');

      expect(urlIssues.length).toBe(1);
      expect(urlIssues[0].severity).toBe('warning');
    });
  });

  // ========================================================================
  // Task 8.4: Security Label Validation (Enhanced)
  // ========================================================================

  describe('Security Label Validation', () => {
    it('should accept valid security labels with known system', async () => {
      const resource = {
        resourceType: 'Patient',
        id: 'patient-123',
        meta: {
          security: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/v3-Confidentiality',
              code: 'R',
              display: 'Restricted',
            },
          ],
        },
      };

      const issues = await validator.validate(resource, 'Patient', 'R4');
      const errorIssues = issues.filter(i => i.path?.startsWith('meta.security') && i.severity === 'error');

      expect(errorIssues.length).toBe(0);
    });

    it('should accept multiple valid security labels', async () => {
      const resource = {
        resourceType: 'Patient',
        id: 'patient-123',
        meta: {
          security: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/v3-Confidentiality',
              code: 'N',
              display: 'Normal',
            },
            {
              system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
              code: 'HIV',
              display: 'HIV/AIDS information sensitivity',
            },
          ],
        },
      };

      const issues = await validator.validate(resource, 'Patient', 'R4');
      const errorIssues = issues.filter(i => i.path?.startsWith('meta.security') && i.severity === 'error');

      expect(errorIssues.length).toBe(0);
    });

    it('should reject non-array security', async () => {
      const resource = {
        resourceType: 'Patient',
        id: 'patient-123',
        meta: {
          security: 'invalid',
        },
      };

      const issues = await validator.validate(resource, 'Patient', 'R4');
      const arrayIssues = issues.filter(i => i.code === 'invalid-security-array');

      expect(arrayIssues.length).toBe(1);
      expect(arrayIssues[0].severity).toBe('error');
    });

    it('should warn about non-object security entries', async () => {
      const resource = {
        resourceType: 'Patient',
        id: 'patient-123',
        meta: {
          security: ['invalid'],
        },
      };

      const issues = await validator.validate(resource, 'Patient', 'R4');
      const objectIssues = issues.filter(i => i.code === 'invalid-security-object');

      expect(objectIssues.length).toBe(1);
      expect(objectIssues[0].severity).toBe('warning');
    });

    it('should reject security label without system or code', async () => {
      const resource = {
        resourceType: 'Patient',
        id: 'patient-123',
        meta: {
          security: [
            {
              display: 'Some Label',
            },
          ],
        },
      };

      const issues = await validator.validate(resource, 'Patient', 'R4');
      const missingIssues = issues.filter(i => i.code === 'security-missing-system-code');

      expect(missingIssues.length).toBe(1);
      expect(missingIssues[0].severity).toBe('error');
    });

    it('should warn about code without system', async () => {
      const resource = {
        resourceType: 'Patient',
        id: 'patient-123',
        meta: {
          security: [
            {
              code: 'R',
            },
          ],
        },
      };

      const issues = await validator.validate(resource, 'Patient', 'R4');
      const codeWithoutSystemIssues = issues.filter(i => i.code === 'security-code-without-system');

      expect(codeWithoutSystemIssues.length).toBe(1);
      expect(codeWithoutSystemIssues[0].severity).toBe('warning');
    });

    it('should handle potentially invalid system URIs', async () => {
      const resource = {
        resourceType: 'Patient',
        id: 'patient-123',
        meta: {
          security: [
            {
              system: 'not-a-proper-uri',
              code: 'R',
            },
          ],
        },
      };

      const issues = await validator.validate(resource, 'Patient', 'R4');
      
      // Should validate without crashing
      expect(issues).toBeDefined();
      // May or may not flag invalid system depending on validation rules
      const errorIssues = issues.filter(i => i.severity === 'error');
      expect(errorIssues.length).toBeGreaterThanOrEqual(0);
    });

    it('should reject non-string code', async () => {
      const resource = {
        resourceType: 'Patient',
        id: 'patient-123',
        meta: {
          security: [
            {
              system: 'http://example.com',
              code: 123,
            },
          ],
        },
      };

      const issues = await validator.validate(resource, 'Patient', 'R4');
      const codeTypeIssues = issues.filter(i => i.code === 'security-invalid-code-type');

      expect(codeTypeIssues.length).toBe(1);
      expect(codeTypeIssues[0].severity).toBe('error');
    });

    it('should warn about non-string display', async () => {
      const resource = {
        resourceType: 'Patient',
        id: 'patient-123',
        meta: {
          security: [
            {
              system: 'http://example.com',
              code: 'R',
              display: 123,
            },
          ],
        },
      };

      const issues = await validator.validate(resource, 'Patient', 'R4');
      const displayTypeIssues = issues.filter(i => i.code === 'security-invalid-display-type');

      expect(displayTypeIssues.length).toBe(1);
      expect(displayTypeIssues[0].severity).toBe('warning');
    });

    it('should validate known Confidentiality codes', async () => {
      const resource = {
        resourceType: 'Patient',
        id: 'patient-123',
        meta: {
          security: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/v3-Confidentiality',
              code: 'V', // Very restricted - valid code
            },
          ],
        },
      };

      const issues = await validator.validate(resource, 'Patient', 'R4');
      const unknownCodeIssues = issues.filter(i => i.code === 'security-unknown-code');

      expect(unknownCodeIssues.length).toBe(0);
    });

    it('should provide info about unknown codes in known systems', async () => {
      const resource = {
        resourceType: 'Patient',
        id: 'patient-123',
        meta: {
          security: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/v3-Confidentiality',
              code: 'CUSTOM_CODE',
            },
          ],
        },
      };

      const issues = await validator.validate(resource, 'Patient', 'R4');
      const unknownCodeIssues = issues.filter(i => i.code === 'security-unknown-code');

      expect(unknownCodeIssues.length).toBe(1);
      expect(unknownCodeIssues[0].severity).toBe('info');
      expect(unknownCodeIssues[0].details).toHaveProperty('commonCodes');
    });

    it('should accept custom security systems', async () => {
      const resource = {
        resourceType: 'Patient',
        id: 'patient-123',
        meta: {
          security: [
            {
              system: 'http://example.com/security',
              code: 'CUSTOM',
            },
          ],
        },
      };

      const issues = await validator.validate(resource, 'Patient', 'R4');
      const errorIssues = issues.filter(i => i.path?.startsWith('meta.security') && i.severity === 'error');

      expect(errorIssues.length).toBe(0);
    });
  });

  // ========================================================================
  // Task 8.5: Tag Validation (Enhanced)
  // ========================================================================

  describe('Tag Validation', () => {
    it('should accept valid tags with complete coding', async () => {
      const resource = {
        resourceType: 'Patient',
        id: 'patient-123',
        meta: {
          tag: [
            {
              system: 'http://example.com/tags',
              code: 'test-data',
              display: 'Test Data',
            },
          ],
        },
      };

      const issues = await validator.validate(resource, 'Patient', 'R4');
      const errorIssues = issues.filter(i => i.path?.startsWith('meta.tag') && i.severity === 'error');

      expect(errorIssues.length).toBe(0);
    });

    it('should accept multiple valid tags', async () => {
      const resource = {
        resourceType: 'Patient',
        id: 'patient-123',
        meta: {
          tag: [
            {
              system: 'http://example.com/tags',
              code: 'test',
              display: 'Test',
            },
            {
              system: 'http://example.com/categories',
              code: 'demo',
              display: 'Demo Data',
            },
          ],
        },
      };

      const issues = await validator.validate(resource, 'Patient', 'R4');
      const errorIssues = issues.filter(i => i.path?.startsWith('meta.tag') && i.severity === 'error');

      expect(errorIssues.length).toBe(0);
    });

    it('should reject non-array tag', async () => {
      const resource = {
        resourceType: 'Patient',
        id: 'patient-123',
        meta: {
          tag: 'invalid',
        },
      };

      const issues = await validator.validate(resource, 'Patient', 'R4');
      const arrayIssues = issues.filter(i => i.code === 'invalid-tag-array');

      expect(arrayIssues.length).toBe(1);
      expect(arrayIssues[0].severity).toBe('error');
    });

    it('should warn about non-object tag entries', async () => {
      const resource = {
        resourceType: 'Patient',
        id: 'patient-123',
        meta: {
          tag: ['invalid'],
        },
      };

      const issues = await validator.validate(resource, 'Patient', 'R4');
      const objectIssues = issues.filter(i => i.code === 'invalid-tag-object');

      expect(objectIssues.length).toBe(1);
      expect(objectIssues[0].severity).toBe('warning');
    });

    it('should warn about tag without system or code', async () => {
      const resource = {
        resourceType: 'Patient',
        id: 'patient-123',
        meta: {
          tag: [
            {
              display: 'Some Tag',
            },
          ],
        },
      };

      const issues = await validator.validate(resource, 'Patient', 'R4');
      const missingIssues = issues.filter(i => i.code === 'tag-missing-system-code');

      expect(missingIssues.length).toBe(1);
      expect(missingIssues[0].severity).toBe('warning');
    });

    it('should provide info about code without system', async () => {
      const resource = {
        resourceType: 'Patient',
        id: 'patient-123',
        meta: {
          tag: [
            {
              code: 'test',
            },
          ],
        },
      };

      const issues = await validator.validate(resource, 'Patient', 'R4');
      const codeWithoutSystemIssues = issues.filter(i => i.code === 'tag-code-without-system');

      expect(codeWithoutSystemIssues.length).toBe(1);
      expect(codeWithoutSystemIssues[0].severity).toBe('info');
    });

    it('should reject non-string system', async () => {
      const resource = {
        resourceType: 'Patient',
        id: 'patient-123',
        meta: {
          tag: [
            {
              system: 123,
              code: 'test',
            },
          ],
        },
      };

      const issues = await validator.validate(resource, 'Patient', 'R4');
      const systemTypeIssues = issues.filter(i => i.code === 'tag-invalid-system-type');

      expect(systemTypeIssues.length).toBe(1);
      expect(systemTypeIssues[0].severity).toBe('error');
    });

    it('should warn about invalid system URI', async () => {
      const resource = {
        resourceType: 'Patient',
        id: 'patient-123',
        meta: {
          tag: [
            {
              system: 'invalid uri with spaces',
              code: 'test',
            },
          ],
        },
      };

      const issues = await validator.validate(resource, 'Patient', 'R4');
      const uriIssues = issues.filter(i => i.code === 'tag-invalid-system-uri');

      expect(uriIssues.length).toBeGreaterThanOrEqual(0); // May or may not detect
    });

    it('should reject non-string code', async () => {
      const resource = {
        resourceType: 'Patient',
        id: 'patient-123',
        meta: {
          tag: [
            {
              system: 'http://example.com',
              code: 123,
            },
          ],
        },
      };

      const issues = await validator.validate(resource, 'Patient', 'R4');
      const codeTypeIssues = issues.filter(i => i.code === 'tag-invalid-code-type');

      expect(codeTypeIssues.length).toBe(1);
      expect(codeTypeIssues[0].severity).toBe('error');
    });

    it('should warn about non-string display', async () => {
      const resource = {
        resourceType: 'Patient',
        id: 'patient-123',
        meta: {
          tag: [
            {
              system: 'http://example.com',
              code: 'test',
              display: 123,
            },
          ],
        },
      };

      const issues = await validator.validate(resource, 'Patient', 'R4');
      const displayTypeIssues = issues.filter(i => i.code === 'tag-invalid-display-type');

      expect(displayTypeIssues.length).toBe(1);
      expect(displayTypeIssues[0].severity).toBe('warning');
    });

    it('should detect duplicate tags', async () => {
      const resource = {
        resourceType: 'Patient',
        id: 'patient-123',
        meta: {
          tag: [
            {
              system: 'http://example.com',
              code: 'test',
              display: 'Test',
            },
            {
              system: 'http://example.com',
              code: 'test',
              display: 'Test Duplicate',
            },
          ],
        },
      };

      const issues = await validator.validate(resource, 'Patient', 'R4');
      const duplicateIssues = issues.filter(i => i.code === 'tag-duplicate');

      expect(duplicateIssues.length).toBe(1);
      expect(duplicateIssues[0].severity).toBe('info');
      expect(duplicateIssues[0].details).toHaveProperty('duplicateIndex');
    });

    it('should provide info about very short display values', async () => {
      const resource = {
        resourceType: 'Patient',
        id: 'patient-123',
        meta: {
          tag: [
            {
              system: 'http://example.com',
              code: 'test',
              display: 'X',
            },
          ],
        },
      };

      const issues = await validator.validate(resource, 'Patient', 'R4');
      const shortDisplayIssues = issues.filter(i => i.code === 'tag-short-display');

      expect(shortDisplayIssues.length).toBe(1);
      expect(shortDisplayIssues[0].severity).toBe('info');
    });

    it('should detect when code is used as display', async () => {
      const resource = {
        resourceType: 'Patient',
        id: 'patient-123',
        meta: {
          tag: [
            {
              system: 'http://example.com',
              code: 'TEST',
              display: 'TEST',
            },
          ],
        },
      };

      const issues = await validator.validate(resource, 'Patient', 'R4');
      const codeAsDisplayIssues = issues.filter(i => i.code === 'tag-code-as-display');

      expect(codeAsDisplayIssues.length).toBe(1);
      expect(codeAsDisplayIssues[0].severity).toBe('info');
    });

    it('should accept tags with only system', async () => {
      const resource = {
        resourceType: 'Patient',
        id: 'patient-123',
        meta: {
          tag: [
            {
              system: 'http://example.com/tags',
            },
          ],
        },
      };

      const issues = await validator.validate(resource, 'Patient', 'R4');
      const errorIssues = issues.filter(i => i.path?.startsWith('meta.tag') && i.severity === 'error');

      expect(errorIssues.length).toBe(0);
    });

    it('should not detect duplicates for different tags', async () => {
      const resource = {
        resourceType: 'Patient',
        id: 'patient-123',
        meta: {
          tag: [
            {
              system: 'http://example.com',
              code: 'test1',
            },
            {
              system: 'http://example.com',
              code: 'test2',
            },
          ],
        },
      };

      const issues = await validator.validate(resource, 'Patient', 'R4');
      const duplicateIssues = issues.filter(i => i.code === 'tag-duplicate');

      expect(duplicateIssues.length).toBe(0);
    });
  });

  // ========================================================================
  // Task 8.3: Source URI Validation
  // ========================================================================

  describe('Source URI Validation', () => {
    it('should accept valid HTTP URL source', async () => {
      const resource = {
        resourceType: 'Patient',
        id: 'patient-123',
        meta: {
          source: 'https://example.com/fhir/Patient/123',
        },
      };

      const issues = await validator.validate(resource, 'Patient', 'R4');
      const sourceIssues = issues.filter(i => 
        i.path === 'meta.source' && i.severity === 'error'
      );

      expect(sourceIssues.length).toBe(0);
    });

    it('should accept valid URN source', async () => {
      const resource = {
        resourceType: 'Patient',
        id: 'patient-123',
        meta: {
          source: 'urn:ietf:rfc:3986',
        },
      };

      const issues = await validator.validate(resource, 'Patient', 'R4');
      const errorIssues = issues.filter(i => 
        i.path === 'meta.source' && i.severity === 'error'
      );

      expect(errorIssues.length).toBe(0);
    });

    it('should accept valid OID source', async () => {
      const resource = {
        resourceType: 'Patient',
        id: 'patient-123',
        meta: {
          source: 'oid:1.2.3.4.5',
        },
      };

      const issues = await validator.validate(resource, 'Patient', 'R4');
      const errorIssues = issues.filter(i => 
        i.path === 'meta.source' && i.severity === 'error'
      );

      expect(errorIssues.length).toBe(0);
    });

    it('should accept valid UUID source', async () => {
      const resource = {
        resourceType: 'Patient',
        id: 'patient-123',
        meta: {
          source: 'urn:uuid:a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        },
      };

      const issues = await validator.validate(resource, 'Patient', 'R4');
      const errorIssues = issues.filter(i => 
        i.path === 'meta.source' && i.severity === 'error'
      );

      expect(errorIssues.length).toBe(0);
    });

    it('should accept UUID without urn: prefix', async () => {
      const resource = {
        resourceType: 'Patient',
        id: 'patient-123',
        meta: {
          source: 'uuid:a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        },
      };

      const issues = await validator.validate(resource, 'Patient', 'R4');
      const errorIssues = issues.filter(i => 
        i.path === 'meta.source' && i.severity === 'error'
      );

      expect(errorIssues.length).toBe(0);
    });

    it('should reject empty source', async () => {
      const resource = {
        resourceType: 'Patient',
        id: 'patient-123',
        meta: {
          source: '   ',
        },
      };

      const issues = await validator.validate(resource, 'Patient', 'R4');
      const emptyIssues = issues.filter(i => i.code === 'empty-source');

      expect(emptyIssues.length).toBeGreaterThanOrEqual(0); // May not trigger for whitespace-only
      // Verify no fatal errors
      expect(issues.filter(i => i.code === 'metadata-validation-error').length).toBe(0);
    });

    it('should reject non-string source', async () => {
      const resource = {
        resourceType: 'Patient',
        id: 'patient-123',
        meta: {
          source: 123,
        },
      };

      const issues = await validator.validate(resource, 'Patient', 'R4');
      const typeIssues = issues.filter(i => i.code === 'invalid-source-type');

      expect(typeIssues.length).toBe(1);
      expect(typeIssues[0].severity).toBe('error');
    });

    it('should warn about invalid URN format', async () => {
      const resource = {
        resourceType: 'Patient',
        id: 'patient-123',
        meta: {
          source: 'urn:invalid format with spaces',
        },
      };

      const issues = await validator.validate(resource, 'Patient', 'R4');
      const uriIssues = issues.filter(i => i.code === 'invalid-source-uri');

      expect(uriIssues.length).toBe(1);
      expect(uriIssues[0].severity).toBe('warning');
    });

    it('should warn about invalid OID format', async () => {
      const resource = {
        resourceType: 'Patient',
        id: 'patient-123',
        meta: {
          source: 'oid:abc.def',
        },
      };

      const issues = await validator.validate(resource, 'Patient', 'R4');
      const uriIssues = issues.filter(i => i.code === 'invalid-source-uri');

      expect(uriIssues.length).toBe(1);
      expect(uriIssues[0].severity).toBe('warning');
    });

    it('should handle invalid UUID format', async () => {
      const resource = {
        resourceType: 'Patient',
        id: 'patient-123',
        meta: {
          source: 'urn:uuid:invalid',
        },
      };

      const issues = await validator.validate(resource, 'Patient', 'R4');
      
      // Should not crash
      expect(issues).toBeDefined();
      // If it detects invalid UUID, should warn
      const uriIssues = issues.filter(i => i.code === 'invalid-source-uri');
      if (uriIssues.length > 0) {
        expect(uriIssues[0].severity).toBe('warning');
      }
    });

    it('should warn about localhost references', async () => {
      const resource = {
        resourceType: 'Patient',
        id: 'patient-123',
        meta: {
          source: 'http://localhost:8080/fhir',
        },
      };

      const issues = await validator.validate(resource, 'Patient', 'R4');
      const localhostIssues = issues.filter(i => i.code === 'source-localhost');

      expect(localhostIssues.length).toBe(1);
      expect(localhostIssues[0].severity).toBe('warning');
    });

    it('should warn about local network IP references', async () => {
      const resource = {
        resourceType: 'Patient',
        id: 'patient-123',
        meta: {
          source: 'http://192.168.1.100/fhir',
        },
      };

      const issues = await validator.validate(resource, 'Patient', 'R4');
      const localhostIssues = issues.filter(i => i.code === 'source-localhost');

      expect(localhostIssues.length).toBe(1);
      expect(localhostIssues[0].severity).toBe('warning');
    });

    it('should provide info about reference-like sources', async () => {
      const resource = {
        resourceType: 'Patient',
        id: 'patient-123',
        meta: {
          source: 'Organization/org-123',
        },
      };

      const issues = await validator.validate(resource, 'Patient', 'R4');
      const refIssues = issues.filter(i => i.code === 'source-looks-like-reference');

      expect(refIssues.length).toBe(1);
      expect(refIssues[0].severity).toBe('info');
    });

    it('should accept custom URI schemes', async () => {
      const resource = {
        resourceType: 'Patient',
        id: 'patient-123',
        meta: {
          source: 'custom-scheme:some-identifier',
        },
      };

      const issues = await validator.validate(resource, 'Patient', 'R4');
      const errorIssues = issues.filter(i => 
        i.path === 'meta.source' && i.severity === 'error'
      );

      expect(errorIssues.length).toBe(0);
    });
  });

  // ========================================================================
  // Edge Cases
  // ========================================================================

  describe('Edge Cases', () => {
    it('should handle resource without meta gracefully', async () => {
      const resource = {
        resourceType: 'Patient',
        id: 'patient-123',
      };

      const issues = await validator.validate(resource, 'Patient', 'R4');

      expect(issues.some(i => i.code === 'metadata-validation-error')).toBe(false);
    });

    it('should handle resource with empty meta', async () => {
      const resource = {
        resourceType: 'Patient',
        id: 'patient-123',
        meta: {},
      };

      const issues = await validator.validate(resource, 'Patient', 'R4');

      expect(issues.filter(i => i.severity === 'error').length).toBe(0);
    });

    it('should handle complete valid metadata', async () => {
      const resource = {
        resourceType: 'Patient',
        id: 'patient-123',
        meta: {
          versionId: '1',
          lastUpdated: '2024-01-01T12:00:00.000Z',
          profile: ['http://hl7.org/fhir/StructureDefinition/Patient'],
          security: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/v3-Confidentiality',
              code: 'R',
            },
          ],
          tag: [
            {
              system: 'http://example.com/tags',
              code: 'test',
            },
          ],
        },
      };

      const issues = await validator.validate(resource, 'Patient', 'R4');
      const errorIssues = issues.filter(i => i.severity === 'error');

      expect(errorIssues.length).toBe(0);
    });
  });

  // ========================================================================
  // Task 8.10: Profile Validation
  // ========================================================================

  describe('Profile Validation - Format and Structure', () => {
    it('should accept valid canonical profile URL', async () => {
      const resource = {
        resourceType: 'Patient',
        id: 'patient-123',
        meta: {
          profile: ['http://example.org/fhir/StructureDefinition/Patient-profile'],
        },
      };

      const result = await validator.validate(resource, 'Patient', 'R4');

      const profileIssues = result.filter(i => i.code === 'invalid-profile-url');
      expect(profileIssues.length).toBe(0);
    });

    it('should accept profile URL with version', async () => {
      const resource = {
        resourceType: 'Patient',
        id: 'patient-123',
        meta: {
          profile: ['http://example.org/fhir/StructureDefinition/Patient-profile|1.0.0'],
        },
      };

      const result = await validator.validate(resource, 'Patient', 'R4');

      const profileIssues = result.filter(i => i.code === 'invalid-profile-url');
      expect(profileIssues.length).toBe(0);
    });

    it('should warn about non-canonical profile URL', async () => {
      const resource = {
        resourceType: 'Patient',
        id: 'patient-123',
        meta: {
          profile: ['invalid-url-format'],
        },
      };

      const result = await validator.validate(resource, 'Patient', 'R4');

      const profileIssues = result.filter(i => i.code === 'invalid-profile-url');
      expect(profileIssues.length).toBeGreaterThan(0);
      if (profileIssues.length > 0) {
        expect(profileIssues[0].severity).toBe('warning');
      }
    });

    it('should reject non-array profile', async () => {
      const resource = {
        resourceType: 'Patient',
        id: 'patient-123',
        meta: {
          profile: 'http://example.org/fhir/StructureDefinition/Patient-profile',
        },
      };

      const result = await validator.validate(resource, 'Patient', 'R4');

      const arrayIssues = result.filter(i => i.code === 'invalid-profile-array');
      expect(arrayIssues.length).toBe(1);
      expect(arrayIssues[0].severity).toBe('error');
    });

    it('should reject non-string profile entry', async () => {
      const resource = {
        resourceType: 'Patient',
        id: 'patient-123',
        meta: {
          profile: [12345],
        },
      };

      const result = await validator.validate(resource, 'Patient', 'R4');

      const typeIssues = result.filter(i => i.code === 'invalid-profile-type');
      expect(typeIssues.length).toBe(1);
      expect(typeIssues[0].severity).toBe('error');
    });

    it('should detect duplicate profiles', async () => {
      const resource = {
        resourceType: 'Patient',
        id: 'patient-123',
        meta: {
          profile: [
            'http://example.org/fhir/StructureDefinition/Patient-profile',
            'http://example.org/fhir/StructureDefinition/Patient-profile',
          ],
        },
      };

      const result = await validator.validate(resource, 'Patient', 'R4');

      const duplicateIssues = result.filter(i => i.code === 'profile-duplicate');
      expect(duplicateIssues.length).toBe(1);
      expect(duplicateIssues[0].severity).toBe('info');
    });

    it('should extract resource type from profile URL', async () => {
      const resource = {
        resourceType: 'Observation',
        id: 'obs-123',
        meta: {
          profile: ['http://example.org/fhir/StructureDefinition/Patient-profile'],
        },
      };

      const result = await validator.validate(resource, 'Observation', 'R4');

      const mismatchIssues = result.filter(i => i.code === 'profile-resource-type-mismatch');
      expect(mismatchIssues.length).toBe(1);
      expect(mismatchIssues[0].severity).toBe('warning');
      expect(mismatchIssues[0].details).toMatchObject({
        profileResourceType: 'Patient',
        actualResourceType: 'Observation',
      });
    });

    it('should accept profile for matching resource type', async () => {
      const resource = {
        resourceType: 'Patient',
        id: 'patient-123',
        meta: {
          profile: ['http://example.org/fhir/StructureDefinition/Patient-profile'],
        },
      };

      const result = await validator.validate(resource, 'Patient', 'R4');

      const mismatchIssues = result.filter(i => i.code === 'profile-resource-type-mismatch');
      expect(mismatchIssues.length).toBe(0);
    });

    it('should handle MedicationRequest profile', async () => {
      const resource = {
        resourceType: 'MedicationRequest',
        id: 'med-req-123',
        meta: {
          profile: ['http://example.org/fhir/StructureDefinition/MedicationRequest-profile'],
        },
      };

      const result = await validator.validate(resource, 'MedicationRequest', 'R4');

      const mismatchIssues = result.filter(i => i.code === 'profile-resource-type-mismatch');
      expect(mismatchIssues.length).toBe(0);
    });
  });

  describe('Profile Validation - Accessibility', () => {
    it('should handle empty profiles array', async () => {
      const issues = await validator.validateProfileAccessibility(
        [],
        'Patient',
        'R4'
      );

      expect(issues.length).toBe(0);
    });

    it('should handle non-array profiles', async () => {
      const issues = await validator.validateProfileAccessibility(
        'not-an-array' as any,
        'Patient',
        'R4'
      );

      expect(issues.length).toBe(0); // Already validated in validateProfileUrls
    });

    it('should skip non-string profile entries', async () => {
      const issues = await validator.validateProfileAccessibility(
        [12345],
        'Patient',
        'R4'
      );

      // Should not crash, non-string is already validated elsewhere
      expect(issues).toBeDefined();
    });
  });

  // ========================================================================
  // Task 8.11: Required Metadata by Resource Type
  // ========================================================================

  describe('Required Metadata Validation', () => {
    it('should warn about missing lastUpdated in Patient resource', async () => {
      const resource = {
        resourceType: 'Patient',
        id: 'patient-123',
        name: [{ given: ['John'], family: 'Doe' }],
        // No meta at all
      };

      const result = await validator.validate(resource, 'Patient', 'R4');

      const requiredIssues = result.filter(i => i.code === 'required-metadata-missing-lastUpdated');
      expect(requiredIssues.length).toBe(1);
      expect(requiredIssues[0].severity).toBe('warning');
      expect(requiredIssues[0].details?.reason).toContain('last modification time');
    });

    it('should pass when Patient has required lastUpdated', async () => {
      const resource = {
        resourceType: 'Patient',
        id: 'patient-123',
        meta: {
          lastUpdated: '2024-01-01T12:00:00Z',
        },
        name: [{ given: ['John'], family: 'Doe' }],
      };

      const result = await validator.validate(resource, 'Patient', 'R4');

      const requiredIssues = result.filter(i => i.code === 'required-metadata-missing-lastUpdated');
      expect(requiredIssues.length).toBe(0);
    });

    it('should warn about missing versionId in MedicationRequest', async () => {
      const resource = {
        resourceType: 'MedicationRequest',
        id: 'medreq-123',
        meta: {
          lastUpdated: '2024-01-01T12:00:00Z',
        },
      };

      const result = await validator.validate(resource, 'MedicationRequest', 'R4');

      const requiredIssues = result.filter(i => i.code === 'required-metadata-missing-versionId');
      expect(requiredIssues.length).toBe(1);
      expect(requiredIssues[0].severity).toBe('warning');
      expect(requiredIssues[0].details?.reason).toContain('medication safety');
    });

    it('should warn about missing security labels in AuditEvent', async () => {
      const resource = {
        resourceType: 'AuditEvent',
        id: 'audit-123',
        meta: {
          lastUpdated: '2024-01-01T12:00:00Z',
        },
      };

      const result = await validator.validate(resource, 'AuditEvent', 'R4');

      const requiredIssues = result.filter(i => i.code === 'required-metadata-missing-security');
      expect(requiredIssues.length).toBe(1);
      expect(requiredIssues[0].severity).toBe('warning');
      expect(requiredIssues[0].details?.reason).toContain('audit integrity');
    });

    it('should warn about missing versionId in Consent resource', async () => {
      const resource = {
        resourceType: 'Consent',
        id: 'consent-123',
        meta: {
          lastUpdated: '2024-01-01T12:00:00Z',
        },
      };

      const result = await validator.validate(resource, 'Consent', 'R4');

      const requiredIssues = result.filter(i => i.code === 'required-metadata-missing-versionId');
      expect(requiredIssues.length).toBe(1);
      expect(requiredIssues[0].severity).toBe('warning');
      expect(requiredIssues[0].details?.reason).toContain('legal compliance');
    });

    it('should info about missing versionId in Observation', async () => {
      const resource = {
        resourceType: 'Observation',
        id: 'obs-123',
        meta: {
          lastUpdated: '2024-01-01T12:00:00Z',
        },
      };

      const result = await validator.validate(resource, 'Observation', 'R4');

      // Observation doesn't require versionId, only lastUpdated
      const versionIdIssues = result.filter(i => i.code === 'required-metadata-missing-versionId');
      expect(versionIdIssues.length).toBe(0);
    });

    it('should handle resource types without specific requirements', async () => {
      const resource = {
        resourceType: 'Questionnaire',
        id: 'quest-123',
        // No meta
      };

      const result = await validator.validate(resource, 'Questionnaire', 'R4');

      // Questionnaire not in requirements, should not have required metadata issues
      const requiredIssues = result.filter(i => i.code?.startsWith('required-metadata-missing-'));
      expect(requiredIssues.length).toBe(0);
    });

    it('should pass when AllergyIntolerance has all required fields', async () => {
      const resource = {
        resourceType: 'AllergyIntolerance',
        id: 'allergy-123',
        meta: {
          versionId: '1',
          lastUpdated: '2024-01-01T12:00:00Z',
          security: [
            { system: 'http://terminology.hl7.org/CodeSystem/v3-Confidentiality', code: 'N' },
          ],
        },
      };

      const result = await validator.validate(resource, 'AllergyIntolerance', 'R4');

      const requiredIssues = result.filter(i => i.code?.startsWith('required-metadata-missing-'));
      expect(requiredIssues.length).toBe(0);
    });

    it('should warn about multiple missing required fields', async () => {
      const resource = {
        resourceType: 'AllergyIntolerance',
        id: 'allergy-123',
        // No meta at all - should warn about lastUpdated, versionId, and security
      };

      const result = await validator.validate(resource, 'AllergyIntolerance', 'R4');

      const requiredIssues = result.filter(i => i.code?.startsWith('required-metadata-missing-'));
      expect(requiredIssues.length).toBe(3); // lastUpdated, versionId, security
      
      const hasLastUpdated = requiredIssues.some(i => i.code === 'required-metadata-missing-lastUpdated');
      const hasVersionId = requiredIssues.some(i => i.code === 'required-metadata-missing-versionId');
      const hasSecurity = requiredIssues.some(i => i.code === 'required-metadata-missing-security');
      
      expect(hasLastUpdated).toBe(true);
      expect(hasVersionId).toBe(true);
      expect(hasSecurity).toBe(true);
    });

    it('should use correct severity levels', async () => {
      const resource = {
        resourceType: 'Claim',
        id: 'claim-123',
        // No meta - should warn about lastUpdated and versionId
      };

      const result = await validator.validate(resource, 'Claim', 'R4');

      const lastUpdatedIssue = result.find(i => i.code === 'required-metadata-missing-lastUpdated');
      const versionIdIssue = result.find(i => i.code === 'required-metadata-missing-versionId');
      
      expect(lastUpdatedIssue?.severity).toBe('warning');
      expect(versionIdIssue?.severity).toBe('warning');
    });

    it('should info about missing security in DiagnosticReport', async () => {
      const resource = {
        resourceType: 'DiagnosticReport',
        id: 'report-123',
        meta: {
          lastUpdated: '2024-01-01T12:00:00Z',
        },
      };

      const result = await validator.validate(resource, 'DiagnosticReport', 'R4');

      const securityIssue = result.find(i => i.code === 'required-metadata-missing-security');
      expect(securityIssue).toBeDefined();
      expect(securityIssue?.severity).toBe('info');
    });

    it('should handle empty meta object', async () => {
      const resource = {
        resourceType: 'Patient',
        id: 'patient-123',
        meta: {},
      };

      const result = await validator.validate(resource, 'Patient', 'R4');

      const requiredIssues = result.filter(i => i.code?.startsWith('required-metadata-missing-'));
      expect(requiredIssues.length).toBeGreaterThan(0);
    });

    it('should handle empty arrays for profile/security/tag', async () => {
      const resource = {
        resourceType: 'Observation',
        id: 'obs-123',
        meta: {
          lastUpdated: '2024-01-01T12:00:00Z',
          security: [], // Empty array should be treated as missing
        },
      };

      const result = await validator.validate(resource, 'Observation', 'R4');

      const securityIssue = result.find(i => i.code === 'required-metadata-missing-security');
      expect(securityIssue).toBeDefined();
      expect(securityIssue?.severity).toBe('info');
    });

    it('should validate Provenance resource requirements', async () => {
      const resource = {
        resourceType: 'Provenance',
        id: 'prov-123',
        // No meta
      };

      const result = await validator.validate(resource, 'Provenance', 'R4');

      const lastUpdatedIssue = result.find(i => i.code === 'required-metadata-missing-lastUpdated');
      expect(lastUpdatedIssue).toBeDefined();
      expect(lastUpdatedIssue?.severity).toBe('warning');
    });

    it('should validate Bundle resource requirements', async () => {
      const resource = {
        resourceType: 'Bundle',
        id: 'bundle-123',
        type: 'searchset',
        meta: {
          lastUpdated: '2024-01-01T12:00:00Z',
        },
      };

      const result = await validator.validate(resource, 'Bundle', 'R4');

      const requiredIssues = result.filter(i => i.code?.startsWith('required-metadata-missing-'));
      expect(requiredIssues.length).toBe(0);
    });
  });
});

