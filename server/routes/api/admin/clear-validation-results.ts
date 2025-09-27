import { Router } from 'express';
import { db } from '../../../db.js';
import { validationResults, fhirResources } from '@shared/schema';
import { and, eq, like } from 'drizzle-orm';

const router = Router();

router.post('/clear-validation-results', async (req, res) => {
  try {
    console.log('Clearing old validation results with unrealistic 100% scores...');
    
    // Delete validation results that have 100% scores with no issues (unrealistic)
    const result = await db.delete(validationResults)
      .where(
        and(
          eq(validationResults.validationScore, 100),
          eq(validationResults.errorCount, 0),
          eq(validationResults.warningCount, 0)
        )
      );
    
    console.log('✅ Cleared old validation results with unrealistic 100% scores');
    console.log('Result:', result);
    
    res.json({
      success: true,
      message: 'Cleared old validation results with unrealistic 100% scores',
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
    
    // Delete validation results for mock patients (by database ID)
    let validationResultsCleared = { rowCount: 0 };
    if (mockResources.length > 0) {
      const mockResourceIds = mockResources.map(r => r.id);
      for (const resourceId of mockResourceIds) {
        const result = await db.delete(validationResults)
          .where(eq(validationResults.resourceId, resourceId));
        validationResultsCleared.rowCount += result.rowCount || 0;
      }
    }
    
    console.log('✅ Cleared validation results for mock patients');
    
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
      validationResultsCleared: validationResultsCleared.rowCount,
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
