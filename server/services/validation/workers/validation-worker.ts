/**
 * Validation Worker (Node.js Worker Thread)
 * 
 * Task 9.1: Worker thread for parallel validation processing
 * 
 * Features:
 * - Runs validation in separate thread
 * - Isolates HAPI validator instances
 * - Progress updates to main thread
 * - Error handling and recovery
 */

import { parentPort, workerData } from 'worker_threads';

// ============================================================================
// Types - Task 9.3: Worker Message Protocol
// ============================================================================

export interface WorkerMessage {
  type: 'validate' | 'init' | 'shutdown';
  id: string;
  data?: any;
}

export interface ValidateMessage extends WorkerMessage {
  type: 'validate';
  resource: any;
  resourceType: string;
  settings: any;
  fhirVersion?: 'R4' | 'R5' | 'R6';
}

export interface WorkerResponse {
  type: 'result' | 'progress' | 'error' | 'ready';
  id: string;
  data?: any;
  error?: string;
  progress?: number;
}

// ============================================================================
// Worker State
// ============================================================================

let isInitialized = false;
let validationEngine: any = null;

// ============================================================================
// Worker Initialization
// ============================================================================

async function initializeWorker(): Promise<void> {
  if (isInitialized) {
    return;
  }

  try {
    console.log('[ValidationWorker] Initializing worker thread...');

    // Import ValidationEngine (dynamic import to avoid circular dependencies)
    const { ValidationEngine } = await import('../core/validation-engine');
    
    // Create isolated validation engine instance
    validationEngine = new ValidationEngine();

    isInitialized = true;

    // Notify main thread that worker is ready
    parentPort?.postMessage({
      type: 'ready',
      id: 'init',
      data: {
        workerId: workerData?.workerId || 'unknown',
        timestamp: Date.now()
      }
    } as WorkerResponse);

    console.log('[ValidationWorker] Worker initialized successfully');

  } catch (error: any) {
    console.error('[ValidationWorker] Initialization failed:', error);
    
    parentPort?.postMessage({
      type: 'error',
      id: 'init',
      error: `Worker initialization failed: ${error.message}`
    } as WorkerResponse);
  }
}

// ============================================================================
// Validation Handler
// ============================================================================

async function handleValidation(message: ValidateMessage): Promise<void> {
  const startTime = Date.now();

  try {
    if (!isInitialized || !validationEngine) {
      throw new Error('Worker not initialized');
    }

    const { resource, resourceType, settings, fhirVersion } = message;

    console.log(`[ValidationWorker] Validating ${resourceType}...`);

    // Send progress update (10%)
    parentPort?.postMessage({
      type: 'progress',
      id: message.id,
      progress: 10
    } as WorkerResponse);

    // Set FHIR version if provided
    if (fhirVersion) {
      validationEngine.setFhirVersion(fhirVersion);
    }

    // Progress update (30%)
    parentPort?.postMessage({
      type: 'progress',
      id: message.id,
      progress: 30
    } as WorkerResponse);

    // Perform validation
    const result = await validationEngine.validate(resource, resourceType);

    // Progress update (90%)
    parentPort?.postMessage({
      type: 'progress',
      id: message.id,
      progress: 90
    } as WorkerResponse);

    const duration = Date.now() - startTime;

    // Send result back to main thread
    parentPort?.postMessage({
      type: 'result',
      id: message.id,
      data: {
        result,
        duration,
        workerId: workerData?.workerId || 'unknown'
      }
    } as WorkerResponse);

    console.log(`[ValidationWorker] Validation completed in ${duration}ms`);

  } catch (error: any) {
    console.error('[ValidationWorker] Validation failed:', error);

    parentPort?.postMessage({
      type: 'error',
      id: message.id,
      error: error.message || 'Validation failed'
    } as WorkerResponse);
  }
}

// ============================================================================
// Message Handler
// ============================================================================

async function handleMessage(message: WorkerMessage): Promise<void> {
  switch (message.type) {
    case 'init':
      await initializeWorker();
      break;

    case 'validate':
      await handleValidation(message as ValidateMessage);
      break;

    case 'shutdown':
      console.log('[ValidationWorker] Shutting down worker...');
      process.exit(0);
      break;

    default:
      console.warn(`[ValidationWorker] Unknown message type: ${message.type}`);
  }
}

// ============================================================================
// Main Worker Loop
// ============================================================================

if (parentPort) {
  // Listen for messages from main thread
  parentPort.on('message', async (message: WorkerMessage) => {
    try {
      await handleMessage(message);
    } catch (error: any) {
      console.error('[ValidationWorker] Message handling error:', error);
      
      parentPort?.postMessage({
        type: 'error',
        id: message.id || 'unknown',
        error: error.message || 'Message handling failed'
      } as WorkerResponse);
    }
  });

  // Handle errors
  parentPort.on('error', (error) => {
    console.error('[ValidationWorker] Worker error:', error);
  });

  // Auto-initialize on startup
  initializeWorker().catch((error) => {
    console.error('[ValidationWorker] Auto-initialization failed:', error);
  });

} else {
  console.error('[ValidationWorker] No parent port available - worker cannot communicate');
  process.exit(1);
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('[ValidationWorker] Uncaught exception:', error);
  
  parentPort?.postMessage({
    type: 'error',
    id: 'uncaught',
    error: `Uncaught exception: ${error.message}`
  } as WorkerResponse);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('[ValidationWorker] Unhandled rejection:', reason);
  
  parentPort?.postMessage({
    type: 'error',
    id: 'unhandled',
    error: `Unhandled rejection: ${reason}`
  } as WorkerResponse);
});

console.log('[ValidationWorker] Worker thread started');

