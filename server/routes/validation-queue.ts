import type { Express } from "express";
import { getValidationQueueService, ValidationPriority, getIndividualResourceProgressService, getValidationCancellationRetryService } from "../services/validation";

export function setupValidationQueueRoutes(app: Express) {
  // Validation Queue Management
  app.post("/api/validation/bulk/start-queue", async (req, res) => {
    try {
      const queueService = getValidationQueueService();
      const { resourceTypes, validationAspects, config, priority = ValidationPriority.NORMAL } = req.body;
      
      const queueId = await queueService.addToQueue({
        resourceTypes,
        validationAspects,
        config,
        priority
      });
      
      res.json({ 
        message: "Validation added to queue",
        queueId
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Queue Statistics
  app.get("/api/validation/queue/stats", async (req, res) => {
    try {
      const queueService = getValidationQueueService();
      const stats = await queueService.getQueueStats();
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Queue Items
  app.get("/api/validation/queue/items", async (req, res) => {
    try {
      const queueService = getValidationQueueService();
      const { status, limit = 50, offset = 0 } = req.query;
      const items = await queueService.getQueueItems(
        status as string,
        parseInt(limit as string),
        parseInt(offset as string)
      );
      res.json(items);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Processing Status
  app.get("/api/validation/queue/processing", async (req, res) => {
    try {
      const queueService = getValidationQueueService();
      const status = await queueService.getProcessingStatus();
      res.json(status);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Cancel Queue Item
  app.post("/api/validation/queue/cancel", async (req, res) => {
    try {
      const queueService = getValidationQueueService();
      const { queueId } = req.body;
      await queueService.cancelQueueItem(queueId);
      res.json({ message: "Queue item cancelled" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Clear Queue
  app.post("/api/validation/queue/clear", async (req, res) => {
    try {
      const queueService = getValidationQueueService();
      const { status } = req.body;
      const result = await queueService.clearQueue(status);
      res.json({ 
        message: `Queue cleared`,
        clearedCount: result.clearedCount
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Start Queue Processing
  app.post("/api/validation/queue/start", async (req, res) => {
    try {
      const queueService = getValidationQueueService();
      await queueService.startProcessing();
      res.json({ message: "Queue processing started" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Stop Queue Processing
  app.post("/api/validation/queue/stop", async (req, res) => {
    try {
      const queueService = getValidationQueueService();
      await queueService.stopProcessing();
      res.json({ message: "Queue processing stopped" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Individual Resource Progress
  app.get("/api/validation/progress/individual/stats", async (req, res) => {
    try {
      const progressService = getIndividualResourceProgressService();
      const stats = await progressService.getProgressStats();
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/validation/progress/individual/active", async (req, res) => {
    try {
      const progressService = getIndividualResourceProgressService();
      const active = await progressService.getActiveProgress();
      res.json(active);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/validation/progress/individual/completed", async (req, res) => {
    try {
      const progressService = getIndividualResourceProgressService();
      const { limit = 100, offset = 0 } = req.query;
      const completed = await progressService.getCompletedProgress(
        parseInt(limit as string),
        parseInt(offset as string)
      );
      res.json(completed);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/validation/progress/individual/:resourceId", async (req, res) => {
    try {
      const { resourceId } = req.params;
      const progressService = getIndividualResourceProgressService();
      const progress = await progressService.getResourceProgress(resourceId);
      res.json(progress);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/validation/progress/individual/start", async (req, res) => {
    try {
      const { resourceId, resourceType, validationAspects } = req.body;
      const progressService = getIndividualResourceProgressService();
      const progress = await progressService.startResourceProgress(resourceId, resourceType, validationAspects);
      res.json(progress);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/validation/progress/individual/update", async (req, res) => {
    try {
      const { resourceId, progress, errors, warnings } = req.body;
      const progressService = getIndividualResourceProgressService();
      const result = await progressService.updateResourceProgress(resourceId, progress, errors, warnings);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/validation/progress/individual/complete", async (req, res) => {
    try {
      const { resourceId, result } = req.body;
      const progressService = getIndividualResourceProgressService();
      const completed = await progressService.completeResourceProgress(resourceId, result);
      res.json(completed);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/validation/progress/individual/cancel", async (req, res) => {
    try {
      const { resourceId } = req.body;
      const progressService = getIndividualResourceProgressService();
      await progressService.cancelResourceProgress(resourceId);
      res.json({ message: "Resource progress cancelled" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/validation/progress/individual/clear", async (req, res) => {
    try {
      const { olderThanHours = 24 } = req.body;
      const progressService = getIndividualResourceProgressService();
      const result = await progressService.clearOldProgress(olderThanHours);
      res.json({ 
        message: `Cleared ${result.clearedCount} old progress records`,
        clearedCount: result.clearedCount
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Validation Cancellation and Retry
  app.get("/api/validation/cancellation-retry/stats", async (req, res) => {
    try {
      const cancellationService = getValidationCancellationRetryService();
      const stats = await cancellationService.getCancellationRetryStats();
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/validation/cancellation-retry/active", async (req, res) => {
    try {
      const cancellationService = getValidationCancellationRetryService();
      const active = await cancellationService.getActiveCancellations();
      res.json(active);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/validation/cancellation-retry/cancel", async (req, res) => {
    try {
      const { validationId, reason } = req.body;
      const cancellationService = getValidationCancellationRetryService();
      const result = await cancellationService.cancelValidation(validationId, reason);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/validation/cancellation-retry/cancel-all", async (req, res) => {
    try {
      const { reason } = req.body;
      const cancellationService = getValidationCancellationRetryService();
      const result = await cancellationService.cancelAllValidations(reason);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/validation/cancellation-retry/emergency-stop", async (req, res) => {
    try {
      const cancellationService = getValidationCancellationRetryService();
      const result = await cancellationService.emergencyStop();
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/validation/cancellation-retry/retry", async (req, res) => {
    try {
      const { validationId, retryConfig } = req.body;
      const cancellationService = getValidationCancellationRetryService();
      const result = await cancellationService.retryValidation(validationId, retryConfig);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/validation/cancellation-retry/retry-all-failed", async (req, res) => {
    try {
      const { retryConfig } = req.body;
      const cancellationService = getValidationCancellationRetryService();
      const result = await cancellationService.retryAllFailedValidations(retryConfig);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/validation/cancellation-retry/cancel-retry", async (req, res) => {
    try {
      const { retryId } = req.body;
      const cancellationService = getValidationCancellationRetryService();
      await cancellationService.cancelRetry(retryId);
      res.json({ message: "Retry cancelled" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/validation/cancellation-retry/clear-old", async (req, res) => {
    try {
      const { olderThanDays = 7 } = req.body;
      const cancellationService = getValidationCancellationRetryService();
      const result = await cancellationService.clearOldCancellations(olderThanDays);
      res.json({ 
        message: `Cleared ${result.clearedCount} old cancellation records`,
        clearedCount: result.clearedCount
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/validation/cancellation-retry/update-policy", async (req, res) => {
    try {
      const { policy } = req.body;
      const cancellationService = getValidationCancellationRetryService();
      const result = await cancellationService.updateCancellationPolicy(policy);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
}
