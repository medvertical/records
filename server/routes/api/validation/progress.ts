import { Router, Request, Response } from 'express';
import { getValidationProgressPersistenceService } from '../../../services/validation/persistence/validation-progress-persistence-service';
import { getConsolidatedValidationService } from '../../../services/validation';
import logger from '../../../utils/logger';

const router = Router();

/**
 * GET /api/validation/progress
 * Get current validation progress state for a server
 * 
 * Query Parameters:
 * - serverId: number - Server ID (default: 1)
 * 
 * Response:
 * {
 *   state: 'queued' | 'running' | 'paused' | 'completed' | 'failed',
 *   total: number,
 *   processed: number,
 *   failed: number,
 *   startedAt: string (ISO timestamp),
 *   updatedAt: string (ISO timestamp),
 *   etaSeconds: number (optional)
 * }
 */
router.get('/progress', async (req: Request, res: Response) => {
  try {
    const serverId = parseInt(req.query.serverId as string) || 1;
    
    const progressService = getValidationProgressPersistenceService();
    const progress = await progressService.getProgress(serverId);
    
    if (!progress) {
      // No progress found - return idle state
      return res.json({
        state: 'completed',
        total: 0,
        processed: 0,
        failed: 0,
        startedAt: null,
        updatedAt: new Date().toISOString(),
        etaSeconds: null,
      });
    }
    
    res.json({
      state: progress.state,
      total: progress.total,
      processed: progress.processed,
      failed: progress.failed,
      startedAt: progress.startedAt,
      updatedAt: progress.updatedAt,
      etaSeconds: progress.etaSeconds,
    });
  } catch (error: any) {
    logger.error('Error fetching validation progress:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch validation progress',
      message: error.message || 'Unknown error',
    });
  }
});

/**
 * POST /api/validation/progress/pause
 * Pause the current validation batch process
 * 
 * Request Body:
 * {
 *   serverId?: number (default: 1)
 * }
 * 
 * Response:
 * {
 *   success: boolean,
 *   message: string
 * }
 */
router.post('/progress/pause', async (req: Request, res: Response) => {
  try {
    const serverId = parseInt(req.body.serverId as string) || parseInt(req.query.serverId as string) || 1;
    
    const validationService = getConsolidatedValidationService();
    
    if (!validationService) {
      return res.status(503).json({
        success: false,
        error: 'Validation service not available',
      });
    }
    
    // Check if pauseValidation method exists
    if (typeof validationService.pauseValidation === 'function') {
      await validationService.pauseValidation(serverId);
      
      res.json({
        success: true,
        message: 'Validation paused successfully',
      });
    } else {
      // Fallback: Update progress state directly
      const progressService = getValidationProgressPersistenceService();
      await progressService.updateProgressState(serverId, 'paused');
      
      res.json({
        success: true,
        message: 'Validation paused successfully (via progress service)',
      });
    }
  } catch (error: any) {
    logger.error('Error pausing validation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to pause validation',
      message: error.message || 'Unknown error',
    });
  }
});

/**
 * POST /api/validation/progress/resume
 * Resume a paused validation batch process
 * 
 * Request Body:
 * {
 *   serverId?: number (default: 1)
 * }
 * 
 * Response:
 * {
 *   success: boolean,
 *   message: string
 * }
 */
router.post('/progress/resume', async (req: Request, res: Response) => {
  try {
    const serverId = parseInt(req.body.serverId as string) || parseInt(req.query.serverId as string) || 1;
    
    const validationService = getConsolidatedValidationService();
    
    if (!validationService) {
      return res.status(503).json({
        success: false,
        error: 'Validation service not available',
      });
    }
    
    // Check if resumeValidation method exists
    if (typeof validationService.resumeValidation === 'function') {
      await validationService.resumeValidation(serverId);
      
      res.json({
        success: true,
        message: 'Validation resumed successfully',
      });
    } else {
      // Fallback: Update progress state directly
      const progressService = getValidationProgressPersistenceService();
      await progressService.updateProgressState(serverId, 'running');
      
      res.json({
        success: true,
        message: 'Validation resumed successfully (via progress service)',
      });
    }
  } catch (error: any) {
    logger.error('Error resuming validation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to resume validation',
      message: error.message || 'Unknown error',
    });
  }
});

/**
 * POST /api/validation/progress/start
 * Start a new validation batch process
 * 
 * Request Body:
 * {
 *   serverId?: number (default: 1),
 *   resourceTypes?: string[] (optional, array of resource types to validate)
 * }
 * 
 * Response:
 * {
 *   success: boolean,
 *   message: string,
 *   jobId?: string
 * }
 */
router.post('/progress/start', async (req: Request, res: Response) => {
  try {
    const serverId = parseInt(req.body.serverId as string) || parseInt(req.query.serverId as string) || 1;
    const resourceTypes = req.body.resourceTypes as string[] | undefined;
    
    const validationService = getConsolidatedValidationService();
    
    if (!validationService) {
      return res.status(503).json({
        success: false,
        error: 'Validation service not available',
      });
    }
    
    // Check if startBatchValidation method exists
    if (typeof validationService.startBatchValidation === 'function') {
      const result = await validationService.startBatchValidation(serverId, resourceTypes);
      
      res.json({
        success: true,
        message: 'Validation started successfully',
        jobId: result?.jobId,
      });
    } else {
      return res.status(501).json({
        success: false,
        error: 'Batch validation start not implemented',
        message: 'startBatchValidation method not available on validation service',
      });
    }
  } catch (error: any) {
    logger.error('Error starting validation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start validation',
      message: error.message || 'Unknown error',
    });
  }
});

export default router;

