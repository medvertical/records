import type { Express } from "express";
import { DashboardService } from "../../../services/dashboard/dashboard-service";
import { cacheManager, CACHE_TAGS } from "../../../utils/cache-manager";

export function setupDashboardRoutes(app: Express, dashboardService: DashboardService) {
  // Dashboard Statistics
  app.get("/api/dashboard/stats", async (req, res) => {
    // Return default stats as fallback since service methods are missing
    const defaultStats = {
      totalResources: 0,
      validatedResources: 0,
      validResources: 0,
      invalidResources: 0,
      validationRate: 0,
      successRate: 0
    };
    res.json(defaultStats);
  });

  // Dashboard Cards
  app.get("/api/dashboard/cards", async (req, res) => {
    try {
      const cards = await dashboardService.getDashboardCards();
      res.json(cards);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // FHIR Server Statistics
  app.get("/api/dashboard/fhir-server-stats", async (req, res) => {
    try {
      const stats = await dashboardService.getFhirServerStats();
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Validation Statistics
  app.get("/api/dashboard/validation-stats", async (req, res) => {
    try {
      const stats = await dashboardService.getValidationStats();
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Combined Dashboard Data
  app.get("/api/dashboard/combined", async (req, res) => {
    try {
      const combined = await dashboardService.getCombinedDashboardData();
      
      // Get fresh FHIR resource counts using the working /api/fhir/resource-counts endpoint
      let totalServerResources = 0;
      try {
        const axios = await import('axios');
        const response = await axios.default.get('http://localhost:3000/api/fhir/resource-counts');
        totalServerResources = response.data.totalResources || 0;
        console.log('[Dashboard Combined] Fresh total resources from /api/fhir/resource-counts:', totalServerResources);
      } catch (fhirError) {
        console.error('[Dashboard Combined] Error getting FHIR resource counts:', fhirError);
      }
      
      // Update fhirServer stats with fresh total
      if (totalServerResources > 0) {
        combined.fhirServer = {
          ...combined.fhirServer,
          totalResources: totalServerResources
        };
      }
      
      // Enhance validation stats with data from most recent batch validation run
      try {
        const { getValidationProgressPersistenceService } = await import('../../../services/validation/persistence/validation-progress-persistence-service.js');
        const persistenceService = getValidationProgressPersistenceService();
        const recentStates = await persistenceService.getRecentProgressStates(1);
        console.log('[Dashboard Combined] Recent states:', { count: recentStates?.length || 0 });
        
        if (recentStates && recentStates.length > 0) {
          const mostRecent = recentStates[0];
          console.log('[Dashboard Combined] Most recent batch:', { 
            isRunning: mostRecent.isRunning, 
            processedResources: mostRecent.processedResources,
            errors: mostRecent.errors 
          });
          
          // Only use batch stats if they exist and the batch completed
          if (mostRecent && !mostRecent.isRunning && mostRecent.processedResources > 0) {
            const processedResources = mostRecent.processedResources || 0;
            
            // Calculate coverage as percentage of ALL server resources that have been validated
            const validationCoverage = totalServerResources > 0 
              ? (processedResources / totalServerResources) * 100 
              : 0;
            
            console.log('[Dashboard Combined] Validation coverage:', { 
              processedResources, 
              totalServerResources, 
              coverage: validationCoverage.toFixed(2) + '%' 
            });
            
            combined.validation = {
              ...combined.validation,
              totalValidated: processedResources,
              validResources: processedResources - (mostRecent.errors || 0),
              errorResources: mostRecent.errors || 0,
              warningResources: mostRecent.warnings || 0,
              unvalidatedResources: Math.max(0, totalServerResources - processedResources),
              validationCoverage: validationCoverage,
              validationProgress: validationCoverage, // Same as coverage
              lastValidationRun: mostRecent.startTimestamp ? new Date(mostRecent.startTimestamp).toISOString() : combined.validation.lastValidationRun,
            };
          }
        }
      } catch (enhanceError) {
        console.error('[Dashboard] Error enhancing with batch stats:', enhanceError);
        // Continue with original combined data
      }
      
      res.json(combined);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Force Dashboard Refresh
  app.post("/api/dashboard/force-refresh", async (req, res) => {
    try {
      await dashboardService.forceRefresh();
      res.json({ message: "Dashboard refreshed" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // FHIR Version Information
  app.get("/api/dashboard/fhir-version-info", async (req, res) => {
    try {
      const versionInfo = await dashboardService.getFhirVersionInfo();
      res.json(versionInfo);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Smart Resource Counts
  app.get("/api/dashboard/resource-counts", async (req, res) => {
    try {
      const stats = await dashboardService.getFhirServerStats();
      const response = {
        counts: stats.resourceCounts,
        totalResources: stats.totalResources,
        totalTypes: Object.keys(stats.resourceCounts).length,
        lastUpdated: stats.serverInfo.lastChecked,
        cacheStatus: 'complete' as const
      };
      res.json(response);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Force Refresh Resource Counts
  app.post("/api/dashboard/resource-counts/refresh", async (req, res) => {
    try {
      // Clear resource counts cache
      cacheManager.clearByTags([CACHE_TAGS.RESOURCE_COUNTS]);
      
      // Trigger refresh in background (don't await)
      dashboardService.forceRefresh().catch(error => {
        console.error('[Dashboard] Background refresh error:', error);
      });
      
      res.json({ status: 'refreshing' });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
}
