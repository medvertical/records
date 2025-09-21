import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Simple logging function
function log(message, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}

// Mock data for when database is not available
const mockFhirServers = [
  { id: 1, name: "HAPI Test Server", url: "http://hapi.fhir.org/baseR4", isActive: true },
  { id: 2, name: "FHIR Test Server", url: "https://r4.smarthealthit.org", isActive: false }
];

// Basic API routes with fallbacks for Vercel deployment
app.get("/api/health", async (req, res) => {
  try {
    res.json({ 
      status: "ok", 
      timestamp: new Date().toISOString(),
      services: {
        database: "disconnected",
        fhirClient: "initialized",
        validationEngine: "initialized",
        environment: "vercel"
      }
    });
  } catch (error) {
    res.status(500).json({ 
      status: "error", 
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

app.get("/api/fhir/servers", async (req, res) => {
  try {
    res.json(mockFhirServers.map(server => ({
      id: server.id,
      name: server.name,
      url: server.url,
      isActive: server.isActive,
      hasAuth: false,
      authType: 'none',
      createdAt: new Date().toISOString()
    })));
  } catch (error) {
    res.status(500).json({
      error: "Failed to get FHIR servers",
      message: error.message
    });
  }
});

app.get("/api/dashboard/stats", async (req, res) => {
  try {
    res.json({
      totalResources: 100,
      validResources: 60,
      errorResources: 15,
      warningResources: 12,
      unvalidatedResources: 25,
      validationCoverage: 75.0,
      validationProgress: 75.0,
      activeProfiles: 3,
      resourceBreakdown: [
        { type: "Patient", count: 45 },
        { type: "Observation", count: 30 },
        { type: "Encounter", count: 15 },
        { type: "Medication", count: 10 }
      ]
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to get dashboard stats",
      message: error.message
    });
  }
});

// Store settings with a stable hash to prevent constant "changes"
let currentSettings = {
  id: 1,
  name: "Default Settings",
  isActive: true,
  settings: {
    structural: { enabled: true, severity: "error" },
    profile: { enabled: true, severity: "error" },
    terminology: { enabled: true, severity: "warning" },
    reference: { enabled: true, severity: "error" },
    businessRule: { enabled: true, severity: "warning" },
    metadata: { enabled: true, severity: "info" }
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  settingsHash: "stable-hash-123" // Stable hash to prevent constant changes
};

// Validation settings endpoints
app.get("/api/validation/settings", async (req, res) => {
  try {
    // Always return the same stable settings to prevent polling from detecting changes
    res.json(currentSettings);
  } catch (error) {
    res.status(500).json({
      error: "Failed to get validation settings",
      message: error.message
    });
  }
});

// Update validation settings
app.put("/api/validation/settings", async (req, res) => {
  try {
    const updates = req.body;
    
    // Update the current settings
    if (updates.settings) {
      currentSettings.settings = { ...currentSettings.settings, ...updates.settings };
    }
    if (updates.name) {
      currentSettings.name = updates.name;
    }
    
    // Update timestamp and hash to indicate change
    currentSettings.updatedAt = new Date().toISOString();
    currentSettings.settingsHash = `updated-${Date.now()}`;
    
    res.json({
      success: true,
      message: "Validation settings updated successfully",
      settings: currentSettings
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to update validation settings",
      message: error.message
    });
  }
});

// Validation progress endpoints
app.get("/api/validation/progress", async (req, res) => {
  try {
    res.json({
      isRunning: false,
      progress: 0,
      totalResources: 100,
      processedResources: 0,
      errors: 0,
      warnings: 0,
      startTime: null,
      endTime: null,
      currentResource: null,
      status: "idle"
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to get validation progress",
      message: error.message
    });
  }
});

// Recent errors endpoint
app.get("/api/validation/recent-errors", async (req, res) => {
  try {
    res.json([]);
  } catch (error) {
    res.status(500).json({
      error: "Failed to get recent errors",
      message: error.message
    });
  }
});

// FHIR server connection endpoints
app.post("/api/fhir/servers/connect", async (req, res) => {
  try {
    const { serverId } = req.body;
    res.json({
      success: true,
      message: "Server connected successfully",
      serverId: serverId || 1,
      connectedAt: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to connect to server",
      message: error.message
    });
  }
});

app.post("/api/fhir/servers/disconnect", async (req, res) => {
  try {
    res.json({
      success: true,
      message: "Server disconnected successfully",
      disconnectedAt: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to disconnect server",
      message: error.message
    });
  }
});

// Server activation/deactivation endpoints
app.post("/api/fhir/servers/:serverId/activate", async (req, res) => {
  try {
    const { serverId } = req.params;
    const server = mockFhirServers.find(s => s.id === parseInt(serverId));
    
    if (!server) {
      return res.status(404).json({
        error: "Server not found",
        message: `Server with ID ${serverId} not found`
      });
    }
    
    res.json({
      success: true,
      message: `Server "${server.name}" activated successfully`,
      serverId: parseInt(serverId),
      serverName: server.name,
      activatedAt: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to activate server",
      message: error.message
    });
  }
});

app.post("/api/fhir/servers/:serverId/deactivate", async (req, res) => {
  try {
    const { serverId } = req.params;
    const server = mockFhirServers.find(s => s.id === parseInt(serverId));
    
    if (!server) {
      return res.status(404).json({
        error: "Server not found",
        message: `Server with ID ${serverId} not found`
      });
    }
    
    res.json({
      success: true,
      message: `Server "${server.name}" deactivated successfully`,
      serverId: parseInt(serverId),
      serverName: server.name,
      deactivatedAt: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to deactivate server",
      message: error.message
    });
  }
});

// Get specific server details
app.get("/api/fhir/servers/:serverId", async (req, res) => {
  try {
    const { serverId } = req.params;
    const server = mockFhirServers.find(s => s.id === parseInt(serverId));
    
    if (!server) {
      return res.status(404).json({
        error: "Server not found",
        message: `Server with ID ${serverId} not found`
      });
    }
    
    res.json({
      id: server.id,
      name: server.name,
      url: server.url,
      isActive: server.isActive,
      hasAuth: false,
      authType: 'none',
      createdAt: new Date().toISOString(),
      lastConnected: server.isActive ? new Date().toISOString() : null,
      status: server.isActive ? 'connected' : 'disconnected'
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to get server details",
      message: error.message
    });
  }
});

// Update server endpoint
app.put("/api/fhir/servers/:serverId", async (req, res) => {
  try {
    const { serverId } = req.params;
    const updates = req.body;
    
    const server = mockFhirServers.find(s => s.id === parseInt(serverId));
    
    if (!server) {
      return res.status(404).json({
        error: "Server not found",
        message: `Server with ID ${serverId} not found`
      });
    }
    
    // Update server properties
    if (updates.name) server.name = updates.name;
    if (updates.url) server.url = updates.url;
    if (updates.isActive !== undefined) server.isActive = updates.isActive;
    
    res.json({
      success: true,
      message: "Server updated successfully",
      server: {
        id: server.id,
        name: server.name,
        url: server.url,
        isActive: server.isActive,
        hasAuth: false,
        authType: 'none',
        updatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to update server",
      message: error.message
    });
  }
});

// Create new server endpoint
app.post("/api/fhir/servers", async (req, res) => {
  try {
    const { name, url } = req.body;
    
    if (!name || !url) {
      return res.status(400).json({
        error: "Missing required fields",
        message: "Name and URL are required"
      });
    }
    
    const newServer = {
      id: mockFhirServers.length + 1,
      name,
      url,
      isActive: false
    };
    
    mockFhirServers.push(newServer);
    
    res.status(201).json({
      success: true,
      message: "Server created successfully",
      server: {
        id: newServer.id,
        name: newServer.name,
        url: newServer.url,
        isActive: newServer.isActive,
        hasAuth: false,
        authType: 'none',
        createdAt: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to create server",
      message: error.message
    });
  }
});

// Delete server endpoint
app.delete("/api/fhir/servers/:serverId", async (req, res) => {
  try {
    const { serverId } = req.params;
    const serverIndex = mockFhirServers.findIndex(s => s.id === parseInt(serverId));
    
    if (serverIndex === -1) {
      return res.status(404).json({
        error: "Server not found",
        message: `Server with ID ${serverId} not found`
      });
    }
    
    const server = mockFhirServers[serverIndex];
    mockFhirServers.splice(serverIndex, 1);
    
    res.json({
      success: true,
      message: `Server "${server.name}" deleted successfully`,
      serverId: parseInt(serverId),
      deletedAt: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to delete server",
      message: error.message
    });
  }
});

// Dashboard specific endpoints
app.get("/api/dashboard/fhir-server-stats", async (req, res) => {
  try {
    res.json({
      totalResources: 100,
      connectedServers: 1,
      activeServers: 1,
      totalCapacity: 1000,
      usedCapacity: 100,
      averageResponseTime: 150.0,
      uptime: 99.9,
      lastConnected: new Date().toISOString(),
      serverBreakdown: [
        { 
          serverId: 1, 
          name: "HAPI Test Server", 
          resourceCount: 100, 
          status: "connected",
          responseTime: 150.0,
          uptime: 99.9,
          lastConnected: new Date().toISOString()
        }
      ]
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to get FHIR server stats",
      message: error.message
    });
  }
});

app.get("/api/dashboard/validation-stats", async (req, res) => {
  try {
    res.json({
      totalResources: 100,
      validResources: 60,
      errorResources: 15,
      warningResources: 12,
      unvalidatedResources: 25,
      validationCoverage: 75.0,
      validationProgress: 75.0,
      activeProfiles: 3,
      successRate: 85.0,
      averageValidationTime: 2.5,
      lastValidationTime: new Date().toISOString(),
      aspectBreakdown: {
        structural: { total: 100, errors: 5, warnings: 10, info: 15, score: 85.0 },
        profile: { total: 100, errors: 8, warnings: 12, info: 20, score: 80.0 },
        terminology: { total: 100, errors: 2, warnings: 8, info: 5, score: 95.0 },
        reference: { total: 100, errors: 0, warnings: 3, info: 2, score: 97.0 },
        businessRule: { total: 100, errors: 0, warnings: 2, info: 1, score: 98.0 },
        metadata: { total: 100, errors: 0, warnings: 1, info: 0, score: 99.0 }
      },
      resourceBreakdown: [
        { type: "Patient", count: 45, valid: 40, errors: 3, warnings: 2 },
        { type: "Observation", count: 30, valid: 25, errors: 2, warnings: 3 },
        { type: "Encounter", count: 15, valid: 12, errors: 1, warnings: 2 },
        { type: "Medication", count: 10, valid: 8, errors: 1, warnings: 1 }
      ]
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to get validation stats",
      message: error.message
    });
  }
});

app.get("/api/dashboard/combined", async (req, res) => {
  try {
    res.json({
      fhirServerStats: {
        totalResources: 100,
        connectedServers: 1,
        activeServers: 1,
        totalCapacity: 1000,
        usedCapacity: 100,
        averageResponseTime: 150.0,
        uptime: 99.9,
        lastConnected: new Date().toISOString()
      },
      validationStats: {
        totalResources: 100,
        validResources: 60,
        errorResources: 15,
        warningResources: 12,
        unvalidatedResources: 25,
        validationCoverage: 75.0,
        validationProgress: 75.0,
        activeProfiles: 3,
        successRate: 85.0,
        averageValidationTime: 2.5,
        lastValidationTime: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to get combined dashboard data",
      message: error.message
    });
  }
});

// FHIR resource counts endpoint
app.get("/api/fhir/resource-counts", async (req, res) => {
  try {
    res.json({
      Patient: 45,
      Observation: 30,
      Encounter: 15,
      Medication: 10
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to get resource counts",
      message: error.message
    });
  }
});

// FHIR connection test endpoint
app.get("/api/fhir/connection/test", async (req, res) => {
  try {
    res.json({
      connected: true,
      serverId: 1,
      serverName: "HAPI Test Server",
      lastTested: new Date().toISOString(),
      responseTime: 150
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to test FHIR connection",
      message: error.message
    });
  }
});

// Validation bulk progress endpoint
app.get("/api/validation/bulk/progress", async (req, res) => {
  try {
    res.json({
      isRunning: false,
      progress: 0,
      totalResources: 100,
      processedResources: 0,
      errors: 0,
      warnings: 0,
      startTime: null,
      endTime: null,
      currentResource: null,
      status: "idle"
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to get bulk validation progress",
      message: error.message
    });
  }
});

// Validation errors recent endpoint
app.get("/api/validation/errors/recent", async (req, res) => {
  try {
    res.json([]);
  } catch (error) {
    res.status(500).json({
      error: "Failed to get recent validation errors",
      message: error.message
    });
  }
});

// Validation settings notify change endpoint
app.post("/api/validation/settings/notify-change", async (req, res) => {
  try {
    res.json({
      success: true,
      message: "Settings change notification sent",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to notify settings change",
      message: error.message
    });
  }
});

// Validation queue endpoints
app.get("/api/validation/queue/stats", async (req, res) => {
  try {
    res.json({
      totalItems: 0,
      pendingItems: 0,
      processingItems: 0,
      completedItems: 0,
      failedItems: 0,
      averageProcessingTime: 0,
      queueHealth: "healthy"
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to get queue stats",
      message: error.message
    });
  }
});

app.get("/api/validation/queue/items", async (req, res) => {
  try {
    res.json([]);
  } catch (error) {
    res.status(500).json({
      error: "Failed to get queue items",
      message: error.message
    });
  }
});

app.get("/api/validation/queue/processing", async (req, res) => {
  try {
    res.json([]);
  } catch (error) {
    res.status(500).json({
      error: "Failed to get processing items",
      message: error.message
    });
  }
});

// Individual resource progress endpoints
app.get("/api/validation/progress/individual/stats", async (req, res) => {
  try {
    res.json({
      totalTracked: 0,
      activeTracked: 0,
      completedTracked: 0,
      failedTracked: 0,
      averageProcessingTime: 0,
      successRate: 100
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to get individual progress stats",
      message: error.message
    });
  }
});

app.get("/api/validation/progress/individual/active", async (req, res) => {
  try {
    res.json([]);
  } catch (error) {
    res.status(500).json({
      error: "Failed to get active individual progress",
      message: error.message
    });
  }
});

app.get("/api/validation/progress/individual/completed", async (req, res) => {
  try {
    res.json([]);
  } catch (error) {
    res.status(500).json({
      error: "Failed to get completed individual progress",
      message: error.message
    });
  }
});

// Validation cancellation retry endpoints
app.get("/api/validation/cancellation-retry/stats", async (req, res) => {
  try {
    res.json({
      totalCancellations: 0,
      totalRetries: 0,
      activeCancellations: 0,
      activeRetries: 0,
      successRate: 100,
      averageCancellationTime: 0,
      averageRetryTime: 0
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to get cancellation retry stats",
      message: error.message
    });
  }
});

app.get("/api/validation/cancellation-retry/active", async (req, res) => {
  try {
    res.json([]);
  } catch (error) {
    res.status(500).json({
      error: "Failed to get active cancellation retry operations",
      message: error.message
    });
  }
});

// Resource validation endpoints
app.get("/api/resources", async (req, res) => {
  try {
    const { page = 1, limit = 20, resourceType, search } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    // Mock resource data with consistent validation summaries
    const specificMockResources = [
      {
        id: "ce41f987-394a-482a-b2eb-26e11b9458b0",
        resourceType: "OperationOutcome",
        lastUpdated: new Date().toISOString()
      },
      {
        id: "8289768c-e3ce-47a3-a998-37bb93cfe3de",
        resourceType: "Patient",
        lastUpdated: new Date().toISOString(),
        name: [{ given: ["Bhushan"], family: "Kawale" }],
        birthDate: "1999-09-10",
        gender: "male"
      },
      {
        id: "38257ff2-35c6-4f5c-a0a9-58375bcc9b35",
        resourceType: "OperationOutcome",
        lastUpdated: new Date().toISOString()
      },
      {
        id: "c774849f-b725-460d-8b3e-e4e40714d7fa",
        resourceType: "Binary",
        lastUpdated: new Date().toISOString()
      },
      {
        id: "1934234",
        resourceType: "AllergyIntolerance",
        lastUpdated: new Date().toISOString()
      }
    ];
    
    // Add validation summaries to specific mock resources
    const mockResources = specificMockResources.map(resource => {
      let validationSummary;
      if (validationResults.has(resource.id)) {
        validationSummary = validationResults.get(resource.id);
      } else {
        validationSummary = calculateValidationSummary(resource.id);
        validationResults.set(resource.id, validationSummary);
      }
      
      return {
        ...resource,
        _validationSummary: validationSummary
      };
    });
    
    // Generate more mock resources with consistent validation data
    const allResources = [];
    for (let i = 0; i < 10000; i++) {
      const resourceTypes = ["Patient", "Observation", "Encounter", "Medication", "Condition", "Procedure"];
      const resourceType = resourceTypes[i % resourceTypes.length];
      const resourceId = `${resourceType.toLowerCase()}-${i + 1}`;
      
      // Get consistent validation summary for this resource
      let validationSummary;
      if (validationResults.has(resourceId)) {
        validationSummary = validationResults.get(resourceId);
      } else {
        // Generate consistent validation summary based on resource ID
        validationSummary = calculateValidationSummary(resourceId);
        validationResults.set(resourceId, validationSummary);
      }
      
      allResources.push({
        id: resourceId,
        resourceType,
        lastUpdated: new Date(Date.now() - Math.random() * 86400000).toISOString(),
        _validationSummary: validationSummary
      });
    }
    
    // Filter by resource type if specified
    let filteredResources = allResources;
    if (resourceType && resourceType !== "All Resource Types") {
      filteredResources = allResources.filter(r => r.resourceType === resourceType);
    }
    
    // Filter by search term if specified
    if (search) {
      filteredResources = filteredResources.filter(r => 
        r.id.toLowerCase().includes(search.toLowerCase()) ||
        r.resourceType.toLowerCase().includes(search.toLowerCase())
      );
    }
    
    // Paginate
    const totalCount = filteredResources.length;
    const paginatedResources = filteredResources.slice(offset, offset + parseInt(limit));
    
    res.json({
      resources: paginatedResources,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        totalPages: Math.ceil(totalCount / parseInt(limit))
      },
      totalCount
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to get resources",
      message: error.message
    });
  }
});

// Store validation results to ensure consistency between list and detail views
const validationResults = new Map();

// Helper function to calculate consistent validation summary
function calculateValidationSummary(resourceId, baseScore = null) {
  // Use base score if provided, otherwise generate consistent score based on resource ID
  let score;
  if (baseScore !== null) {
    score = baseScore;
  } else {
    // Generate consistent score based on resource ID hash
    const hash = resourceId.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    score = Math.abs(hash) % 40 + 60; // 60-100
  }
  
  const errorCount = score < 80 ? Math.floor(Math.random() * 3) + 1 : 0;
  const warningCount = score < 90 ? Math.floor(Math.random() * 5) + 1 : 0;
  const infoCount = Math.floor(Math.random() * 8) + 1;
  
  const isValid = score >= 85 && errorCount === 0;
  
  return {
    isValid,
    validationScore: score,
    errorCount,
    warningCount,
    infoCount,
    validatedAt: new Date().toISOString(),
    status: "completed"
  };
}

// Validate specific resources
app.post("/api/validation/validate-by-ids", async (req, res) => {
  try {
    const { resourceIds, forceRevalidation = false } = req.body;
    
    if (!resourceIds || !Array.isArray(resourceIds)) {
      return res.status(400).json({
        error: "Invalid request",
        message: "resourceIds must be an array"
      });
    }
    
    // Generate consistent validation results and store them
    const results = resourceIds.map(resourceId => {
      const summary = calculateValidationSummary(resourceId);
      validationResults.set(resourceId, summary);
      
      return {
        resourceId,
        ...summary
      };
    });
    
    res.json({
      success: true,
      message: `Validated ${resourceIds.length} resources`,
      results,
      totalProcessed: resourceIds.length,
      completedAt: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to validate resources",
      message: error.message
    });
  }
});

// Get resource validation status
app.get("/api/resources/:resourceId/validation", async (req, res) => {
  try {
    const { resourceId } = req.params;
    
    // Get stored validation result or generate consistent one
    let validationResult;
    if (validationResults.has(resourceId)) {
      validationResult = validationResults.get(resourceId);
    } else {
      validationResult = calculateValidationSummary(resourceId);
      validationResults.set(resourceId, validationResult);
    }
    
    res.json({
      resourceId,
      ...validationResult,
      issues: [] // Add empty issues array for detail view
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to get resource validation status",
      message: error.message
    });
  }
});

// Validation settings sync endpoint
app.post("/api/validation/settings/sync", async (req, res) => {
  try {
    // Quick sync - no delay needed for mock
    res.json({
      success: true,
      message: "Settings synchronized successfully",
      syncedAt: new Date().toISOString(),
      settingsHash: currentSettings.settingsHash,
      isSynced: true
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to sync validation settings",
      message: error.message
    });
  }
});

// Check settings sync status
app.get("/api/validation/settings/sync-status", async (req, res) => {
  try {
    res.json({
      isSynced: true,
      lastSyncAt: new Date().toISOString(),
      settingsHash: currentSettings.settingsHash,
      syncStatus: "completed"
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to get sync status",
      message: error.message
    });
  }
});

// API route handler - catch all API routes and return 404 if not found
app.use("/api/*", (req, res) => {
  log(`API route not found: ${req.method} ${req.path}`);
  res.status(404).json({
    error: "API endpoint not found",
    message: `No handler for ${req.method} ${req.path}`,
    path: req.path,
    method: req.method
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  log(`Error: ${status} - ${message}`);
  res.status(status).json({ message });
});

// Serve static files (must be last)
const distPath = path.resolve(__dirname, "../dist/public");

if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  
  // fall through to index.html if the file doesn't exist (for SPA routing)
  app.use("*", (req, res) => {
    log(`Serving index.html for: ${req.path}`);
    res.sendFile(path.resolve(distPath, "index.html"));
  });
} else {
  // Fallback if static files don't exist
  app.use("*", (req, res) => {
    log(`Static files not found for: ${req.path}`);
    res.status(404).json({
      error: "Static files not found",
      message: "Please ensure the frontend is built before deployment"
    });
  });
}

// Export for Vercel
export default app;
