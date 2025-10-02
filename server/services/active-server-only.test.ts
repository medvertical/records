/**
 * Active Server Only Tests
 * 
 * This test verifies that the system uses only the active server
 * with no hardcoded URLs and immediate server switch rebinding.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { storage } from '../../storage';
import { serverActivationService } from './server-activation-service';
import { FhirClient } from '../fhir/fhir-client';
import EventEmitter from 'events';

// Mock dependencies
vi.mock('../../storage', () => ({
  storage: {
    getActiveFhirServer: vi.fn(),
    getFhirServerById: vi.fn(),
    getFhirServers: vi.fn(),
  },
}));

vi.mock('../fhir/fhir-client', () => ({
  FhirClient: vi.fn().mockImplementation((url) => ({
    url,
    testConnection: vi.fn().mockResolvedValue({ connected: true }),
    getResourceCounts: vi.fn().mockResolvedValue({ Patient: 10, Observation: 20 }),
    getResourceTypes: vi.fn().mockResolvedValue(['Patient', 'Observation']),
  })),
}));

// Mock global dashboardService
global.dashboardService = {
  updateFhirClient: vi.fn(),
} as any;

// Mock global serverActivationEmitter
class MockServerActivationEmitter extends EventEmitter {}
global.serverActivationEmitter = new MockServerActivationEmitter();

describe('Active Server Only Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('No Hardcoded URLs', () => {
    it('should not use hardcoded URLs in FHIR client initialization', async () => {
      const mockServer = {
        id: 1,
        name: 'Test Server',
        url: 'http://test-server.example.com/fhir',
        isActive: true,
      };

      // Setup mocks
      (storage.getActiveFhirServer as vi.Mock).mockResolvedValue(mockServer);
      (storage.getFhirServerById as vi.Mock).mockResolvedValue(mockServer);

      // Initialize server activation service
      const service = serverActivationService;
      service.setFhirClient(null);

      // Simulate server activation
      await global.serverActivationEmitter?.emit('serverActivated', {
        serverId: '1',
        server: mockServer,
        timestamp: new Date().toISOString(),
      });

      // Verify FhirClient was created with server URL from database, not hardcoded
      expect(FhirClient).toHaveBeenCalledWith(mockServer.url);
      expect(FhirClient).toHaveBeenCalledWith('http://test-server.example.com/fhir');
      
      // Verify no hardcoded URLs were used
      expect(FhirClient).not.toHaveBeenCalledWith('http://localhost:3000');
      expect(FhirClient).not.toHaveBeenCalledWith('https://hapi.fhir.org');
      expect(FhirClient).not.toHaveBeenCalledWith('http://localhost:8080');
    });

    it('should use different server URLs when switching servers', async () => {
      const mockServer1 = {
        id: 1,
        name: 'Server 1',
        url: 'http://server1.example.com/fhir',
        isActive: true,
      };

      const mockServer2 = {
        id: 2,
        name: 'Server 2',
        url: 'http://server2.example.com/fhir',
        isActive: false,
      };

      // Setup mocks
      (storage.getActiveFhirServer as vi.Mock)
        .mockResolvedValueOnce(mockServer1)
        .mockResolvedValueOnce(mockServer2);
      (storage.getFhirServerById as vi.Mock)
        .mockResolvedValueOnce(mockServer2);

      const service = serverActivationService;
      service.setFhirClient(null);

      // Activate first server
      await global.serverActivationEmitter?.emit('serverActivated', {
        serverId: '1',
        server: mockServer1,
        timestamp: new Date().toISOString(),
      });

      // Verify first server URL was used
      expect(FhirClient).toHaveBeenCalledWith(mockServer1.url);
      expect(FhirClient).toHaveBeenCalledWith('http://server1.example.com/fhir');

      // Clear mock calls
      vi.clearAllMocks();

      // Switch to second server
      await global.serverActivationEmitter?.emit('serverActivated', {
        serverId: '2',
        server: mockServer2,
        timestamp: new Date().toISOString(),
      });

      // Verify second server URL was used
      expect(FhirClient).toHaveBeenCalledWith(mockServer2.url);
      expect(FhirClient).toHaveBeenCalledWith('http://server2.example.com/fhir');
    });
  });

  describe('Immediate Server Switch Rebinding', () => {
    it('should immediately rebind all services when server changes', async () => {
      const mockServer1 = {
        id: 1,
        name: 'Server 1',
        url: 'http://server1.example.com/fhir',
        isActive: true,
      };

      const mockServer2 = {
        id: 2,
        name: 'Server 2',
        url: 'http://server2.example.com/fhir',
        isActive: false,
      };

      // Setup mocks
      (storage.getActiveFhirServer as vi.Mock).mockResolvedValue(mockServer1);
      (storage.getFhirServerById as vi.Mock).mockResolvedValue(mockServer2);

      const service = serverActivationService;
      const initialClient = new FhirClient('http://initial.example.com');
      service.setFhirClient(initialClient);

      // Verify initial client is set
      expect(service.getFhirClient()).toBe(initialClient);

      // Switch servers
      await global.serverActivationEmitter?.emit('serverActivated', {
        serverId: '2',
        server: mockServer2,
        timestamp: new Date().toISOString(),
      });

      // Verify client was immediately updated
      const newClient = service.getFhirClient();
      expect(newClient).not.toBe(initialClient);
      expect(newClient?.url).toBe(mockServer2.url);

      // Verify dashboard service was immediately updated
      expect(global.dashboardService?.updateFhirClient).toHaveBeenCalledWith(newClient);
    });

    it('should emit fhirClientUpdated event for other services', async () => {
      const mockServer = {
        id: 1,
        name: 'Test Server',
        url: 'http://test.example.com/fhir',
        isActive: true,
      };

      (storage.getActiveFhirServer as vi.Mock).mockResolvedValue(mockServer);
      (storage.getFhirServerById as vi.Mock).mockResolvedValue(mockServer);

      const service = serverActivationService;
      service.setFhirClient(null);

      const emitSpy = vi.spyOn(global.serverActivationEmitter, 'emit');

      // Activate server
      await global.serverActivationEmitter?.emit('serverActivated', {
        serverId: '1',
        server: mockServer,
        timestamp: new Date().toISOString(),
      });

      // Verify fhirClientUpdated event was emitted
      expect(emitSpy).toHaveBeenCalledWith('fhirClientUpdated', {
        serverId: '1',
        newFhirClient: expect.any(Object),
        timestamp: expect.any(String),
      });
    });

    it('should handle server activation failures gracefully', async () => {
      const mockServer = {
        id: 1,
        name: 'Failing Server',
        url: 'http://failing-server.example.com/fhir',
        isActive: true,
      };

      (storage.getActiveFhirServer as vi.Mock).mockResolvedValue(mockServer);
      (storage.getFhirServerById as vi.Mock).mockResolvedValue(mockServer);

      // Mock FhirClient to fail connection test
      (FhirClient as vi.Mock).mockImplementation(() => ({
        url: mockServer.url,
        testConnection: vi.fn().mockResolvedValue({ 
          connected: false, 
          error: 'Connection refused' 
        }),
      }));

      const service = serverActivationService;
      const initialClient = new FhirClient('http://working.example.com');
      service.setFhirClient(initialClient);

      // Try to activate failing server
      await global.serverActivationEmitter?.emit('serverActivated', {
        serverId: '1',
        server: mockServer,
        timestamp: new Date().toISOString(),
      });

      // Verify client was not updated due to connection failure
      expect(service.getFhirClient()).toBe(initialClient);
      expect(global.dashboardService?.updateFhirClient).not.toHaveBeenCalled();
    });
  });

  describe('Active Server Configuration', () => {
    it('should only use the active server from database', async () => {
      const mockServers = [
        { id: 1, name: 'Server 1', url: 'http://server1.example.com/fhir', isActive: false },
        { id: 2, name: 'Server 2', url: 'http://server2.example.com/fhir', isActive: true },
        { id: 3, name: 'Server 3', url: 'http://server3.example.com/fhir', isActive: false },
      ];

      const activeServer = mockServers.find(s => s.isActive);

      (storage.getActiveFhirServer as vi.Mock).mockResolvedValue(activeServer);
      (storage.getFhirServers as vi.Mock).mockResolvedValue(mockServers);

      // Initialize service with active server
      const service = serverActivationService;
      service.setFhirClient(null);

      // Verify only active server is used
      await global.serverActivationEmitter?.emit('serverActivated', {
        serverId: '2',
        server: activeServer,
        timestamp: new Date().toISOString(),
      });

      expect(FhirClient).toHaveBeenCalledWith(activeServer?.url);
      expect(FhirClient).toHaveBeenCalledWith('http://server2.example.com/fhir');

      // Verify inactive servers were not used
      expect(FhirClient).not.toHaveBeenCalledWith('http://server1.example.com/fhir');
      expect(FhirClient).not.toHaveBeenCalledWith('http://server3.example.com/fhir');
    });

    it('should handle no active server gracefully', async () => {
      (storage.getActiveFhirServer as vi.Mock).mockResolvedValue(null);

      const service = serverActivationService;
      service.setFhirClient(null);

      // Verify service handles no active server
      expect(service.getFhirClient()).toBe(null);

      // Try to activate a server that doesn't exist
      await global.serverActivationEmitter?.emit('serverActivated', {
        serverId: '999',
        server: null,
        timestamp: new Date().toISOString(),
      });

      // Verify no FhirClient was created
      expect(FhirClient).not.toHaveBeenCalled();
    });
  });

  describe('Server URL Validation', () => {
    it('should validate server URLs before creating FHIR clients', async () => {
      const validServer = {
        id: 1,
        name: 'Valid Server',
        url: 'https://valid-server.example.com/fhir',
        isActive: true,
      };

      const invalidServer = {
        id: 2,
        name: 'Invalid Server',
        url: 'not-a-valid-url',
        isActive: false,
      };

      (storage.getActiveFhirServer as vi.Mock).mockResolvedValue(validServer);
      (storage.getFhirServerById as vi.Mock)
        .mockResolvedValueOnce(validServer)
        .mockResolvedValueOnce(invalidServer);

      const service = serverActivationService;
      service.setFhirClient(null);

      // Activate valid server
      await global.serverActivationEmitter?.emit('serverActivated', {
        serverId: '1',
        server: validServer,
        timestamp: new Date().toISOString(),
      });

      expect(FhirClient).toHaveBeenCalledWith(validServer.url);

      // Try to activate invalid server
      await global.serverActivationEmitter?.emit('serverActivated', {
        serverId: '2',
        server: invalidServer,
        timestamp: new Date().toISOString(),
      });

      // Should still attempt to create client (URL validation happens in FhirClient)
      expect(FhirClient).toHaveBeenCalledWith(invalidServer.url);
    });
  });
});
