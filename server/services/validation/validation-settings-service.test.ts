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

describe('ValidationSettingsService', () => {
  let service: ValidationSettingsService;
  let mockDb: any;

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

  const mockUpdateSettings = {
    structural: { enabled: false, severity: 'error' },
    profile: { enabled: true, severity: 'warning' },
    terminology: { enabled: true, severity: 'error' },
    reference: { enabled: false, severity: 'error' },
    businessRule: { enabled: true, severity: 'warning' },
    metadata: { enabled: true, severity: 'info' }
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = {
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      transaction: vi.fn()
    };
    
    service = new ValidationSettingsService();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('getActiveSettings', () => {
    it('should return active validation settings', async () => {
      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockSettings])
          })
        })
      });

      mockDb.select.mockReturnValue(mockSelect);

      const result = await service.getActiveSettings();

      expect(result).toEqual(mockSettings);
      expect(mockDb.select).toHaveBeenCalledWith();
    });

    it('should return null when no active settings found', async () => {
      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([])
          })
        })
      });

      mockDb.select.mockReturnValue(mockSelect);

      const result = await service.getActiveSettings();

      expect(result).toBeNull();
    });

    it('should handle database errors gracefully', async () => {
      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockRejectedValue(new Error('Database error'))
          })
        })
      });

      mockDb.select.mockReturnValue(mockSelect);

      await expect(service.getActiveSettings()).rejects.toThrow('Database error');
    });
  });

  describe('updateSettings', () => {
    it('should update validation settings successfully', async () => {
      const mockTransaction = vi.fn().mockImplementation(async (callback) => {
        const mockTx = {
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([{ ...mockSettings, settings: mockUpdateSettings }])
            })
          }),
          insert: vi.fn().mockResolvedValue({})
        };
        return await callback(mockTx);
      });

      mockDb.transaction.mockImplementation(mockTransaction);

      const result = await service.updateSettings(mockSettings.id, mockUpdateSettings, 'test-user');

      expect(result).toEqual({ ...mockSettings, settings: mockUpdateSettings });
      expect(mockDb.transaction).toHaveBeenCalled();
    });

    it('should log audit trail when updating settings', async () => {
      const mockTransaction = vi.fn().mockImplementation(async (callback) => {
        const mockTx = {
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([{ ...mockSettings, settings: mockUpdateSettings }])
            })
          }),
          insert: vi.fn().mockResolvedValue({})
        };
        return await callback(mockTx);
      });

      mockDb.transaction.mockImplementation(mockTransaction);

      await service.updateSettings(mockSettings.id, mockUpdateSettings, 'test-user');

      expect(mockTransaction).toHaveBeenCalled();
      // Verify that insert was called for audit trail
      const transactionCallback = mockTransaction.mock.calls[0][0];
      const mockTx = {
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ ...mockSettings, settings: mockUpdateSettings }])
          })
        }),
        insert: vi.fn().mockResolvedValue({})
      };
      await transactionCallback(mockTx);
      expect(mockTx.insert).toHaveBeenCalled();
    });

    it('should handle update errors gracefully', async () => {
      const mockTransaction = vi.fn().mockImplementation(async (callback) => {
        const mockTx = {
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockRejectedValue(new Error('Update failed'))
            })
          })
        };
        return await callback(mockTx);
      });

      mockDb.transaction.mockImplementation(mockTransaction);

      await expect(service.updateSettings(mockSettings.id, mockUpdateSettings, 'test-user'))
        .rejects.toThrow('Update failed');
    });
  });

  describe('createSettings', () => {
    const newSettingsData = {
      name: 'New Settings',
      description: 'New validation settings',
      settings: mockUpdateSettings
    };

    it('should create new validation settings successfully', async () => {
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

      const result = await service.createSettings(newSettingsData, 'test-user');

      expect(result).toEqual({ ...mockSettings, ...newSettingsData });
      expect(mockDb.transaction).toHaveBeenCalled();
    });

    it('should log audit trail when creating settings', async () => {
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

      expect(mockTransaction).toHaveBeenCalled();
    });

    it('should handle creation errors gracefully', async () => {
      const mockTransaction = vi.fn().mockImplementation(async (callback) => {
        const mockTx = {
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockReturnValue({
              returning: vi.fn().mockRejectedValue(new Error('Creation failed'))
            })
          })
        };
        return await callback(mockTx);
      });

      mockDb.transaction.mockImplementation(mockTransaction);

      await expect(service.createSettings(newSettingsData, 'test-user'))
        .rejects.toThrow('Creation failed');
    });
  });

  describe('activateSettings', () => {
    it('should activate settings successfully', async () => {
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

      const result = await service.activateSettings(mockSettings.id, 'test-user');

      expect(result).toEqual({ ...mockSettings, isActive: true });
      expect(mockDb.transaction).toHaveBeenCalled();
    });

    it('should log audit trail when activating settings', async () => {
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

      expect(mockTransaction).toHaveBeenCalled();
    });
  });

  describe('deactivateSettings', () => {
    it('should deactivate settings successfully', async () => {
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

      const result = await service.deactivateSettings(mockSettings.id, 'test-user');

      expect(result).toEqual({ ...mockSettings, isActive: false });
      expect(mockDb.transaction).toHaveBeenCalled();
    });
  });

  describe('deleteSettings', () => {
    it('should delete settings successfully', async () => {
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

      const result = await service.deleteSettings(mockSettings.id, 'test-user');

      expect(result).toEqual(mockSettings);
      expect(mockDb.transaction).toHaveBeenCalled();
    });
  });

  describe('rollbackToVersion', () => {
    it('should rollback to previous version successfully', async () => {
      const previousVersion = {
        ...mockSettings,
        settings: {
          structural: { enabled: true, severity: 'error' },
          profile: { enabled: false, severity: 'error' },
          terminology: { enabled: true, severity: 'warning' },
          reference: { enabled: true, severity: 'error' },
          businessRule: { enabled: true, severity: 'warning' },
          metadata: { enabled: true, severity: 'info' }
        }
      };

      const mockTransaction = vi.fn().mockImplementation(async (callback) => {
        const mockTx = {
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([previousVersion])
            })
          }),
          insert: vi.fn().mockResolvedValue({})
        };
        return await callback(mockTx);
      });

      mockDb.transaction.mockImplementation(mockTransaction);

      const result = await service.rollbackToVersion(mockSettings.id, 1, 'test-user');

      expect(result).toEqual(previousVersion);
      expect(mockDb.transaction).toHaveBeenCalled();
    });
  });

  describe('getAuditTrailHistory', () => {
    it('should retrieve audit trail history successfully', async () => {
      const mockAuditEntries = [
        {
          id: 'audit-1',
          settingsId: mockSettings.id,
          version: 1,
          action: 'CREATE',
          performedBy: 'test-user',
          performedAt: new Date(),
          changeReason: 'Initial creation',
          changes: {},
          metadata: {}
        },
        {
          id: 'audit-2',
          settingsId: mockSettings.id,
          version: 2,
          action: 'UPDATE',
          performedBy: 'test-user',
          performedAt: new Date(),
          changeReason: 'Updated validation aspects',
          changes: { structural: { enabled: { from: true, to: false } } },
          metadata: {}
        }
      ];

      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue(mockAuditEntries)
            })
          })
        })
      });

      mockDb.select.mockReturnValue(mockSelect);

      const result = await service.getAuditTrailHistory(mockSettings.id, 10);

      expect(result).toEqual(mockAuditEntries);
      expect(mockDb.select).toHaveBeenCalled();
    });

    it('should handle empty audit trail history', async () => {
      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([])
            })
          })
        })
      });

      mockDb.select.mockReturnValue(mockSelect);

      const result = await service.getAuditTrailHistory(mockSettings.id, 10);

      expect(result).toEqual([]);
    });
  });

  describe('getAuditTrailStatistics', () => {
    it('should retrieve audit trail statistics successfully', async () => {
      const mockStats = {
        totalEntries: 25,
        entriesByAction: {
          CREATE: 5,
          UPDATE: 15,
          DELETE: 2,
          ACTIVATE: 2,
          DEACTIVATE: 1
        },
        entriesByUser: {
          'admin': 10,
          'user1': 8,
          'user2': 7
        },
        recentActivity: [
          {
            action: 'UPDATE',
            performedBy: 'user1',
            performedAt: new Date()
          }
        ]
      };

      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            groupBy: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue([])
            })
          })
        })
      });

      mockDb.select.mockReturnValue(mockSelect);

      // Mock the aggregation logic
      const result = await service.getAuditTrailStatistics(mockSettings.id);

      expect(result).toBeDefined();
      expect(mockDb.select).toHaveBeenCalled();
    });
  });

  describe('Event System', () => {
    it('should emit settings changed event when settings are updated', async () => {
      const eventSpy = vi.fn();
      service.on('settingsChanged', eventSpy);

      const mockTransaction = vi.fn().mockImplementation(async (callback) => {
        const mockTx = {
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([{ ...mockSettings, settings: mockUpdateSettings }])
            })
          }),
          insert: vi.fn().mockResolvedValue({})
        };
        return await callback(mockTx);
      });

      mockDb.transaction.mockImplementation(mockTransaction);

      await service.updateSettings(mockSettings.id, mockUpdateSettings, 'test-user');

      expect(eventSpy).toHaveBeenCalledWith({
        type: 'settingsChanged',
        settingsId: mockSettings.id,
        performedBy: 'test-user',
        changes: expect.any(Object)
      });
    });

    it('should emit settings activated event when settings are activated', async () => {
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
  });

  describe('Error Handling', () => {
    it('should handle database connection errors', async () => {
      mockDb.select.mockRejectedValue(new Error('Connection failed'));

      await expect(service.getActiveSettings()).rejects.toThrow('Connection failed');
    });

    it('should handle invalid settings data', async () => {
      const invalidSettings = {
        structural: { enabled: 'invalid', severity: 'error' }, // invalid boolean
        profile: { enabled: true, severity: 'invalid' } // invalid severity
      };

      const mockTransaction = vi.fn().mockImplementation(async (callback) => {
        const mockTx = {
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockRejectedValue(new Error('Invalid settings format'))
            })
          })
        };
        return await callback(mockTx);
      });

      mockDb.transaction.mockImplementation(mockTransaction);

      await expect(service.updateSettings(mockSettings.id, invalidSettings, 'test-user'))
        .rejects.toThrow('Invalid settings format');
    });

    it('should handle transaction rollback', async () => {
      const mockTransaction = vi.fn().mockImplementation(async (callback) => {
        const mockTx = {
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([{ ...mockSettings, settings: mockUpdateSettings }])
            })
          }),
          insert: vi.fn().mockRejectedValue(new Error('Audit trail insert failed'))
        };
        return await callback(mockTx);
      });

      mockDb.transaction.mockImplementation(mockTransaction);

      await expect(service.updateSettings(mockSettings.id, mockUpdateSettings, 'test-user'))
        .rejects.toThrow('Audit trail insert failed');
    });
  });
});
