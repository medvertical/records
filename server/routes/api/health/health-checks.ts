/**
 * Health Check Endpoints for External FHIR Services
 * 
 * This module provides health check endpoints for monitoring
 * the connectivity and performance of external FHIR services.
 */

import { Router } from 'express';
import { OntoserverClient } from '../../../services/fhir/ontoserver-client';
import { FirelyClient } from '../../../services/fhir/firely-client';

const router = Router();

// Health check response interface
interface HealthCheckResponse {
  service: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  responseTime?: number;
  details?: any;
  error?: string;
  timestamp: string;
}

interface OverallHealthResponse {
  status: 'healthy' | 'unhealthy' | 'degraded';
  services: HealthCheckResponse[];
  timestamp: string;
  summary: {
    total: number;
    healthy: number;
    unhealthy: number;
    degraded: number;
  };
}

/**
 * GET /api/health - Overall health check for all external services
 */
router.get('/', async (req, res) => {
  const timestamp = new Date().toISOString();
  const services: HealthCheckResponse[] = [];
  
  // Check R4 Ontoserver
  try {
    const ontoserverClient = new OntoserverClient();
    const r4Result = await ontoserverClient.testR4Connectivity();
    
    let status: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';
    if (!r4Result.success) {
      status = 'unhealthy';
    } else if ((r4Result.responseTime || 0) > 2000) {
      status = 'degraded';
    }
    
    services.push({
      service: 'R4 Ontoserver',
      status,
      responseTime: r4Result.responseTime,
      details: r4Result.data ? {
        fhirVersion: r4Result.data.fhirVersion,
        software: r4Result.data.software?.name
      } : undefined,
      error: r4Result.error,
      timestamp
    });
  } catch (error) {
    services.push({
      service: 'R4 Ontoserver',
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp
    });
  }
  
  // Check R5 Ontoserver
  try {
    const ontoserverClient = new OntoserverClient();
    const r5Result = await ontoserverClient.testR5Connectivity();
    
    let status: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';
    if (!r5Result.success) {
      status = 'unhealthy';
    } else if ((r5Result.responseTime || 0) > 2000) {
      status = 'degraded';
    }
    
    services.push({
      service: 'R5 Ontoserver',
      status,
      responseTime: r5Result.responseTime,
      details: r5Result.data ? {
        fhirVersion: r5Result.data.fhirVersion,
        software: r5Result.data.software?.name
      } : undefined,
      error: r5Result.error,
      timestamp
    });
  } catch (error) {
    services.push({
      service: 'R5 Ontoserver',
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp
    });
  }
  
  // Check Firely Server
  try {
    const firelyClient = new FirelyClient();
    const firelyResult = await firelyClient.testConnectivity();
    
    let status: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';
    if (!firelyResult.success) {
      status = 'unhealthy';
    } else if ((firelyResult.responseTime || 0) > 1000) {
      status = 'degraded';
    }
    
    services.push({
      service: 'Firely Server',
      status,
      responseTime: firelyResult.responseTime,
      details: firelyResult.data ? {
        fhirVersion: firelyResult.data.fhirVersion,
        software: firelyResult.data.software?.name
      } : undefined,
      error: firelyResult.error,
      timestamp
    });
  } catch (error) {
    services.push({
      service: 'Firely Server',
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp
    });
  }
  
  // Calculate summary
  const summary = {
    total: services.length,
    healthy: services.filter(s => s.status === 'healthy').length,
    unhealthy: services.filter(s => s.status === 'unhealthy').length,
    degraded: services.filter(s => s.status === 'degraded').length
  };
  
  // Determine overall status
  let overallStatus: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';
  if (summary.unhealthy > 0) {
    overallStatus = 'unhealthy';
  } else if (summary.degraded > 0) {
    overallStatus = 'degraded';
  }
  
  const response: OverallHealthResponse = {
    status: overallStatus,
    services,
    timestamp,
    summary
  };
  
  // Set appropriate HTTP status code
  const httpStatus = overallStatus === 'healthy' ? 200 : 
                    overallStatus === 'degraded' ? 200 : 503;
  
  res.status(httpStatus).json(response);
});

/**
 * GET /api/health/ontoserver-r4 - Health check for R4 Ontoserver
 */
router.get('/ontoserver-r4', async (req, res) => {
  const timestamp = new Date().toISOString();
  
  try {
    const ontoserverClient = new OntoserverClient();
    const result = await ontoserverClient.testR4Connectivity();
    
    let status: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';
    if (!result.success) {
      status = 'unhealthy';
    } else if ((result.responseTime || 0) > 2000) {
      status = 'degraded';
    }
    
    const response: HealthCheckResponse = {
      service: 'R4 Ontoserver',
      status,
      responseTime: result.responseTime,
      details: result.data ? {
        fhirVersion: result.data.fhirVersion,
        software: result.data.software?.name,
        url: 'https://r4.ontoserver.csiro.au/fhir'
      } : undefined,
      error: result.error,
      timestamp
    };
    
    const httpStatus = status === 'healthy' ? 200 : 
                      status === 'degraded' ? 200 : 503;
    
    res.status(httpStatus).json(response);
  } catch (error) {
    const response: HealthCheckResponse = {
      service: 'R4 Ontoserver',
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp
    };
    
    res.status(503).json(response);
  }
});

/**
 * GET /api/health/ontoserver-r5 - Health check for R5 Ontoserver
 */
router.get('/ontoserver-r5', async (req, res) => {
  const timestamp = new Date().toISOString();
  
  try {
    const ontoserverClient = new OntoserverClient();
    const result = await ontoserverClient.testR5Connectivity();
    
    let status: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';
    if (!result.success) {
      status = 'unhealthy';
    } else if ((result.responseTime || 0) > 2000) {
      status = 'degraded';
    }
    
    const response: HealthCheckResponse = {
      service: 'R5 Ontoserver',
      status,
      responseTime: result.responseTime,
      details: result.data ? {
        fhirVersion: result.data.fhirVersion,
        software: result.data.software?.name,
        url: 'https://r5.ontoserver.csiro.au/fhir'
      } : undefined,
      error: result.error,
      timestamp
    };
    
    const httpStatus = status === 'healthy' ? 200 : 
                      status === 'degraded' ? 200 : 503;
    
    res.status(httpStatus).json(response);
  } catch (error) {
    const response: HealthCheckResponse = {
      service: 'R5 Ontoserver',
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp
    };
    
    res.status(503).json(response);
  }
});

/**
 * GET /api/health/firely - Health check for Firely Server
 */
router.get('/firely', async (req, res) => {
  const timestamp = new Date().toISOString();
  
  try {
    const firelyClient = new FirelyClient();
    const result = await firelyClient.testConnectivity();
    
    let status: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';
    if (!result.success) {
      status = 'unhealthy';
    } else if ((result.responseTime || 0) > 1000) {
      status = 'degraded';
    }
    
    const response: HealthCheckResponse = {
      service: 'Firely Server',
      status,
      responseTime: result.responseTime,
      details: result.data ? {
        fhirVersion: result.data.fhirVersion,
        software: result.data.software?.name,
        url: 'https://server.fire.ly'
      } : undefined,
      error: result.error,
      timestamp
    };
    
    const httpStatus = status === 'healthy' ? 200 : 
                      status === 'degraded' ? 200 : 503;
    
    res.status(httpStatus).json(response);
  } catch (error) {
    const response: HealthCheckResponse = {
      service: 'Firely Server',
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp
    };
    
    res.status(503).json(response);
  }
});

/**
 * GET /api/health/libraries - Health check for FHIR libraries
 */
router.get('/libraries', async (req, res) => {
  const timestamp = new Date().toISOString();
  const libraries: HealthCheckResponse[] = [];
  
  // Check @asymmetrik/fhir-json-schema-validator
  try {
    require('@asymmetrik/fhir-json-schema-validator');
    libraries.push({
      service: '@asymmetrik/fhir-json-schema-validator',
      status: 'healthy',
      details: { loaded: true },
      timestamp
    });
  } catch (error) {
    libraries.push({
      service: '@asymmetrik/fhir-json-schema-validator',
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp
    });
  }
  
  // Check fhir-validator
  try {
    const fhirValidator = require('fhir-validator');
    libraries.push({
      service: 'fhir-validator',
      status: 'healthy',
      details: { 
        loaded: true,
        methods: Object.keys(fhirValidator)
      },
      timestamp
    });
  } catch (error) {
    libraries.push({
      service: 'fhir-validator',
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp
    });
  }
  
  // Check moment
  try {
    const moment = require('moment');
    libraries.push({
      service: 'moment',
      status: 'healthy',
      details: { 
        loaded: true,
        currentDate: moment().format('YYYY-MM-DD HH:mm:ss')
      },
      timestamp
    });
  } catch (error) {
    libraries.push({
      service: 'moment',
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp
    });
  }
  
  // Check lodash
  try {
    const _ = require('lodash');
    libraries.push({
      service: 'lodash',
      status: 'healthy',
      details: { 
        loaded: true,
        testFunction: _.isArray([1, 2, 3]) ? 'working' : 'failed'
      },
      timestamp
    });
  } catch (error) {
    libraries.push({
      service: 'lodash',
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp
    });
  }
  
  const summary = {
    total: libraries.length,
    healthy: libraries.filter(l => l.status === 'healthy').length,
    unhealthy: libraries.filter(l => l.status === 'unhealthy').length,
    degraded: libraries.filter(l => l.status === 'degraded').length
  };
  
  const overallStatus = summary.unhealthy > 0 ? 'unhealthy' : 'healthy';
  
  res.status(overallStatus === 'healthy' ? 200 : 503).json({
    status: overallStatus,
    libraries,
    timestamp,
    summary
  });
});

export default router;
