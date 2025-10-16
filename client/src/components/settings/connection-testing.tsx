/**
 * Connection Testing Component
 * 
 * Handles testing FHIR server connections with detailed error reporting
 * and connection status feedback.
 */

import { useToast } from '@/hooks/use-toast';

// ============================================================================
// Types
// ============================================================================

interface ConnectionTestResult {
  success: boolean;
  error?: string;
  serverInfo?: {
    name?: string;
    version?: string;
    description?: string;
    fhirVersion?: string;
  };
}

// ============================================================================
// Connection Testing Functions
// ============================================================================

/**
 * Test connection to a FHIR server
 */
export async function testFhirConnection(url: string): Promise<ConnectionTestResult> {
  try {
    // Normalize URL
    const normalizedUrl = url.endsWith('/') ? url.slice(0, -1) : url;
    const metadataUrl = `${normalizedUrl}/metadata`;

    // Test connection with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    const response = await fetch(metadataUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/fhir+json',
        'Content-Type': 'application/fhir+json'
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.error || errorData.message || errorMessage;
      } catch {
        // Use the raw error text if it's not JSON
        if (errorText) {
          errorMessage = errorText;
        }
      }

      return {
        success: false,
        error: errorMessage
      };
    }

    const metadata = await response.json();
    
    // Extract FHIR version from CapabilityStatement
    let fhirVersion: string | undefined;
    if (metadata.fhirVersion) {
      // Parse version like "4.0.1" to "R4", "5.0.0" to "R5", etc.
      const version = metadata.fhirVersion;
      if (version.startsWith('4.')) {
        fhirVersion = 'R4';
      } else if (version.startsWith('5.')) {
        fhirVersion = 'R5';
      } else if (version.startsWith('6.')) {
        fhirVersion = 'R6';
      } else if (version.startsWith('3.')) {
        fhirVersion = 'STU3';
      }
    }
    
    // Extract server information
    const serverInfo = {
      name: metadata.software?.name || 'Unknown',
      version: metadata.software?.version || 'Unknown',
      description: metadata.software?.description || 'No description available',
      fhirVersion
    };

    return {
      success: true,
      serverInfo
    };

  } catch (error: any) {
    console.error('Connection test error:', error);
    
    let errorMessage = 'Failed to connect to server';
    
    if (error.name === 'AbortError') {
      errorMessage = 'Connection timeout - server took too long to respond';
    } else if (error.message?.includes('fetch')) {
      errorMessage = 'Network error - unable to reach the server';
    } else if (error.message?.includes('CORS')) {
      errorMessage = 'CORS error - server doesn\'t allow cross-origin requests';
    } else if (error.message) {
      errorMessage = error.message;
    }

    return {
      success: false,
      error: errorMessage
    };
  }
}

/**
 * Enhanced error handling for connection test failures
 */
export function handleConnectionTestError(error: string, toast: any) {
  let title = "Connection Failed";
  let description = error;
  
  // Provide specific error messages based on error type
  if (error.includes('timeout') || error.includes('ECONNREFUSED')) {
    title = "Server Unreachable";
    description = "The server is not responding. Please check if the server is running and the URL is correct.";
  } else if (error.includes('404') || error.includes('Not Found')) {
    title = "Invalid Server URL";
    description = "The server URL appears to be incorrect or the FHIR endpoint is not available.";
  } else if (error.includes('401') || error.includes('Unauthorized')) {
    title = "Authentication Required";
    description = "The server requires authentication. Please configure your credentials.";
  } else if (error.includes('403') || error.includes('Forbidden')) {
    title = "Access Denied";
    description = "You don't have permission to access this server. Please check your credentials.";
  } else if (error.includes('500') || error.includes('Internal Server Error')) {
    title = "Server Error";
    description = "The server encountered an internal error. Please try again later.";
  } else if (error.includes('SSL') || error.includes('certificate')) {
    title = "SSL/TLS Error";
    description = "There's an issue with the server's SSL certificate. Please check the server configuration.";
  } else if (error.includes('CORS')) {
    title = "CORS Error";
    description = "The server doesn't allow cross-origin requests. This may be a configuration issue.";
  } else if (error.includes('timeout')) {
    title = "Connection Timeout";
    description = "The server took too long to respond. Please check if the server is running.";
  }
  
  toast({
    title,
    description,
    variant: "destructive",
  });
}

/**
 * Handle successful connection test
 */
export function handleConnectionTestSuccess(serverInfo: any, toast: any) {
  toast({
    title: "✅ Connection Successful",
    description: `Successfully connected to ${serverInfo.name} (${serverInfo.version}). ${serverInfo.description}`,
    variant: "default",
    duration: 5000,
  });
}

/**
 * Validate FHIR URL format
 */
export function validateFhirUrl(url: string) {
  if (!url.trim()) {
    return { isValid: false, error: 'URL is required' };
  }

  try {
    const urlObj = new URL(url);
    
    // Check if it's a valid HTTP/HTTPS URL
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return { isValid: false, error: 'URL must use HTTP or HTTPS protocol' };
    }

    // Check for common FHIR server patterns
    const path = urlObj.pathname.toLowerCase();
    const hasFhirEndpoint = path.includes('/fhir') || 
                           path.includes('/base') || 
                           path.includes('/r4') || 
                           path.includes('/r5') ||
                           path.includes('/stu3');

    if (!hasFhirEndpoint) {
      return { 
        isValid: true, 
        warning: 'URL doesn\'t appear to be a FHIR endpoint. Consider adding /fhir or /baseR4 to the path.',
        normalizedUrl: url.endsWith('/') ? url + 'fhir' : url + '/fhir'
      };
    }

    return { isValid: true };
  } catch (error) {
    return { isValid: false, error: 'Invalid URL format' };
  }
}

/**
 * Get connection status icon and color
 */
export function getConnectionStatus(status: 'success' | 'error' | 'testing' | 'idle') {
  const statusMap = {
    success: { icon: '✅', color: 'text-green-600', bgColor: 'bg-green-50' },
    error: { icon: '❌', color: 'text-red-600', bgColor: 'bg-red-50' },
    testing: { icon: '🔄', color: 'text-blue-600', bgColor: 'bg-blue-50' },
    idle: { icon: '⏸️', color: 'text-gray-600', bgColor: 'bg-gray-50' }
  };
  
  return statusMap[status] || statusMap.idle;
}

/**
 * Format connection test duration
 */
export function formatConnectionDuration(durationMs: number): string {
  if (durationMs < 1000) {
    return `${durationMs}ms`;
  } else if (durationMs < 10000) {
    return `${(durationMs / 1000).toFixed(1)}s`;
  } else {
    return `${Math.round(durationMs / 1000)}s`;
  }
}

/**
 * Get server type from metadata
 */
export function getServerType(metadata: any): string {
  const software = metadata.software;
  if (!software) return 'Unknown';
  
  const name = software.name?.toLowerCase() || '';
  
  if (name.includes('hapi')) return 'HAPI FHIR';
  if (name.includes('firely')) return 'Firely Server';
  if (name.includes('microsoft')) return 'Microsoft FHIR Server';
  if (name.includes('ibm')) return 'IBM FHIR Server';
  if (name.includes('smile')) return 'Smile CDR';
  if (name.includes('epic')) return 'Epic FHIR Server';
  if (name.includes('cerner')) return 'Cerner FHIR Server';
  
  return software.name || 'Unknown';
}

/**
 * Check if server supports specific FHIR version
 */
export function getSupportedFhirVersions(metadata: any): string[] {
  const versions = metadata.fhirVersion ? [metadata.fhirVersion] : [];
  
  // Check for multiple versions in software
  if (metadata.software?.version) {
    const version = metadata.software.version;
    if (version.includes('R4')) versions.push('R4');
    if (version.includes('R5')) versions.push('R5');
    if (version.includes('STU3')) versions.push('STU3');
  }
  
  return [...new Set(versions)]; // Remove duplicates
}
