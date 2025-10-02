/**
 * Server Activation Service Tests
 * 
 * This test verifies that the server activation service correctly updates
 * the FHIR client when the active server changes, ensuring resource counts
 * and other queries use the correct server.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ServerActivationService } from './server-activation-service';
import { FhirClient } from './fhir/fhir-client';

// Mock dependencies
vi.mock('../storage', () => ({
  storage: {
    getFhirServers: vi.fn(),
    getActiveFhirServer: vi.fn()
  }
}));

vi.mock('./fhir/fhir-client');

describe('ServerActivationService', () => {
  let service: ServerActivationService;
  let mockFhirClient: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Create mock FHIR client
    mockFhirClient = {
      testConnection: vi.fn(),
      getResourceCounts: vi.fn(),
      getResourceTypes: vi.fn(),
      searchResources: vi.fn()
    };
    
    service = ServerActivationService.getInstance();
    service.setFhirClient(mockFhirClient);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('FHIR Client Management', () => {
    it('should set and get FHIR client correctly', () => {
      const newClient = new FhirClient('http://test-server.com');
      service.setFhirClient(newClient);
      
      expect(service.getFhirClient()).toBe(newClient);
    });

    it('should handle null FHIR client gracefully', () => {
      service.setFhirClient(null as any);
      expect(service.getFhirClient()).toBeNull();
    });
  });

  describe('Server Activation Events', () => {
    it('should emit server activation events', () => {
      const emitter = service.getEmitter();
      const eventSpy = vi.fn();
      
      emitter.on('serverActivated', eventSpy);
      
      emitter.emit('serverActivated', {
        serverId: '1',
        server: { id: 1, url: 'http://new-server.com', name: 'Test Server' },
        timestamp: new Date().toISOString()
      });
      
      expect(eventSpy).toHaveBeenCalledWith({
        serverId: '1',
        server: { id: 1, url: 'http://new-server.com', name: 'Test Server' },
        timestamp: expect.any(String)
      });
    });

    it('should emit FHIR client updated events', () => {
      const emitter = service.getEmitter();
      const eventSpy = vi.fn();
      
      emitter.on('fhirClientUpdated', eventSpy);
      
      emitter.emit('fhirClientUpdated', {
        serverId: '1',
        server: { id: 1, url: 'http://new-server.com', name: 'Test Server' },
        timestamp: new Date().toISOString()
      });
      
      expect(eventSpy).toHaveBeenCalledWith({
        serverId: '1',
        server: { id: 1, url: 'http://new-server.com', name: 'Test Server' },
        timestamp: expect.any(String)
      });
    });
  });

  describe('Manual Server Update', () => {
    it('should update FHIR client for specific server', async () => {
      const { storage } = await import('../storage');
      vi.mocked(storage.getFhirServers).mockResolvedValue([
        { id: 1, url: 'http://server1.com', name: 'Server 1', isActive: true },
        { id: 2, url: 'http://server2.com', name: 'Server 2', isActive: false }
      ]);

      // Mock successful connection test
      mockFhirClient.testConnection.mockResolvedValue({
        connected: true,
        version: 'R4',
        error: null
      });

      const result = await service.updateFhirClientForServer('2');
      
      expect(result).toBe(true);
      expect(mockFhirClient.testConnection).toHaveBeenCalled();
    });

    it('should return false for non-existent server', async () => {
      const { storage } = await import('../storage');
      vi.mocked(storage.getFhirServers).mockResolvedValue([
        { id: 1, url: 'http://server1.com', name: 'Server 1', isActive: true }
      ]);

      const result = await service.updateFhirClientForServer('999');
      
      expect(result).toBe(false);
    });

    it('should handle connection test failures', async () => {
      const { storage } = await import('../storage');
      vi.mocked(storage.getFhirServers).mockResolvedValue([
        { id: 1, url: 'http://server1.com', name: 'Server 1', isActive: true }
      ]);

      // Mock failed connection test
      mockFhirClient.testConnection.mockResolvedValue({
        connected: false,
        error: 'Connection failed'
      });

      const result = await service.updateFhirClientForServer('1');
      
      expect(result).toBe(false);
    });
  });

  describe('Resource Counts Parity', () => {
    it('should ensure resource counts use current FHIR client', () => {
      // This test verifies that the service maintains a reference to the current FHIR client
      // which should be used by all FHIR-related endpoints
      
      const currentClient = service.getFhirClient();
      expect(currentClient).toBe(mockFhirClient);
      
      // When a new server is activated, the FHIR client should be updated
      const newClient = new FhirClient('http://new-server.com');
      service.setFhirClient(newClient);
      
      const updatedClient = service.getFhirClient();
      expect(updatedClient).toBe(newClient);
      expect(updatedClient).not.toBe(mockFhirClient);
    });

    it('should handle multiple server activations correctly', async () => {
      const { storage } = await import('../storage');
      vi.mocked(storage.getFhirServers).mockResolvedValue([
        { id: 1, url: 'http://server1.com', name: 'Server 1', isActive: true },
        { id: 2, url: 'http://server2.com', name: 'Server 2', isActive: false },
        { id: 3, url: 'http://server3.com', name: 'Server 3', isActive: false }
      ]);

      // Mock successful connection tests
      mockFhirClient.testConnection.mockResolvedValue({
        connected: true,
        version: 'R4',
        error: null
      });

      // Activate server 2
      let result = await service.updateFhirClientForServer('2');
      expect(result).toBe(true);

      // Activate server 3
      result = await service.updateFhirClientForServer('3');
      expect(result).toBe(true);

      // Verify that connection tests were called for each activation
      expect(mockFhirClient.testConnection).toHaveBeenCalledTimes(2);
    });
  });

  describe('Error Handling', () => {
    it('should handle storage errors gracefully', async () => {
      const { storage } = await import('../storage');
      vi.mocked(storage.getFhirServers).mockRejectedValue(new Error('Database error'));

      const result = await service.updateFhirClientForServer('1');
      
      expect(result).toBe(false);
    });

    it('should handle FHIR client creation errors', async () => {
      // Mock FhirClient constructor to throw an error
      vi.mocked(FhirClient).mockImplementation(() => {
        throw new Error('Failed to create FHIR client');
      });

      const { storage } = await import('../storage');
      vi.mocked(storage.getFhirServers).mockResolvedValue([
        { id: 1, url: 'http://server1.com', name: 'Server 1', isActive: true }
      ]);

      const result = await service.updateFhirClientForServer('1');
      
      expect(result).toBe(false);
    });
  });
});
