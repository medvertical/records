import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { eq, desc } from 'drizzle-orm';
import { pgTable, text, serial, boolean, jsonb, timestamp } from 'drizzle-orm/pg-core';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Define fhirServers schema inline (matching shared/schema.ts)
const fhirServers = pgTable("fhir_servers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  url: text("url").notNull(),
  isActive: boolean("is_active").default(false),
  authConfig: jsonb("auth_config"),
  fhirVersion: text("fhir_version"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Initialize database connection for Vercel serverless
let db = null;
let dbConnected = false;
let dbError = null;

try {
  // Check multiple possible environment variable names
  const connectionString = 
    process.env.DATABASE_URL || 
    process.env.POSTGRES_URL || 
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL_NON_POOLING;
  
  if (connectionString) {
    const sql = neon(connectionString);
    db = drizzle(sql);
    dbConnected = true;
    console.log('✅ Database connected successfully (Neon serverless)');
    console.log('📊 Using connection string from:', 
      process.env.DATABASE_URL ? 'DATABASE_URL' :
      process.env.POSTGRES_URL ? 'POSTGRES_URL' :
      process.env.POSTGRES_PRISMA_URL ? 'POSTGRES_PRISMA_URL' :
      'POSTGRES_URL_NON_POOLING'
    );
  } else {
    console.warn('⚠️  No DATABASE_URL, POSTGRES_URL, or POSTGRES_PRISMA_URL found');
    console.warn('⚠️  Available env vars:', Object.keys(process.env).filter(k => k.includes('POSTGRES') || k.includes('DATABASE')).join(', '));
    console.warn('⚠️  Using mock data');
  }
} catch (error) {
  dbError = error.message;
  console.error('❌ Database connection failed:', error.message);
  console.warn('⚠️  Falling back to mock data');
}

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

// ============================================================================
// FHIR Client - Fetch Real Data from FHIR Servers
// ============================================================================

class FhirClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  }

  async fetchResources(resourceType, params = {}) {
    try {
      const queryParams = new URLSearchParams();
      if (params._count) queryParams.append('_count', params._count);
      if (params._offset) queryParams.append('_offset', params._offset);
      if (params._sort) queryParams.append('_sort', params._sort);
      
      const url = `${this.baseUrl}/${resourceType}?${queryParams.toString()}`;
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/fhir+json',
          'Content-Type': 'application/fhir+json'
        },
        timeout: 10000
      });

      if (!response.ok) {
        throw new Error(`FHIR server returned ${response.status}`);
      }

      const bundle = await response.json();
      return {
        resources: bundle.entry ? bundle.entry.map(e => e.resource) : [],
        total: bundle.total || 0
      };
    } catch (error) {
      log(`FHIR fetch error: ${error.message}`, 'fhir-client');
      return { resources: [], total: 0, error: error.message };
    }
  }

  async fetchResource(resourceType, id) {
    try {
      const url = `${this.baseUrl}/${resourceType}/${id}`;
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/fhir+json',
          'Content-Type': 'application/fhir+json'
        },
        timeout: 10000
      });

      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`FHIR server returned ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      log(`FHIR fetch error: ${error.message}`, 'fhir-client');
      return null;
    }
  }

  async getResourceTypes() {
    try {
      const url = `${this.baseUrl}/metadata`;
      const response = await fetch(url, {
        headers: { 'Accept': 'application/fhir+json' },
        timeout: 10000
      });

      if (!response.ok) {
        throw new Error(`FHIR server returned ${response.status}`);
      }

      const metadata = await response.json();
      const resourceTypes = [];
      
      if (metadata.rest && metadata.rest[0] && metadata.rest[0].resource) {
        metadata.rest[0].resource.forEach(r => {
          if (r.type) resourceTypes.push(r.type);
        });
      }

      return resourceTypes.length > 0 ? resourceTypes : [
        'Patient', 'Observation', 'Encounter', 'Condition', 
        'Procedure', 'MedicationRequest', 'AllergyIntolerance'
      ];
    } catch (error) {
      log(`FHIR metadata error: ${error.message}`, 'fhir-client');
      return ['Patient', 'Observation', 'Encounter', 'Condition'];
    }
  }

  async getResourceCount(resourceType) {
    try {
      const url = `${this.baseUrl}/${resourceType}?_summary=count`;
      const response = await fetch(url, {
        headers: { 'Accept': 'application/fhir+json' },
        timeout: 10000
      });

      if (!response.ok) {
        throw new Error(`FHIR server returned ${response.status}`);
      }

      const bundle = await response.json();
      return bundle.total || 0;
    } catch (error) {
      log(`FHIR count error for ${resourceType}: ${error.message}`, 'fhir-client');
      return 0;
    }
  }
}

// Get active FHIR server and create client
async function getActiveFhirClient() {
  try {
    if (dbConnected && db) {
      const servers = await db.select().from(fhirServers).where(eq(fhirServers.isActive, true)).limit(1);
      if (servers.length > 0) {
        log(`Using FHIR server: ${servers[0].name} (${servers[0].url})`, 'fhir-client');
        return new FhirClient(servers[0].url);
      }
    }
    log('No active FHIR server found', 'fhir-client');
    return null;
  } catch (error) {
    log(`Error getting active server: ${error.message}`, 'fhir-client');
    return null;
  }
}

// Basic API routes with fallbacks for Vercel deployment
app.get("/api/health", async (req, res) => {
  try {
    res.json({ 
      status: "ok", 
      timestamp: new Date().toISOString(),
      services: {
        database: dbConnected ? "connected" : "disconnected",
        databaseError: dbError || undefined,
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

// Server Management Endpoints (Primary API)
app.get("/api/servers", async (req, res) => {
  try {
    let servers, activeServer;
    
    if (dbConnected && db) {
      // Use real database
      const dbServers = await db.select().from(fhirServers).orderBy(desc(fhirServers.createdAt));
      servers = dbServers.map(server => ({
        id: server.id,
        name: server.name,
        url: server.url,
        isActive: server.isActive || false,
        hasAuth: !!server.authConfig,
        authType: server.authConfig?.type || 'none',
        fhirVersion: server.fhirVersion || 'R4',
        createdAt: server.createdAt?.toISOString() || new Date().toISOString()
      }));
      activeServer = servers.find(s => s.isActive) || null;
    } else {
      // Fallback to mock data
      servers = mockFhirServers.map(server => ({
        id: server.id,
        name: server.name,
        url: server.url,
        isActive: server.isActive,
        hasAuth: false,
        authType: 'none',
        createdAt: new Date().toISOString()
      }));
      activeServer = servers.find(s => s.isActive) || null;
    }
    
    res.json({
      servers,
      activeServer
    });
  } catch (error) {
    console.error('Error fetching servers:', error);
    res.status(500).json({
      error: "Failed to get servers",
      message: error.message
    });
  }
});

app.get("/api/servers/:id", async (req, res) => {
  try {
    const { id } = req.params;
    let server;
    
    if (dbConnected && db) {
      // Use real database
      const dbServer = await db.select().from(fhirServers).where(eq(fhirServers.id, parseInt(id))).limit(1);
      if (dbServer.length === 0) {
        return res.status(404).json({
          error: "Server not found",
          message: `Server with ID ${id} not found`
        });
      }
      server = dbServer[0];
      res.json({
        id: server.id,
        name: server.name,
        url: server.url,
        isActive: server.isActive || false,
        hasAuth: !!server.authConfig,
        authType: server.authConfig?.type || 'none',
        fhirVersion: server.fhirVersion || 'R4',
        createdAt: server.createdAt?.toISOString() || new Date().toISOString(),
        updatedAt: server.createdAt?.toISOString() || new Date().toISOString()
      });
    } else {
      // Fallback to mock data
      server = mockFhirServers.find(s => s.id === parseInt(id));
      
      if (!server) {
        return res.status(404).json({
          error: "Server not found",
          message: `Server with ID ${id} not found`
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
        updatedAt: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('Error fetching server:', error);
    res.status(500).json({
      error: "Failed to get server",
      message: error.message
    });
  }
});

app.post("/api/servers", async (req, res) => {
  try {
    const { name, url, auth, fhirVersion } = req.body;
    
    if (!name || !url) {
      return res.status(400).json({
        error: "Missing required fields",
        message: "Name and URL are required"
      });
    }
    
    if (dbConnected && db) {
      // Use real database
      const authConfig = auth ? { type: auth.type || 'none', ...auth } : null;
      const result = await db.insert(fhirServers).values({
        name,
        url,
        isActive: false,
        authConfig,
        fhirVersion: fhirVersion || 'R4'
      }).returning();
      
      const newServer = result[0];
      res.status(201).json({
        id: newServer.id,
        name: newServer.name,
        url: newServer.url,
        isActive: newServer.isActive || false,
        hasAuth: !!newServer.authConfig,
        authType: newServer.authConfig?.type || 'none',
        fhirVersion: newServer.fhirVersion || 'R4',
        createdAt: newServer.createdAt?.toISOString() || new Date().toISOString(),
        updatedAt: newServer.createdAt?.toISOString() || new Date().toISOString()
      });
    } else {
      // Fallback to mock data
      const newServer = {
        id: mockFhirServers.length + 1,
        name,
        url,
        isActive: false
      };
      
      mockFhirServers.push(newServer);
      
      res.status(201).json({
        id: newServer.id,
        name: newServer.name,
        url: newServer.url,
        isActive: newServer.isActive,
        hasAuth: false,
        authType: 'none',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('Error creating server:', error);
    res.status(500).json({
      error: "Failed to create server",
      message: error.message
    });
  }
});

app.put("/api/servers/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    if (dbConnected && db) {
      // Use real database
      const existingServer = await db.select().from(fhirServers).where(eq(fhirServers.id, parseInt(id))).limit(1);
      
      if (existingServer.length === 0) {
        return res.status(404).json({
          error: "Server not found",
          message: `Server with ID ${id} not found`
        });
      }
      
      const updateData = {};
      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.url !== undefined) updateData.url = updates.url;
      if (updates.isActive !== undefined) updateData.isActive = updates.isActive;
      if (updates.fhirVersion !== undefined) updateData.fhirVersion = updates.fhirVersion;
      if (updates.auth !== undefined) {
        updateData.authConfig = updates.auth ? { type: updates.auth.type || 'none', ...updates.auth } : null;
      }
      
      const result = await db.update(fhirServers).set(updateData).where(eq(fhirServers.id, parseInt(id))).returning();
      const server = result[0];
      
      res.json({
        id: server.id,
        name: server.name,
        url: server.url,
        isActive: server.isActive || false,
        hasAuth: !!server.authConfig,
        authType: server.authConfig?.type || 'none',
        fhirVersion: server.fhirVersion || 'R4',
        updatedAt: new Date().toISOString()
      });
    } else {
      // Fallback to mock data
      const server = mockFhirServers.find(s => s.id === parseInt(id));
      
      if (!server) {
        return res.status(404).json({
          error: "Server not found",
          message: `Server with ID ${id} not found`
        });
      }
      
      // Update server properties
      if (updates.name) server.name = updates.name;
      if (updates.url) server.url = updates.url;
      if (updates.isActive !== undefined) server.isActive = updates.isActive;
      
      res.json({
        id: server.id,
        name: server.name,
        url: server.url,
        isActive: server.isActive,
        hasAuth: false,
        authType: 'none',
        updatedAt: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('Error updating server:', error);
    res.status(500).json({
      error: "Failed to update server",
      message: error.message
    });
  }
});

app.delete("/api/servers/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    if (dbConnected && db) {
      // Use real database
      const existingServer = await db.select().from(fhirServers).where(eq(fhirServers.id, parseInt(id))).limit(1);
      
      if (existingServer.length === 0) {
        return res.status(404).json({
          error: "Server not found",
          message: `Server with ID ${id} not found`
        });
      }
      
      const server = existingServer[0];
      await db.delete(fhirServers).where(eq(fhirServers.id, parseInt(id)));
      
      res.json({
        success: true,
        message: `Server "${server.name}" deleted successfully`
      });
    } else {
      // Fallback to mock data
      const serverIndex = mockFhirServers.findIndex(s => s.id === parseInt(id));
      
      if (serverIndex === -1) {
        return res.status(404).json({
          error: "Server not found",
          message: `Server with ID ${id} not found`
        });
      }
      
      const server = mockFhirServers[serverIndex];
      mockFhirServers.splice(serverIndex, 1);
      
      res.json({
        success: true,
        message: `Server "${server.name}" deleted successfully`
      });
    }
  } catch (error) {
    console.error('Error deleting server:', error);
    res.status(500).json({
      error: "Failed to delete server",
      message: error.message
    });
  }
});

app.post("/api/servers/:id/activate", async (req, res) => {
  try {
    const { id } = req.params;
    
    if (dbConnected && db) {
      // Use real database
      const existingServer = await db.select().from(fhirServers).where(eq(fhirServers.id, parseInt(id))).limit(1);
      
      if (existingServer.length === 0) {
        return res.status(404).json({
          error: "Server not found",
          message: `Server with ID ${id} not found`
        });
      }
      
      const server = existingServer[0];
      
      // Deactivate all servers first
      await db.update(fhirServers).set({ isActive: false });
      
      // Activate this server
      await db.update(fhirServers).set({ isActive: true }).where(eq(fhirServers.id, parseInt(id)));
      
      res.json({
        success: true,
        message: `Server "${server.name}" activated successfully`,
        server: {
          id: server.id,
          name: server.name,
          url: server.url,
          isActive: true
        }
      });
    } else {
      // Fallback to mock data
      const server = mockFhirServers.find(s => s.id === parseInt(id));
      
      if (!server) {
        return res.status(404).json({
          error: "Server not found",
          message: `Server with ID ${id} not found`
        });
      }
      
      // Deactivate all other servers
      mockFhirServers.forEach(s => s.isActive = false);
      // Activate this server
      server.isActive = true;
      
      res.json({
        success: true,
        message: `Server "${server.name}" activated successfully`,
        server: {
          id: server.id,
          name: server.name,
          url: server.url,
          isActive: server.isActive
        }
      });
    }
  } catch (error) {
    console.error('Error activating server:', error);
    res.status(500).json({
      error: "Failed to activate server",
      message: error.message
    });
  }
});

app.post("/api/servers/:id/test", async (req, res) => {
  try {
    const { id } = req.params;
    const server = mockFhirServers.find(s => s.id === parseInt(id));
    
    if (!server) {
      return res.status(404).json({
        error: "Server not found",
        message: `Server with ID ${id} not found`
      });
    }
    
    // Mock successful connection test
    res.json({
      success: true,
      connected: true,
      serverName: server.name,
      url: server.url,
      responseTime: Math.floor(Math.random() * 200) + 50,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to test server",
      message: error.message
    });
  }
});

app.get("/api/servers/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const server = mockFhirServers.find(s => s.id === parseInt(id));
    
    if (!server) {
      return res.status(404).json({
        error: "Server not found",
        message: `Server with ID ${id} not found`
      });
    }
    
    res.json({
      isOnline: server.isActive,
      lastChecked: new Date().toISOString(),
      responseTime: Math.floor(Math.random() * 200) + 50
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to get server status",
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

// Get validation resource types for specific FHIR version
app.get("/api/validation/resource-types/:fhirVersion", async (req, res) => {
  try {
    const { fhirVersion } = req.params;
    
    // Return common FHIR resource types based on version
    const resourceTypes = {
      'R4': [
        'Patient', 'Practitioner', 'Organization', 'Location',
        'Observation', 'Condition', 'Procedure', 'MedicationRequest',
        'Encounter', 'AllergyIntolerance', 'DiagnosticReport', 'CarePlan',
        'Immunization', 'DocumentReference', 'Binary', 'Bundle',
        'Composition', 'Device', 'Medication', 'Specimen'
      ],
      'R5': [
        'Patient', 'Practitioner', 'Organization', 'Location',
        'Observation', 'Condition', 'Procedure', 'MedicationRequest',
        'Encounter', 'AllergyIntolerance', 'DiagnosticReport', 'CarePlan'
      ],
      'STU3': [
        'Patient', 'Practitioner', 'Organization', 'Location',
        'Observation', 'Condition', 'Procedure', 'MedicationRequest',
        'Encounter', 'AllergyIntolerance'
      ]
    };
    
    const types = resourceTypes[fhirVersion] || resourceTypes['R4'];
    
    res.json({
      fhirVersion,
      resourceTypes: types,
      count: types.length
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to get resource types",
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

// FHIR resource types endpoint - REAL DATA
app.get("/api/fhir/resource-types", async (req, res) => {
  try {
    const fhirClient = await getActiveFhirClient();
    
    if (fhirClient) {
      const resourceTypes = await fhirClient.getResourceTypes();
      res.json(resourceTypes);
    } else {
      // Fallback to common types if no active server
      res.json([
        "Patient",
        "Observation",
        "Encounter",
        "Condition",
        "Procedure",
        "MedicationRequest",
        "AllergyIntolerance"
      ]);
    }
  } catch (error) {
    log(`Error fetching resource types: ${error.message}`, 'api');
    res.status(500).json({
      error: "Failed to get resource types",
      message: error.message
    });
  }
});

// FHIR resources endpoint - REAL DATA from FHIR server
app.get("/api/fhir/resources", async (req, res) => {
  try {
    const { limit = 20, offset = 0, resourceType, search } = req.query;
    const fhirClient = await getActiveFhirClient();
    
    if (!fhirClient) {
      return res.json({
        resources: [],
        pagination: { page: 1, limit: parseInt(limit), total: 0, totalPages: 0 },
        totalCount: 0,
        message: "No active FHIR server configured"
      });
    }

    // Use resourceType or default to Patient
    const typeToFetch = resourceType && resourceType !== "All Resource Types" ? resourceType : "Patient";
    
    const result = await fhirClient.fetchResources(typeToFetch, {
      _count: parseInt(limit),
      _offset: parseInt(offset)
    });

    if (result.error) {
      return res.json({
        resources: [],
        pagination: { page: 1, limit: parseInt(limit), total: 0, totalPages: 0 },
        totalCount: 0,
        error: result.error
      });
    }

    // Add mock validation summaries for now (TODO: implement real validation)
    const resourcesWithValidation = result.resources.map(resource => ({
      ...resource,
      _validationSummary: {
        isValid: true,
        validationScore: 95,
        errorCount: 0,
        warningCount: 0,
        infoCount: 0,
        validatedAt: new Date().toISOString(),
        status: "pending"
      }
    }));

    res.json({
      resources: resourcesWithValidation,
      pagination: {
        page: Math.floor(parseInt(offset) / parseInt(limit)) + 1,
        limit: parseInt(limit),
        total: result.total,
        totalPages: Math.ceil(result.total / parseInt(limit))
      },
      totalCount: result.total
    });
  } catch (error) {
    log(`Error fetching FHIR resources: ${error.message}`, 'api');
    res.status(500).json({
      error: "Failed to get resources",
      message: error.message
    });
  }
});

// FHIR resource by ID only - tries to find resourceType from resource data
app.get("/api/fhir/resources/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    // Try to get from /api/resources endpoint which has all resources
    const resourcesResponse = await fetch(`${req.protocol}://${req.get('host')}/api/resources?search=${id}`);
    if (resourcesResponse.ok) {
      const data = await resourcesResponse.json();
      const resource = data.resources?.find(r => r.id === id);
      if (resource) {
        return res.json(resource);
      }
    }
    
    return res.status(404).json({
      error: "Resource not found",
      message: `Resource with ID ${id} not found`
    });
  } catch (error) {
    log(`Error fetching resource ${req.params.id}: ${error.message}`, 'api');
    res.status(500).json({
      error: "Failed to get resource",
      message: error.message
    });
  }
});

// FHIR specific resource endpoint - REAL DATA
app.get("/api/fhir/resources/:resourceType/:id", async (req, res) => {
  try {
    const { resourceType, id } = req.params;
    const fhirClient = await getActiveFhirClient();
    
    if (!fhirClient) {
      return res.status(503).json({
        error: "No active FHIR server",
        message: "Please configure and activate a FHIR server first"
      });
    }

    const resource = await fhirClient.fetchResource(resourceType, id);
    
    if (!resource) {
      return res.status(404).json({
        error: "Resource not found",
        message: `${resourceType}/${id} not found on FHIR server`
      });
    }
    
    res.json(resource);
  } catch (error) {
    log(`Error fetching resource ${req.params.resourceType}/${req.params.id}: ${error.message}`, 'api');
    res.status(500).json({
      error: "Failed to get resource",
      message: error.message
    });
  }
});

// FHIR resource counts endpoint - REAL DATA
app.get("/api/fhir/resource-counts", async (req, res) => {
  try {
    const fhirClient = await getActiveFhirClient();
    
    if (!fhirClient) {
      return res.json({});
    }

    // Fetch counts for common resource types
    const resourceTypes = ['Patient', 'Observation', 'Encounter', 'Condition', 'Procedure', 'MedicationRequest'];
    const counts = {};
    
    // Fetch counts in parallel
    await Promise.all(
      resourceTypes.map(async (type) => {
        try {
          counts[type] = await fhirClient.getResourceCount(type);
        } catch (error) {
          log(`Error getting count for ${type}: ${error.message}`, 'api');
          counts[type] = 0;
        }
      })
    );
    
    res.json(counts);
  } catch (error) {
    log(`Error fetching resource counts: ${error.message}`, 'api');
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
    log(`Validation request received: ${JSON.stringify(req.body)}`, 'validation');
    
    // Accept both 'resourceIds' and 'ids' field names for flexibility
    const resourceIds = req.body.resourceIds || req.body.ids || [];
    const forceRevalidation = req.body.forceRevalidation || false;
    
    if (!Array.isArray(resourceIds)) {
      log(`Invalid resourceIds: ${JSON.stringify({resourceIds, type: typeof resourceIds, body: req.body})}`, 'validation');
      return res.status(400).json({
        error: "Invalid request",
        message: "resourceIds or ids must be an array",
        received: { body: req.body, resourceIds, type: typeof resourceIds }
      });
    }
    
    if (resourceIds.length === 0) {
      return res.json({
        success: true,
        message: "No resources to validate",
        results: [],
        totalProcessed: 0,
        completedAt: new Date().toISOString()
      });
    }
    
    log(`Validating ${resourceIds.length} resources`, 'validation');
    
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
    log(`Validation error: ${error.message}`, 'validation');
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
