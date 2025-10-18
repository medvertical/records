import { Router } from 'express';
import { db } from '../../../db.js';
import { fhirResources } from '@shared/schema';
import { validationResultsPerAspect, validationMessages, validationMessageGroups } from '@shared/schema-validation-per-aspect';
import { and, eq, like } from 'drizzle-orm';

const router = Router();

router.post('/clear-validation-results', async (req, res) => {
  try {
    console.log('Clearing old validation results with unrealistic 100% scores...');
    
    // Delete per-aspect validation results that have 100% scores with no issues (unrealistic)
    const result = await db.delete(validationResultsPerAspect)
      .where(
        and(
          eq(validationResultsPerAspect.score, 100),
          eq(validationResultsPerAspect.errorCount, 0),
          eq(validationResultsPerAspect.warningCount, 0)
        )
      );
    
    console.log('✅ Cleared old per-aspect validation results with unrealistic 100% scores');
    console.log('Result:', result);
    
    res.json({
      success: true,
      message: 'Cleared old per-aspect validation results with unrealistic 100% scores',
      result
    });
  } catch (error) {
    console.error('❌ Error clearing validation results:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/remove-mock-patients', async (req, res) => {
  try {
    console.log('Removing all mock patients from database...');
    
    // First, find mock patient resources
    const mockResources = await db.select()
      .from(fhirResources)
      .where(like(fhirResources.resourceId, 'mock-%'));
    
    console.log(`Found ${mockResources.length} mock patient resources`);
    
    // Delete per-aspect validation results for mock patients (by FHIR ID)
    let validationResultsCleared = 0;
    if (mockResources.length > 0) {
      for (const resource of mockResources) {
        // Delete validation messages
        const messagesResult = await db.delete(validationMessages)
          .where(
            and(
              eq(validationMessages.resourceType, resource.resourceType),
              eq(validationMessages.fhirId, resource.resourceId)
            )
          );
        
        // Delete per-aspect results
        const resultsResult = await db.delete(validationResultsPerAspect)
          .where(
            and(
              eq(validationResultsPerAspect.resourceType, resource.resourceType),
              eq(validationResultsPerAspect.fhirId, resource.resourceId)
            )
          );
        
        validationResultsCleared += (resultsResult.rowCount || 0);
      }
    }
    
    console.log('✅ Cleared per-aspect validation results for mock patients');
    
    // Then, delete the mock patient resources themselves
    const mockResourcesDeleted = await db.delete(fhirResources)
      .where(like(fhirResources.resourceId, 'mock-%'));
    
    console.log('✅ Removed mock patient resources from database');
    console.log('Mock validation results cleared:', validationResultsCleared);
    console.log('Mock resources removed:', mockResourcesDeleted);
    
    res.json({
      success: true,
      message: 'Successfully removed all mock patients from database',
      mockResourcesFound: mockResources.length,
      validationResultsCleared,
      resourcesRemoved: mockResourcesDeleted.rowCount || 0
    });
  } catch (error) {
    console.error('❌ Error removing mock patients:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove mock patients',
      error: error.message
    });
  }
});

router.post('/clear-all-validation-results', async (req, res) => {
  try {
    console.log('⚠️  Clearing ALL validation results from database...');
    
    // Delete all validation data in order (respecting FK constraints)
    // validationMessages has FK to validationResultsPerAspect with onDelete: cascade
    // So we delete child tables first, then parent
    
    // 1. Delete all message groups first (no FK constraints, independent table)
    const groupsResult = await db.delete(validationMessageGroups);
    const groupsDeleted = groupsResult.rowCount || 0;
    console.log(`✅ Deleted ${groupsDeleted} message groups`);
    
    // 2. Delete all validation messages (child table with FK to results)
    const messagesResult = await db.delete(validationMessages);
    const messagesDeleted = messagesResult.rowCount || 0;
    console.log(`✅ Deleted ${messagesDeleted} validation messages`);
    
    // 3. Delete all per-aspect validation results (parent table)
    const resultsResult = await db.delete(validationResultsPerAspect);
    const resultsDeleted = resultsResult.rowCount || 0;
    console.log(`✅ Deleted ${resultsDeleted} validation results`);
    
    const totalDeleted = groupsDeleted + messagesDeleted + resultsDeleted;
    
    console.log(`🎉 Total validation records deleted: ${totalDeleted}`);
    
    res.json({
      success: true,
      deleted: {
        results: resultsDeleted,
        messages: messagesDeleted,
        groups: groupsDeleted
      },
      totalDeleted
    });
  } catch (error) {
    console.error('❌ Error clearing all validation results:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Unknown error occurred'
    });
  }
});

export default router;
