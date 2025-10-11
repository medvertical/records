import { Router } from 'express';
import { db } from '../../../db.js';
import { fhirResources } from '@shared/schema';
import { validationResultsPerAspect, validationMessages } from '@shared/schema-validation-per-aspect';
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

export default router;
