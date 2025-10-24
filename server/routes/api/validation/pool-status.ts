/**
 * HAPI Process Pool Status Endpoint
 * 
 * Provides health check and status information for the HAPI validation process pool
 */

import { Router, Request, Response } from 'express';
import { getHapiProcessPool } from '../../../services/validation/engine/hapi-process-pool';

const router = Router();

/**
 * Get HAPI process pool status
 * 
 * Returns:
 * - ready: Whether the pool has idle processes available
 * - warmedUp: Whether minimum processes have been warmed up
 * - stats: Detailed pool statistics
 */
router.get('/pool/status', async (req: Request, res: Response) => {
  try {
    const pool = getHapiProcessPool();
    const stats = pool.getStats();
    const minPoolSize = pool.getMinPoolSize();
    
    const ready = stats.idleProcesses > 0;
    const warmedUp = stats.poolSize >= minPoolSize;
    
    res.json({
      ready,
      warmedUp,
      stats,
      message: ready 
        ? 'Pool is ready for validations' 
        : warmedUp 
          ? 'Pool is warmed up but all processes are busy'
          : 'Pool is warming up...'
    });
  } catch (error) {
    console.error('[PoolStatus] Error getting pool status:', error);
    res.status(500).json({
      ready: false,
      warmedUp: false,
      error: 'Failed to get pool status',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;

