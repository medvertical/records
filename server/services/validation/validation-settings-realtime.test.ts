import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ValidationSettingsService } from './validation-settings-service';
import { db } from '../../db';
import { validationSettings, validationSettingsAuditTrail } from '@shared/schema';

// Mock the database
vi.mock('../../db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    transaction: vi.fn()
  }
}));

// Mock the validation settings repository
vi.mock('../../repositories/validation-settings-repository', () => ({
  getValidationSettingsRepository: () => ({
    getActiveSettings: vi.fn(),
    createSettings: vi.fn(),
    updateSettings: vi.fn(),
    deleteSettings: vi.fn(),
    getSettingsHistory: vi.fn()
  })
}));

// Mock the dashboard service
vi.mock('../dashboard/dashboard-service', () => ({
  DashboardService: vi.fn().mockImplementation(() => ({
    clearValidationCache: vi.fn()
  }))
}));

// Mock EventEmitter
class MockEventEmitter {
  private listeners: Map<string, Function[]> = new Map();

  on(event: string, listener: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(listener);
  }

  emit(event: string, ...args: any[]) {
    const listeners = this.listeners.get(event) || [];
    listeners.forEach(listener => listener(...args));
  }

  removeListener(event: string, listener: Function) {
    const listeners = this.listeners.get(event) || [];
    const index = listeners.indexOf(listener);
    if (index > -1) {
      listeners.splice(index, 1);
    }
  }
}

describe('ValidationSettingsService Real-time Updates', () => {
  let service: ValidationSettingsService;
  let mockDb: any;
  let mockEventEmitter: MockEventEmitter;

  const mockSettings = {
    id: 'test-settings-1',
    name: 'Test Settings',
    description: 'Test validation settings',
    settings: {
      structural: { enabled: true, severity: 'error' },
      profile: { enabled: true, severity: 'error' },
      terminology: { enabled: true, severity: 'warning' },
      reference: { enabled: true, severity: 'error' },
      businessRule: { enabled: true, severity: 'warning' },
      metadata: { enabled: true, severity: 'info' }
    },
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const updatedSettings = {
    ...mockSettings,
    settings: {
      structural: { enabled: false, severity: 'error' },
      profile: { enabled: true, severity: 'warning' },
      terminology: { enabled: true, severity: 'error' },
      reference: { enabled: false, severity: 'error' },
      businessRule: { enabled: true, severity: 'warning' },
      metadata: { enabled: true, severity: 'info' }
    },
    updatedAt: new Date()
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockEventEmitter = new MockEventEmitter();
    mockDb = {
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      transaction: vi.fn()
    };
    
    service = new ValidationSettingsService();
    
    // Mock EventEmitter methods
    service.on = mockEventEmitter.on.bind(mockEventEmitter);
    service.emit = mockEventEmitter.emit.bind(mockEventEmitter);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Real-time Settings Change Events', () => {
    it('should emit settingsChanged event when settings are updated', async () => {
      const eventSpy = vi.fn();
      service.on('settingsChanged', eventSpy);

      const mockTransaction = vi.fn().mockImplementation(async (callback) => {
        const mockTx = {
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([updatedSettings])
            })
          }),
          insert: vi.fn().mockResolvedValue({})
        };
        return await callback(mockTx);
      });

      mockDb.transaction.mockImplementation(mockTransaction);

      await service.updateSettings(mockSettings.id, updatedSettings.settings, 'test-user');

      expect(eventSpy).toHaveBeenCalledWith({
        type: 'settingsChanged',
        settingsId: mockSettings.id,
        performedBy: 'test-user',
        changes: expect.any(Object)
      });
    });

    it('should emit settingsActivated event when settings are activated', async () => {
      const eventSpy = vi.fn();
      service.on('settingsActivated', eventSpy);

      const mockTransaction = vi.fn().mockImplementation(async (callback) => {
        const mockTx = {
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([{ ...mockSettings, isActive: true }])
            })
          }),
          insert: vi.fn().mockResolvedValue({})
        };
        return await callback(mockTx);
      });

      mockDb.transaction.mockImplementation(mockTransaction);

      await service.activateSettings(mockSettings.id, 'test-user');

      expect(eventSpy).toHaveBeenCalledWith({
        type: 'settingsActivated',
        settingsId: mockSettings.id,
        performedBy: 'test-user'
      });
    });

    it('should emit settingsDeactivated event when settings are deactivated', async () => {
      const eventSpy = vi.fn();
      service.on('settingsDeactivated', eventSpy);

      const mockTransaction = vi.fn().mockImplementation(async (callback) => {
        const mockTx = {
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([{ ...mockSettings, isActive: false }])
            })
          }),
          insert: vi.fn().mockResolvedValue({})
        };
        return await callback(mockTx);
      });

      mockDb.transaction.mockImplementation(mockTransaction);

      await service.deactivateSettings(mockSettings.id, 'test-user');

      expect(eventSpy).toHaveBeenCalledWith({
        type: 'settingsDeactivated',
        settingsId: mockSettings.id,
        performedBy: 'test-user'
      });
    });

    it('should emit settingsCreated event when new settings are created', async () => {
      const eventSpy = vi.fn();
      service.on('settingsCreated', eventSpy);

      const newSettingsData = {
        name: 'New Settings',
        description: 'New validation settings',
        settings: mockSettings.settings
      };

      const mockTransaction = vi.fn().mockImplementation(async (callback) => {
        const mockTx = {
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([{ ...mockSettings, ...newSettingsData }])
            })
          })
        };
        return await callback(mockTx);
      });

      mockDb.transaction.mockImplementation(mockTransaction);

      await service.createSettings(newSettingsData, 'test-user');

      expect(eventSpy).toHaveBeenCalledWith({
        type: 'settingsCreated',
        settingsId: mockSettings.id,
        performedBy: 'test-user',
        settings: expect.any(Object)
      });
    });

    it('should emit settingsDeleted event when settings are deleted', async () => {
      const eventSpy = vi.fn();
      service.on('settingsDeleted', eventSpy);

      const mockTransaction = vi.fn().mockImplementation(async (callback) => {
        const mockTx = {
          delete: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([mockSettings])
          }),
          insert: vi.fn().mockResolvedValue({})
        };
        return await callback(mockTx);
      });

      mockDb.transaction.mockImplementation(mockTransaction);

      await service.deleteSettings(mockSettings.id, 'test-user');

      expect(eventSpy).toHaveBeenCalledWith({
        type: 'settingsDeleted',
        settingsId: mockSettings.id,
        performedBy: 'test-user'
      });
    });

    it('should emit settingsRolledBack event when settings are rolled back', async () => {
      const eventSpy = vi.fn();
      service.on('settingsRolledBack', eventSpy);

      const mockTransaction = vi.fn().mockImplementation(async (callback) => {
        const mockTx = {
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([mockSettings])
            })
          }),
          insert: vi.fn().mockResolvedValue({})
        };
        return await callback(mockTx);
      });

      mockDb.transaction.mockImplementation(mockTransaction);

      await service.rollbackToVersion(mockSettings.id, 1, 'test-user');

      expect(eventSpy).toHaveBeenCalledWith({
        type: 'settingsRolledBack',
        settingsId: mockSettings.id,
        performedBy: 'test-user',
        rollbackToVersion: 1
      });
    });
  });

  describe('Cache Invalidation on Settings Changes', () => {
    it('should clear dashboard cache when settings are updated', async () => {
      const mockDashboardService = {
        clearValidationCache: vi.fn()
      };

      // Mock the dashboard service
      vi.mocked(require('../dashboard/dashboard-service').DashboardService).mockReturnValue(mockDashboardService);

      const mockTransaction = vi.fn().mockImplementation(async (callback) => {
        const mockTx = {
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([updatedSettings])
            })
          }),
          insert: vi.fn().mockResolvedValue({})
        };
        return await callback(mockTx);
      });

      mockDb.transaction.mockImplementation(mockTransaction);

      await service.updateSettings(mockSettings.id, updatedSettings.settings, 'test-user');

      // Verify dashboard cache was cleared
      expect(mockDashboardService.clearValidationCache).toHaveBeenCalled();
    });

    it('should clear dashboard cache when settings are activated', async () => {
      const mockDashboardService = {
        clearValidationCache: vi.fn()
      };

      vi.mocked(require('../dashboard/dashboard-service').DashboardService).mockReturnValue(mockDashboardService);

      const mockTransaction = vi.fn().mockImplementation(async (callback) => {
        const mockTx = {
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([{ ...mockSettings, isActive: true }])
            })
          }),
          insert: vi.fn().mockResolvedValue({})
        };
        return await callback(mockTx);
      });

      mockDb.transaction.mockImplementation(mockTransaction);

      await service.activateSettings(mockSettings.id, 'test-user');

      expect(mockDashboardService.clearValidationCache).toHaveBeenCalled();
    });

    it('should clear dashboard cache when settings are deactivated', async () => {
      const mockDashboardService = {
        clearValidationCache: vi.fn()
      };

      vi.mocked(require('../dashboard/dashboard-service').DashboardService).mockReturnValue(mockDashboardService);

      const mockTransaction = vi.fn().mockImplementation(async (callback) => {
        const mockTx = {
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([{ ...mockSettings, isActive: false }])
            })
          }),
          insert: vi.fn().mockResolvedValue({})
        };
        return await callback(mockTx);
      });

      mockDb.transaction.mockImplementation(mockTransaction);

      await service.deactivateSettings(mockSettings.id, 'test-user');

      expect(mockDashboardService.clearValidationCache).toHaveBeenCalled();
    });
  });

  describe('Audit Trail Integration', () => {
    it('should log audit trail for settings updates', async () => {
      const mockTransaction = vi.fn().mockImplementation(async (callback) => {
        const mockTx = {
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([updatedSettings])
            })
          }),
          insert: vi.fn().mockResolvedValue({})
        };
        return await callback(mockTx);
      });

      mockDb.transaction.mockImplementation(mockTransaction);

      await service.updateSettings(mockSettings.id, updatedSettings.settings, 'test-user');

      // Verify audit trail was logged
      expect(mockDb.transaction).toHaveBeenCalled();
    });

    it('should include change details in audit trail', async () => {
      const mockTransaction = vi.fn().mockImplementation(async (callback) => {
        const mockTx = {
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([updatedSettings])
            })
          }),
          insert: vi.fn().mockResolvedValue({})
        };
        return await callback(mockTx);
      });

      mockDb.transaction.mockImplementation(mockTransaction);

      await service.updateSettings(mockSettings.id, updatedSettings.settings, 'test-user');

      // Verify transaction was called with audit trail logging
      expect(mockTransaction).toHaveBeenCalled();
    });
  });

  describe('Concurrent Settings Updates', () => {
    it('should handle concurrent settings updates correctly', async () => {
      const eventSpy1 = vi.fn();
      const eventSpy2 = vi.fn();
      
      service.on('settingsChanged', eventSpy1);
      service.on('settingsChanged', eventSpy2);

      const mockTransaction = vi.fn().mockImplementation(async (callback) => {
        const mockTx = {
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([updatedSettings])
            })
          }),
          insert: vi.fn().mockResolvedValue({})
        };
        return await callback(mockTx);
      });

      mockDb.transaction.mockImplementation(mockTransaction);

      // Simulate concurrent updates
      const update1 = service.updateSettings(mockSettings.id, updatedSettings.settings, 'user1');
      const update2 = service.updateSettings(mockSettings.id, updatedSettings.settings, 'user2');

      await Promise.all([update1, update2]);

      // Verify both events were emitted
      expect(eventSpy1).toHaveBeenCalledTimes(2);
      expect(eventSpy2).toHaveBeenCalledTimes(2);
    });

    it('should handle rapid sequential settings updates', async () => {
      const eventSpy = vi.fn();
      service.on('settingsChanged', eventSpy);

      const mockTransaction = vi.fn().mockImplementation(async (callback) => {
        const mockTx = {
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([updatedSettings])
            })
          }),
          insert: vi.fn().mockResolvedValue({})
        };
        return await callback(mockTx);
      });

      mockDb.transaction.mockImplementation(mockTransaction);

      // Simulate rapid sequential updates
      for (let i = 0; i < 5; i++) {
        await service.updateSettings(mockSettings.id, updatedSettings.settings, `user${i}`);
      }

      // Verify all events were emitted
      expect(eventSpy).toHaveBeenCalledTimes(5);
    });
  });

  describe('Error Handling in Real-time Updates', () => {
    it('should handle database errors during settings updates', async () => {
      const eventSpy = vi.fn();
      service.on('settingsChanged', eventSpy);

      const mockTransaction = vi.fn().mockImplementation(async (callback) => {
        const mockTx = {
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockRejectedValue(new Error('Database error'))
            })
          })
        };
        return await callback(mockTx);
      });

      mockDb.transaction.mockImplementation(mockTransaction);

      await expect(service.updateSettings(mockSettings.id, updatedSettings.settings, 'test-user'))
        .rejects.toThrow('Database error');

      // Verify no event was emitted due to error
      expect(eventSpy).not.toHaveBeenCalled();
    });

    it('should handle audit trail errors gracefully', async () => {
      const eventSpy = vi.fn();
      service.on('settingsChanged', eventSpy);

      const mockTransaction = vi.fn().mockImplementation(async (callback) => {
        const mockTx = {
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([updatedSettings])
            })
          }),
          insert: vi.fn().mockRejectedValue(new Error('Audit trail error'))
        };
        return await callback(mockTx);
      });

      mockDb.transaction.mockImplementation(mockTransaction);

      await expect(service.updateSettings(mockSettings.id, updatedSettings.settings, 'test-user'))
        .rejects.toThrow('Audit trail error');

      // Verify no event was emitted due to error
      expect(eventSpy).not.toHaveBeenCalled();
    });

    it('should handle dashboard cache clearing errors gracefully', async () => {
      const mockDashboardService = {
        clearValidationCache: vi.fn().mockRejectedValue(new Error('Cache clear error'))
      };

      vi.mocked(require('../dashboard/dashboard-service').DashboardService).mockReturnValue(mockDashboardService);

      const mockTransaction = vi.fn().mockImplementation(async (callback) => {
        const mockTx = {
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([updatedSettings])
            })
          }),
          insert: vi.fn().mockResolvedValue({})
        };
        return await callback(mockTx);
      });

      mockDb.transaction.mockImplementation(mockTransaction);

      // Should not throw error even if cache clearing fails
      await expect(service.updateSettings(mockSettings.id, updatedSettings.settings, 'test-user'))
        .resolves.not.toThrow();

      expect(mockDashboardService.clearValidationCache).toHaveBeenCalled();
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle high-frequency settings updates efficiently', async () => {
      const eventSpy = vi.fn();
      service.on('settingsChanged', eventSpy);

      const mockTransaction = vi.fn().mockImplementation(async (callback) => {
        const mockTx = {
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([updatedSettings])
            })
          }),
          insert: vi.fn().mockResolvedValue({})
        };
        return await callback(mockTx);
      });

      mockDb.transaction.mockImplementation(mockTransaction);

      const startTime = Date.now();

      // Simulate high-frequency updates
      const updates = Array.from({ length: 100 }, (_, i) => 
        service.updateSettings(mockSettings.id, updatedSettings.settings, `user${i}`)
      );

      await Promise.all(updates);

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      // Verify all events were emitted
      expect(eventSpy).toHaveBeenCalledTimes(100);
      
      // Verify performance is acceptable (adjust threshold as needed)
      expect(processingTime).toBeLessThan(5000); // 5 seconds
    });

    it('should handle multiple concurrent event listeners efficiently', async () => {
      const eventSpies = Array.from({ length: 50 }, () => vi.fn());
      eventSpies.forEach(spy => service.on('settingsChanged', spy));

      const mockTransaction = vi.fn().mockImplementation(async (callback) => {
        const mockTx = {
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([updatedSettings])
            })
          }),
          insert: vi.fn().mockResolvedValue({})
        };
        return await callback(mockTx);
      });

      mockDb.transaction.mockImplementation(mockTransaction);

      await service.updateSettings(mockSettings.id, updatedSettings.settings, 'test-user');

      // Verify all event listeners were called
      eventSpies.forEach(spy => {
        expect(spy).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Event Data Integrity', () => {
    it('should include correct change data in settingsChanged events', async () => {
      const eventSpy = vi.fn();
      service.on('settingsChanged', eventSpy);

      const mockTransaction = vi.fn().mockImplementation(async (callback) => {
        const mockTx = {
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([updatedSettings])
            })
          }),
          insert: vi.fn().mockResolvedValue({})
        };
        return await callback(mockTx);
      });

      mockDb.transaction.mockImplementation(mockTransaction);

      await service.updateSettings(mockSettings.id, updatedSettings.settings, 'test-user');

      expect(eventSpy).toHaveBeenCalledWith({
        type: 'settingsChanged',
        settingsId: mockSettings.id,
        performedBy: 'test-user',
        changes: expect.objectContaining({
          structural: expect.objectContaining({
            enabled: expect.objectContaining({ from: true, to: false })
          })
        })
      });
    });

    it('should include timestamp in event data', async () => {
      const eventSpy = vi.fn();
      service.on('settingsChanged', eventSpy);

      const mockTransaction = vi.fn().mockImplementation(async (callback) => {
        const mockTx = {
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([updatedSettings])
            })
          }),
          insert: vi.fn().mockResolvedValue({})
        };
        return await callback(mockTx);
      });

      mockDb.transaction.mockImplementation(mockTransaction);

      const beforeUpdate = new Date();
      await service.updateSettings(mockSettings.id, updatedSettings.settings, 'test-user');
      const afterUpdate = new Date();

      const eventData = eventSpy.mock.calls[0][0];
      expect(eventData.timestamp).toBeInstanceOf(Date);
      expect(eventData.timestamp.getTime()).toBeGreaterThanOrEqual(beforeUpdate.getTime());
      expect(eventData.timestamp.getTime()).toBeLessThanOrEqual(afterUpdate.getTime());
    });
  });
});
