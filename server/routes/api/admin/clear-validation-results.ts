import { Router } from 'express';
import { db } from '../../../db.js';
import { validationResults } from '@shared/schema';
import { and, eq } from 'drizzle-orm';

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

export default router;
