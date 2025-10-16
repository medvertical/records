/**
 * Validation Streaming API Routes
 * Task 10.11: Server-Sent Events (SSE) for progressive validation results
 */

import express from 'express';
import { getStreamingValidator } from '../../services/validation/streaming/streaming-validator.js';
import type { ValidationRequest } from '../../services/validation/types/validation-types.js';

const router = express.Router();

/**
 * POST /api/validate/stream
 * Stream validation results using Server-Sent Events
 * 
 * Request body:
 * {
 *   "resources": [...],  // Array of FHIR resources
 *   "settings": {...},   // Validation settings (optional)
 *   "maxConcurrent": 10  // Concurrent validations (optional)
 * }
 * 
 * Response: SSE stream with events:
 * - started: Validation started
 * - result: Individual validation result
 * - progress: Progress update
 * - complete: All validations complete
 * - error: Error during validation
 */
router.post('/stream', async (req, res) => {
  try {
    const { resources, settings, maxConcurrent } = req.body;

    if (!resources || !Array.isArray(resources) || resources.length === 0) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'resources array is required and must not be empty',
      });
    }

    // Set up Server-Sent Events
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

    const requestId = `stream-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    console.log(`[ValidationStreamingAPI] Starting SSE stream: ${requestId} (${resources.length} resources)`);

    // Convert to ValidationRequest format
    const validationRequests: ValidationRequest[] = resources.map((resource: any) => ({
      resource,
      resourceType: resource.resourceType,
      resourceId: resource.id,
      settings,
    }));

    const streamingValidator = getStreamingValidator();

    // Set up event listeners
    streamingValidator.on('started', (data) => {
      if (data.requestId === requestId) {
        res.write(`event: started\n`);
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      }
    });

    streamingValidator.on('result', (data) => {
      if (data.requestId === requestId) {
        res.write(`event: result\n`);
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      }
    });

    streamingValidator.on('progress', (data) => {
      if (data.requestId === requestId) {
        res.write(`event: progress\n`);
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      }
    });

    streamingValidator.on('complete', (data) => {
      if (data.requestId === requestId) {
        res.write(`event: complete\n`);
        res.write(`data: ${JSON.stringify(data)}\n\n`);
        res.end();
      }
    });

    streamingValidator.on('error', (data) => {
      if (data.requestId === requestId) {
        res.write(`event: error\n`);
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      }
    });

    streamingValidator.on('failed', (data) => {
      if (data.requestId === requestId) {
        res.write(`event: failed\n`);
        res.write(`data: ${JSON.stringify(data)}\n\n`);
        res.end();
      }
    });

    streamingValidator.on('cancelled', (data) => {
      if (data.requestId === requestId) {
        res.write(`event: cancelled\n`);
        res.write(`data: ${JSON.stringify(data)}\n\n`);
        res.end();
      }
    });

    // Handle client disconnect
    req.on('close', () => {
      console.log(`[ValidationStreamingAPI] Client disconnected: ${requestId}`);
      streamingValidator.cancelStream(requestId);
    });

    // Start streaming validation
    await streamingValidator.validateBatchStreaming({
      resources: validationRequests,
      settings,
      maxConcurrent,
      requestId,
    });

  } catch (error: any) {
    console.error('[ValidationStreamingAPI] Stream error:', error);
    
    // Send error event if possible
    try {
      res.write(`event: error\n`);
      res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
      res.end();
    } catch (writeError) {
      // Connection may already be closed
      console.error('[ValidationStreamingAPI] Failed to write error:', writeError);
    }
  }
});

/**
 * GET /api/validate/stream/:requestId/progress
 * Get progress for an active streaming validation
 */
router.get('/stream/:requestId/progress', (req, res) => {
  try {
    const { requestId } = req.params;

    const streamingValidator = getStreamingValidator();
    const progress = streamingValidator.getProgress(requestId);

    if (!progress) {
      return res.status(404).json({
        error: 'Stream not found',
        message: `No active stream with ID: ${requestId}`,
      });
    }

    res.json(progress);
  } catch (error: any) {
    console.error('[ValidationStreamingAPI] Error fetching progress:', error);
    res.status(500).json({
      error: 'Failed to fetch progress',
      message: error.message,
    });
  }
});

/**
 * DELETE /api/validate/stream/:requestId
 * Cancel an active streaming validation
 */
router.delete('/stream/:requestId', (req, res) => {
  try {
    const { requestId } = req.params;

    const streamingValidator = getStreamingValidator();
    const cancelled = streamingValidator.cancelStream(requestId);

    if (!cancelled) {
      return res.status(404).json({
        error: 'Stream not found',
        message: `No active stream with ID: ${requestId}`,
      });
    }

    res.json({
      success: true,
      message: `Stream ${requestId} cancelled`,
    });
  } catch (error: any) {
    console.error('[ValidationStreamingAPI] Error cancelling stream:', error);
    res.status(500).json({
      error: 'Failed to cancel stream',
      message: error.message,
    });
  }
});

/**
 * GET /api/validate/stream/active
 * Get all active streaming validations
 */
router.get('/stream/active', (req, res) => {
  try {
    const streamingValidator = getStreamingValidator();
    const activeStreams = streamingValidator.getActiveStreams();

    const streams = Array.from(activeStreams.values());

    res.json({
      count: streams.length,
      streams,
    });
  } catch (error: any) {
    console.error('[ValidationStreamingAPI] Error fetching active streams:', error);
    res.status(500).json({
      error: 'Failed to fetch active streams',
      message: error.message,
    });
  }
});

export default router;


