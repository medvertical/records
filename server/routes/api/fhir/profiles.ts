import type { Express } from "express";
import { profileManager } from "../../../services/fhir/profile-manager";
import { getProfileResolver } from "../../../services/validation/utils/profile-resolver";
import { GermanProfileDetector } from "../../../services/validation/utils/german-profile-detector";
import { ProfileMetadataExtractor } from "../../../services/validation/utils/profile-metadata-extractor";
import { getProfileNotificationService } from "../../../services/validation/utils/profile-notification-service";

export function setupProfileRoutes(app: Express) {
  // Profile Search
  app.get("/api/profiles/search", async (req, res) => {
    try {
      const { query, limit = 20 } = req.query;
      const profiles = await profileManager.searchProfiles(query as string, parseInt(limit as string));
      res.json(profiles);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Profile Versions
  app.get("/api/profiles/versions", async (req, res) => {
    try {
      const { profileUrl } = req.query;
      const versions = await profileManager.getProfileVersions(profileUrl as string);
      res.json(versions);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Installed Profiles
  app.get("/api/profiles/installed", async (req, res) => {
    try {
      const profiles = await profileManager.getInstalledProfiles();
      res.json(profiles);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Install Profile
  app.post("/api/profiles/install", async (req, res) => {
    try {
      const { url, name, version } = req.body;
      const profile = await profileManager.installProfile(url, name, version);
      res.json(profile);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Uninstall Profile
  app.post("/api/profiles/uninstall", async (req, res) => {
    try {
      const { profileId } = req.body;
      await profileManager.uninstallProfile(profileId);
      res.json({ message: "Profile uninstalled" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Update Profile
  app.post("/api/profiles/update", async (req, res) => {
    try {
      const { profileId, version } = req.body;
      const profile = await profileManager.updateProfile(profileId, version);
      res.json(profile);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Check for Profile Updates
  app.get("/api/profiles/updates", async (req, res) => {
    try {
      const updates = await profileManager.checkForUpdates();
      res.json(updates);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ============================================================================
  // Task 4.11: Profile Resolution Endpoints
  // ============================================================================

  /**
   * Resolve a profile by canonical URL
   * POST /api/profiles/resolve
   * Body: { canonicalUrl: string, version?: string }
   */
  app.post("/api/profiles/resolve", async (req, res) => {
    try {
      const { canonicalUrl, version } = req.body;

      if (!canonicalUrl) {
        return res.status(400).json({ 
          message: "canonicalUrl is required" 
        });
      }

      console.log(`[ProfileRoutes] Resolving profile: ${canonicalUrl}${version ? `@${version}` : ''}`);

      const resolver = getProfileResolver();
      const result = await resolver.resolveProfile(canonicalUrl, version);

      res.json({
        success: true,
        canonicalUrl: result.canonicalUrl,
        version: result.version,
        source: result.source,
        downloaded: result.downloaded,
        resolutionTime: result.resolutionTime,
        dependencies: result.dependencies,
        metadata: result.metadata ? {
          name: result.metadata.name,
          title: result.metadata.title,
          type: result.metadata.type,
          kind: result.metadata.kind,
          status: result.metadata.status,
          elementCount: result.metadata.elements.length,
          constraintCount: result.metadata.constraints.length,
          mustSupportCount: result.metadata.mustSupportElements.length,
          extensionCount: result.metadata.extensions.length,
          complexityScore: ProfileMetadataExtractor.getComplexityScore(result.metadata),
        } : undefined,
        germanProfile: result.germanProfile,
      });

    } catch (error: any) {
      console.error('[ProfileRoutes] Profile resolution failed:', error);
      res.status(500).json({ 
        success: false,
        message: error.message 
      });
    }
  });

  /**
   * Get profile metadata
   * GET /api/profiles/:canonicalUrl/metadata?version=x.x.x
   */
  app.get("/api/profiles/metadata", async (req, res) => {
    try {
      const { canonicalUrl, version } = req.query;

      if (!canonicalUrl) {
        return res.status(400).json({ 
          message: "canonicalUrl query parameter is required" 
        });
      }

      console.log(`[ProfileRoutes] Getting metadata for: ${canonicalUrl}${version ? `@${version}` : ''}`);

      const resolver = getProfileResolver();
      const metadata = await resolver.getProfileMetadata(
        canonicalUrl as string, 
        version as string | undefined
      );

      if (!metadata) {
        return res.status(404).json({
          message: "Profile not found or metadata could not be extracted"
        });
      }

      res.json({
        success: true,
        metadata: {
          ...metadata,
          complexityScore: ProfileMetadataExtractor.getComplexityScore(metadata),
          requiredElements: ProfileMetadataExtractor.getRequiredElements(metadata),
          modifierElements: ProfileMetadataExtractor.getModifierElements(metadata),
        }
      });

    } catch (error: any) {
      console.error('[ProfileRoutes] Failed to get metadata:', error);
      res.status(500).json({ 
        success: false,
        message: error.message 
      });
    }
  });

  /**
   * Get profile summary
   * GET /api/profiles/summary?canonicalUrl=xxx&version=x.x.x
   */
  app.get("/api/profiles/summary", async (req, res) => {
    try {
      const { canonicalUrl, version } = req.query;

      if (!canonicalUrl) {
        return res.status(400).json({ 
          message: "canonicalUrl query parameter is required" 
        });
      }

      console.log(`[ProfileRoutes] Generating summary for: ${canonicalUrl}${version ? `@${version}` : ''}`);

      const resolver = getProfileResolver();
      const summary = await resolver.generateProfileSummary(
        canonicalUrl as string,
        version as string | undefined
      );

      if (!summary) {
        return res.status(404).json({
          message: "Profile not found or summary could not be generated"
        });
      }

      res.json({
        success: true,
        summary
      });

    } catch (error: any) {
      console.error('[ProfileRoutes] Failed to generate summary:', error);
      res.status(500).json({ 
        success: false,
        message: error.message 
      });
    }
  });

  /**
   * Detect German profile
   * POST /api/profiles/detect-german
   * Body: { canonicalUrl: string }
   */
  app.post("/api/profiles/detect-german", async (req, res) => {
    try {
      const { canonicalUrl } = req.body;

      if (!canonicalUrl) {
        return res.status(400).json({ 
          message: "canonicalUrl is required" 
        });
      }

      console.log(`[ProfileRoutes] Detecting German profile: ${canonicalUrl}`);

      const result = GermanProfileDetector.detectGermanProfile(canonicalUrl);
      const recommendations = GermanProfileDetector.generateRecommendations(canonicalUrl);

      res.json({
        success: true,
        detection: result,
        recommendations,
      });

    } catch (error: any) {
      console.error('[ProfileRoutes] German profile detection failed:', error);
      res.status(500).json({ 
        success: false,
        message: error.message 
      });
    }
  });

  /**
   * Get available versions for a profile
   * GET /api/profiles/available-versions?canonicalUrl=xxx
   */
  app.get("/api/profiles/available-versions", async (req, res) => {
    try {
      const { canonicalUrl } = req.query;

      if (!canonicalUrl) {
        return res.status(400).json({ 
          message: "canonicalUrl query parameter is required" 
        });
      }

      console.log(`[ProfileRoutes] Getting available versions for: ${canonicalUrl}`);

      const resolver = getProfileResolver();
      const versions = await resolver.getAvailableVersions(canonicalUrl as string);

      res.json({
        success: true,
        canonicalUrl,
        versions,
        count: versions.length,
      });

    } catch (error: any) {
      console.error('[ProfileRoutes] Failed to get versions:', error);
      res.status(500).json({ 
        success: false,
        message: error.message 
      });
    }
  });

  /**
   * Check if a profile is cached
   * GET /api/profiles/cached?canonicalUrl=xxx&version=x.x.x
   */
  app.get("/api/profiles/cached", async (req, res) => {
    try {
      const { canonicalUrl, version } = req.query;

      if (!canonicalUrl) {
        return res.status(400).json({ 
          message: "canonicalUrl query parameter is required" 
        });
      }

      const resolver = getProfileResolver();
      const isCached = resolver.isCached(
        canonicalUrl as string,
        version as string | undefined
      );

      res.json({
        success: true,
        canonicalUrl,
        version: version || 'any',
        cached: isCached,
      });

    } catch (error: any) {
      console.error('[ProfileRoutes] Cache check failed:', error);
      res.status(500).json({ 
        success: false,
        message: error.message 
      });
    }
  });

  /**
   * Clear profile cache
   * POST /api/profiles/clear-cache
   */
  app.post("/api/profiles/clear-cache", async (req, res) => {
    try {
      console.log('[ProfileRoutes] Clearing profile cache');

      const resolver = getProfileResolver();
      resolver.clearCache();

      res.json({
        success: true,
        message: "Profile cache cleared successfully"
      });

    } catch (error: any) {
      console.error('[ProfileRoutes] Failed to clear cache:', error);
      res.status(500).json({ 
        success: false,
        message: error.message 
      });
    }
  });

  /**
   * Get profile cache statistics
   * GET /api/profiles/cache-stats
   */
  app.get("/api/profiles/cache-stats", async (req, res) => {
    try {
      const resolver = getProfileResolver();
      const stats = resolver.getCacheStats();

      res.json({
        success: true,
        stats,
      });

    } catch (error: any) {
      console.error('[ProfileRoutes] Failed to get cache stats:', error);
      res.status(500).json({ 
        success: false,
        message: error.message 
      });
    }
  });

  /**
   * Get suggested German packages
   * GET /api/profiles/german-packages
   */
  app.get("/api/profiles/german-packages", async (req, res) => {
    try {
      const suggestedPackages = GermanProfileDetector.getSuggestedPackages();

      res.json({
        success: true,
        packages: suggestedPackages,
      });

    } catch (error: any) {
      console.error('[ProfileRoutes] Failed to get German packages:', error);
      res.status(500).json({ 
        success: false,
        message: error.message 
      });
    }
  });

  // ============================================================================
  // Task 4.12: Profile Notification Endpoints
  // ============================================================================

  /**
   * Get profile notifications
   * GET /api/profiles/notifications?unreadOnly=true
   */
  app.get("/api/profiles/notifications", async (req, res) => {
    try {
      const unreadOnly = req.query.unreadOnly === 'true';
      
      const notificationService = getProfileNotificationService();
      const notifications = notificationService.getNotifications(unreadOnly);
      const unreadCount = notificationService.getUnreadCount();

      res.json({
        success: true,
        notifications,
        unreadCount,
        total: notifications.length,
      });

    } catch (error: any) {
      console.error('[ProfileRoutes] Failed to get notifications:', error);
      res.status(500).json({ 
        success: false,
        message: error.message 
      });
    }
  });

  /**
   * Mark notification as read
   * POST /api/profiles/notifications/:id/read
   */
  app.post("/api/profiles/notifications/:id/read", async (req, res) => {
    try {
      const notificationService = getProfileNotificationService();
      const marked = notificationService.markAsRead(req.params.id);

      if (!marked) {
        return res.status(404).json({
          success: false,
          message: "Notification not found"
        });
      }

      res.json({
        success: true,
        message: "Notification marked as read"
      });

    } catch (error: any) {
      console.error('[ProfileRoutes] Failed to mark notification as read:', error);
      res.status(500).json({ 
        success: false,
        message: error.message 
      });
    }
  });

  /**
   * Mark all notifications as read
   * POST /api/profiles/notifications/read-all
   */
  app.post("/api/profiles/notifications/read-all", async (req, res) => {
    try {
      const notificationService = getProfileNotificationService();
      notificationService.markAllAsRead();

      res.json({
        success: true,
        message: "All notifications marked as read"
      });

    } catch (error: any) {
      console.error('[ProfileRoutes] Failed to mark all as read:', error);
      res.status(500).json({ 
        success: false,
        message: error.message 
      });
    }
  });

  /**
   * Clear all notifications
   * POST /api/profiles/notifications/clear
   */
  app.post("/api/profiles/notifications/clear", async (req, res) => {
    try {
      const notificationService = getProfileNotificationService();
      notificationService.clearNotifications();

      res.json({
        success: true,
        message: "All notifications cleared"
      });

    } catch (error: any) {
      console.error('[ProfileRoutes] Failed to clear notifications:', error);
      res.status(500).json({ 
        success: false,
        message: error.message 
      });
    }
  });

  /**
   * Get unread notification count
   * GET /api/profiles/notifications/unread-count
   */
  app.get("/api/profiles/notifications/unread-count", async (req, res) => {
    try {
      const notificationService = getProfileNotificationService();
      const count = notificationService.getUnreadCount();

      res.json({
        success: true,
        count
      });

    } catch (error: any) {
      console.error('[ProfileRoutes] Failed to get unread count:', error);
      res.status(500).json({ 
        success: false,
        message: error.message 
      });
    }
  });
}
