import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { 
  validationResultsPerAspect, 
  validationMessages, 
  validationMessageGroups 
} from '../../../../shared/schema-validation-per-aspect';
import { fhirServers } from '../../../../shared/schema';
import { ValidationGroupsRepository } from '../../../repositories/validation-groups-repository';
import { eq } from 'drizzle-orm';
import { generateSettingsSnapshotHash, generateMessageSignature } from '../../../db/seed/validation-fixtures';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/records_dev',
});

const db = drizzle(pool);

describe('Validation Groups API - Integration Tests', () => {
  let testServerId: number;
  let testSignature1: string;
  let testSignature2: string;
  
  beforeAll(async () => {
    // Create test server
    const [server] = await db.insert(fhirServers).values({
      name: 'Test Integration Server',
      url: 'http://test-integration.local/fhir',
      isActive: true,
    }).returning();
    
    testServerId = server.id;
    
    const settingsHash = generateSettingsSnapshotHash({
      structural: { enabled: true },
      profile: { enabled: true },
      terminology: { enabled: true },
      reference: { enabled: true },
      businessRule: { enabled: true },
      metadata: { enabled: true },
    });
    
    // Create test validation results and messages
    // Scenario 1: Structural error - missing name
    const [result1] = await db.insert(validationResultsPerAspect).values({
      serverId: testServerId,
      resourceType: 'Patient',
      fhirId: 'test-pat-001',
      aspect: 'structural',
      isValid: false,
      errorCount: 1,
      warningCount: 0,
      informationCount: 0,
      score: 0,
      settingsSnapshotHash: settingsHash,
      durationMs: 50,
      validationEngineVersion: '1.0.0',
      detailedResult: {},
    }).returning();
    
    testSignature1 = generateMessageSignature(
      'structural',
      'error',
      'required',
      'patient.name',
      'dom-6',
      'patient.name: minimum required = 1, but only found 0'
    );
    
    await db.insert(validationMessages).values({
      validationResultId: result1.id,
      serverId: testServerId,
      resourceType: 'Patient',
      fhirId: 'test-pat-001',
      aspect: 'structural',
      severity: 'error',
      code: 'required',
      canonicalPath: 'patient.name',
      text: 'Patient.name: minimum required = 1, but only found 0',
      normalizedText: 'patient.name: minimum required = 1, but only found 0',
      ruleId: 'dom-6',
      signature: testSignature1,
      signatureVersion: 1,
    });
    
    // Create second patient with same error
    const [result2] = await db.insert(validationResultsPerAspect).values({
      serverId: testServerId,
      resourceType: 'Patient',
      fhirId: 'test-pat-002',
      aspect: 'structural',
      isValid: false,
      errorCount: 1,
      warningCount: 0,
      informationCount: 0,
      score: 0,
      settingsSnapshotHash: settingsHash,
      durationMs: 50,
      validationEngineVersion: '1.0.0',
      detailedResult: {},
    }).returning();
    
    await db.insert(validationMessages).values({
      validationResultId: result2.id,
      serverId: testServerId,
      resourceType: 'Patient',
      fhirId: 'test-pat-002',
      aspect: 'structural',
      severity: 'error',
      code: 'required',
      canonicalPath: 'patient.name',
      text: 'Patient.name: minimum required = 1, but only found 0',
      normalizedText: 'patient.name: minimum required = 1, but only found 0',
      ruleId: 'dom-6',
      signature: testSignature1,
      signatureVersion: 1,
    });
    
    // Scenario 2: Terminology warning - different signature
    const [result3] = await db.insert(validationResultsPerAspect).values({
      serverId: testServerId,
      resourceType: 'Observation',
      fhirId: 'test-obs-001',
      aspect: 'terminology',
      isValid: true,
      errorCount: 0,
      warningCount: 1,
      informationCount: 0,
      score: 90,
      settingsSnapshotHash: settingsHash,
      durationMs: 200,
      validationEngineVersion: '1.0.0',
      detailedResult: {},
    }).returning();
    
    testSignature2 = generateMessageSignature(
      'terminology',
      'warning',
      'code-unknown',
      'observation.code.coding.code',
      undefined,
      'the code "99999-9" is not found in the loinc value set'
    );
    
    await db.insert(validationMessages).values({
      validationResultId: result3.id,
      serverId: testServerId,
      resourceType: 'Observation',
      fhirId: 'test-obs-001',
      aspect: 'terminology',
      severity: 'warning',
      code: 'code-unknown',
      canonicalPath: 'observation.code.coding.code',
      text: 'The code "99999-9" is not found in the LOINC value set',
      normalizedText: 'the code "99999-9" is not found in the loinc value set',
      signature: testSignature2,
      signatureVersion: 1,
    });
    
    // Create message groups
    await db.insert(validationMessageGroups).values([
      {
        serverId: testServerId,
        signature: testSignature1,
        signatureVersion: 1,
        aspect: 'structural',
        severity: 'error',
        code: 'required',
        canonicalPath: 'patient.name',
        sampleText: 'Patient.name: minimum required = 1, but only found 0',
        totalResources: 2,
        firstSeenAt: new Date(),
        lastSeenAt: new Date(),
      },
      {
        serverId: testServerId,
        signature: testSignature2,
        signatureVersion: 1,
        aspect: 'terminology',
        severity: 'warning',
        code: 'code-unknown',
        canonicalPath: 'observation.code.coding.code',
        sampleText: 'The code "99999-9" is not found in the LOINC value set',
        totalResources: 1,
        firstSeenAt: new Date(),
        lastSeenAt: new Date(),
      },
    ]);
  });
  
  afterAll(async () => {
    // Cleanup test data
    await db.delete(validationMessages).where(eq(validationMessages.serverId, testServerId));
    await db.delete(validationResultsPerAspect).where(eq(validationResultsPerAspect.serverId, testServerId));
    await db.delete(validationMessageGroups).where(eq(validationMessageGroups.serverId, testServerId));
    await db.delete(fhirServers).where(eq(fhirServers.id, testServerId));
    await pool.end();
  });
  
  describe('getValidationGroups', () => {
    it('should return all groups for a server', async () => {
      const result = await ValidationGroupsRepository.getValidationGroups(
        { serverId: testServerId },
        { page: 1, size: 25 }
      );
      
      expect(result.groups).toHaveLength(2);
      expect(result.total).toBe(2);
    });
    
    it('should filter by aspect', async () => {
      const result = await ValidationGroupsRepository.getValidationGroups(
        { serverId: testServerId, aspect: 'structural' },
        { page: 1, size: 25 }
      );
      
      expect(result.groups).toHaveLength(1);
      expect(result.groups[0].aspect).toBe('structural');
    });
    
    it('should filter by severity', async () => {
      const result = await ValidationGroupsRepository.getValidationGroups(
        { serverId: testServerId, severity: 'error' },
        { page: 1, size: 25 }
      );
      
      expect(result.groups).toHaveLength(1);
      expect(result.groups[0].severity).toBe('error');
    });
    
    it('should filter by code', async () => {
      const result = await ValidationGroupsRepository.getValidationGroups(
        { serverId: testServerId, code: 'required' },
        { page: 1, size: 25 }
      );
      
      expect(result.groups).toHaveLength(1);
      expect(result.groups[0].code).toBe('required');
    });
    
    it('should filter by path (partial match)', async () => {
      const result = await ValidationGroupsRepository.getValidationGroups(
        { serverId: testServerId, path: 'patient' },
        { page: 1, size: 25 }
      );
      
      expect(result.groups).toHaveLength(1);
      expect(result.groups[0].canonicalPath).toContain('patient');
    });
    
    it('should sort by count descending', async () => {
      const result = await ValidationGroupsRepository.getValidationGroups(
        { serverId: testServerId },
        { page: 1, size: 25, sort: 'count:desc' }
      );
      
      expect(result.groups[0].totalResources).toBeGreaterThanOrEqual(result.groups[1].totalResources);
    });
    
    it('should paginate results', async () => {
      const page1 = await ValidationGroupsRepository.getValidationGroups(
        { serverId: testServerId },
        { page: 1, size: 1 }
      );
      
      expect(page1.groups).toHaveLength(1);
      expect(page1.total).toBe(2);
      
      const page2 = await ValidationGroupsRepository.getValidationGroups(
        { serverId: testServerId },
        { page: 2, size: 1 }
      );
      
      expect(page2.groups).toHaveLength(1);
      expect(page2.groups[0].signature).not.toBe(page1.groups[0].signature);
    });
  });
  
  describe('getGroupMembers', () => {
    it('should return all resources with a specific signature', async () => {
      const result = await ValidationGroupsRepository.getGroupMembers(
        testServerId,
        testSignature1,
        { page: 1, size: 25 }
      );
      
      expect(result.members).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.members.every(m => m.resourceType === 'Patient')).toBe(true);
    });
    
    it('should filter by resource type', async () => {
      const result = await ValidationGroupsRepository.getGroupMembers(
        testServerId,
        testSignature1,
        { resourceType: 'Patient', page: 1, size: 25 }
      );
      
      expect(result.members).toHaveLength(2);
      expect(result.members.every(m => m.resourceType === 'Patient')).toBe(true);
    });
    
    it('should include per-aspect validation data', async () => {
      const result = await ValidationGroupsRepository.getGroupMembers(
        testServerId,
        testSignature1,
        { page: 1, size: 25 }
      );
      
      expect(result.members[0].perAspect).toBeDefined();
      expect(result.members[0].perAspect.length).toBeGreaterThan(0);
      
      const structuralAspect = result.members[0].perAspect.find(a => a.aspect === 'structural');
      expect(structuralAspect).toBeDefined();
      expect(structuralAspect?.errorCount).toBe(1);
    });
    
    it('should paginate members', async () => {
      const page1 = await ValidationGroupsRepository.getGroupMembers(
        testServerId,
        testSignature1,
        { page: 1, size: 1 }
      );
      
      expect(page1.members).toHaveLength(1);
      expect(page1.total).toBe(2);
    });
  });
  
  describe('getResourceMessages', () => {
    it('should return all messages for a resource', async () => {
      const result = await ValidationGroupsRepository.getResourceMessages(
        testServerId,
        'Patient',
        'test-pat-001'
      );
      
      expect(result.resourceType).toBe('Patient');
      expect(result.fhirId).toBe('test-pat-001');
      expect(result.aspects).toBeDefined();
      expect(result.aspects.length).toBeGreaterThan(0);
    });
    
    it('should include per-aspect message details', async () => {
      const result = await ValidationGroupsRepository.getResourceMessages(
        testServerId,
        'Patient',
        'test-pat-001'
      );
      
      const structuralAspect = result.aspects.find((a: any) => a.aspect === 'structural');
      expect(structuralAspect).toBeDefined();
      expect(structuralAspect.messages).toBeDefined();
      expect(structuralAspect.messages.length).toBe(1);
      
      const message = structuralAspect.messages[0];
      expect(message.severity).toBe('error');
      expect(message.code).toBe('required');
      expect(message.canonicalPath).toBe('patient.name');
      expect(message.signature).toBe(testSignature1);
    });
    
    it('should return empty aspects for non-existent resource', async () => {
      const result = await ValidationGroupsRepository.getResourceMessages(
        testServerId,
        'Patient',
        'non-existent'
      );
      
      expect(result.aspects).toHaveLength(0);
    });
  });
});
