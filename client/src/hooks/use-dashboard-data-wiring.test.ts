import { renderHook, waitFor } from '@testing-library/react';
import { useDashboardDataWiring } from './use-dashboard-data-wiring';

// Mock the data hooks
jest.mock('./use-dashboard-data', () => ({
  useDashboardData: jest.fn(),
}));

jest.mock('./use-validation-polling', () => ({
  useValidationPolling: jest.fn(),
}));

jest.mock('./use-server-data', () => ({
  useServerData: jest.fn(),
}));

// Mock the data adapters
jest.mock('@/lib/dashboard-data-adapters', () => ({
  AlertDataAdapter: {
    transformValidationErrors: jest.fn((errors) => 
      errors.map((error: any) => ({
        id: `alert-${error.id}`,
        type: 'warning',
        title: 'Validation Error',
        message: error.message,
        timestamp: new Date(),
        resolved: false,
      }))
    ),
    transformServerAlerts: jest.fn((alerts) => 
      alerts.map((alert: any) => ({
        id: `server-${alert.message}`,
        type: 'error',
        title: 'Server Error',
        message: alert.message,
        timestamp: new Date(),
        resolved: false,
      }))
    ),
    createAlertSummary: jest.fn((alerts) => ({
      critical: alerts.filter((a: any) => a.type === 'critical').length,
      warnings: alerts.filter((a: any) => a.type === 'warning').length,
      info: alerts.filter((a: any) => a.type === 'info').length,
      total: alerts.length,
    })),
  },
  OverviewDataAdapter: {
    transformDashboardData: jest.fn((data) => ({
      totalResources: data?.totalResources || 0,
      validatedResources: data?.validatedResources || 0,
      successRate: data?.successRate || 0,
      validationCoverage: data?.validationCoverage || 0,
    })),
  },
  StatusDataAdapter: {
    transformValidationStatus: jest.fn((status) => ({
      status: status?.status || 'idle',
      progress: status?.progress || 0,
      currentResourceType: status?.currentResourceType || 'Unknown',
      nextResourceType: status?.nextResourceType || 'Unknown',
      processingRate: status?.processingRate || 0,
      estimatedTimeRemaining: status?.estimatedTimeRemaining,
    })),
  },
  TrendsDataAdapter: {
    transformTrendData: jest.fn((data) => 
      (data || []).map((item: any) => ({
        date: item.date,
        successRate: item.successRate || 0,
        totalResources: item.totalResources || 0,
      }))
    ),
    createTrendMetrics: jest.fn((trends) => ({
      current: trends[trends.length - 1]?.successRate || 0,
      direction: 'up',
      change: 0,
    })),
  },
  ResourceBreakdownDataAdapter: {
    transformResourceBreakdown: jest.fn((data) => ({
      totalResources: data?.totalResources || 0,
      resourceTypes: (data?.resourceTypes || []).map((type: any) => ({
        name: type.name,
        count: type.count || 0,
        percentage: type.percentage || 0,
        validated: type.validated || 0,
        successRate: type.successRate || 0,
      })),
    })),
  },
}));

// Mock performance utilities
jest.mock('@/lib/performance-utils', () => ({
  useDebouncedValue: jest.fn((value) => value),
  useThrottledCallback: jest.fn((callback) => callback),
}));

import { useDashboardData } from './use-dashboard-data';
import { useValidationPolling } from './use-validation-polling';
import { useServerData } from './use-server-data';

const mockUseDashboardData = useDashboardData as jest.MockedFunction<typeof useDashboardData>;
const mockUseValidationPolling = useValidationPolling as jest.MockedFunction<typeof useValidationPolling>;
const mockUseServerData = useServerData as jest.MockedFunction<typeof useServerData>;

describe('useDashboardDataWiring', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Data Integration', () => {
    it('integrates dashboard data correctly', async () => {
      const mockDashboardData = {
        totalResources: 1000,
        validatedResources: 750,
        successRate: 85.5,
        validationCoverage: 75.0,
      };

      const mockValidationStatus = {
        status: 'running',
        progress: 67.5,
        currentResourceType: 'Patient',
        nextResourceType: 'Observation',
        processingRate: 1247,
        estimatedTimeRemaining: 1380,
      };

      const mockServerStatus = {
        connected: true,
        version: 'R4',
        totalResources: 1000,
        error: null,
      };

      mockUseDashboardData.mockReturnValue({
        data: mockDashboardData,
        isLoading: false,
        error: null,
        refetch: jest.fn(),
        lastUpdated: new Date(),
      });

      mockUseValidationPolling.mockReturnValue({
        status: mockValidationStatus,
        isLoading: false,
        error: null,
        syncWithApi: jest.fn(),
        lastUpdated: new Date(),
      });

      mockUseServerData.mockReturnValue({
        data: mockServerStatus,
        isLoading: false,
        error: null,
        refetch: jest.fn(),
      });

      const { result } = renderHook(() => useDashboardDataWiring());

      await waitFor(() => {
        expect(result.current.overviewMetrics).toEqual({
          totalResources: 1000,
          validatedResources: 750,
          successRate: 85.5,
          validationCoverage: 75.0,
        });
      });

      expect(result.current.validationStatus).toEqual(mockValidationStatus);
      expect(result.current.serverStatus).toEqual(mockServerStatus);
    });

    it('handles loading states correctly', () => {
      mockUseDashboardData.mockReturnValue({
        data: null,
        isLoading: true,
        error: null,
        refetch: jest.fn(),
        lastUpdated: new Date(),
      });

      mockUseValidationPolling.mockReturnValue({
        status: null,
        isLoading: true,
        error: null,
        syncWithApi: jest.fn(),
        lastUpdated: new Date(),
      });

      mockUseServerData.mockReturnValue({
        data: null,
        isLoading: true,
        error: null,
        refetch: jest.fn(),
      });

      const { result } = renderHook(() => useDashboardDataWiring());

      expect(result.current.isLoading).toBe(true);
      expect(result.current.hasErrors).toBe(false);
    });

    it('handles error states correctly', () => {
      mockUseDashboardData.mockReturnValue({
        data: null,
        isLoading: false,
        error: 'Dashboard error',
        refetch: jest.fn(),
        lastUpdated: new Date(),
      });

      mockUseValidationPolling.mockReturnValue({
        status: null,
        isLoading: false,
        error: 'Validation error',
        syncWithApi: jest.fn(),
        lastUpdated: new Date(),
      });

      mockUseServerData.mockReturnValue({
        data: null,
        isLoading: false,
        error: 'Server error',
        refetch: jest.fn(),
      });

      const { result } = renderHook(() => useDashboardDataWiring());

      expect(result.current.isLoading).toBe(false);
      expect(result.current.hasErrors).toBe(true);
    });
  });

  describe('Alert Data Flow', () => {
    it('transforms validation errors into alerts', async () => {
      const mockValidationErrors = [
        { id: '1', message: 'Validation error 1' },
        { id: '2', message: 'Validation error 2' },
      ];

      const mockServerAlerts = [
        { message: 'Server error 1', level: 'error' },
      ];

      mockUseDashboardData.mockReturnValue({
        data: null,
        isLoading: false,
        error: null,
        refetch: jest.fn(),
        lastUpdated: new Date(),
      });

      mockUseValidationPolling.mockReturnValue({
        status: {
          aspectBreakdown: mockValidationErrors,
        },
        isLoading: false,
        error: null,
        syncWithApi: jest.fn(),
        lastUpdated: new Date(),
      });

      mockUseServerData.mockReturnValue({
        data: { error: 'Server error 1' },
        isLoading: false,
        error: null,
        refetch: jest.fn(),
      });

      const { result } = renderHook(() => useDashboardDataWiring());

      await waitFor(() => {
        expect(result.current.alerts).toHaveLength(3); // 2 validation + 1 server
        expect(result.current.alertSummary.total).toBe(3);
      });
    });

    it('creates alert summary correctly', async () => {
      const mockAlerts = [
        { type: 'critical' },
        { type: 'warning' },
        { type: 'info' },
      ];

      mockUseDashboardData.mockReturnValue({
        data: null,
        isLoading: false,
        error: null,
        refetch: jest.fn(),
        lastUpdated: new Date(),
      });

      mockUseValidationPolling.mockReturnValue({
        status: { aspectBreakdown: [] },
        isLoading: false,
        error: null,
        syncWithApi: jest.fn(),
        lastUpdated: new Date(),
      });

      mockUseServerData.mockReturnValue({
        data: null,
        isLoading: false,
        error: null,
        refetch: jest.fn(),
      });

      const { result } = renderHook(() => useDashboardDataWiring());

      await waitFor(() => {
        expect(result.current.alertSummary).toEqual({
          critical: 1,
          warnings: 1,
          info: 1,
          total: 3,
        });
      });
    });
  });

  describe('Overview Data Flow', () => {
    it('transforms dashboard data into overview metrics', async () => {
      const mockDashboardData = {
        totalResources: 1000,
        validatedResources: 750,
        successRate: 85.5,
        validationCoverage: 75.0,
      };

      mockUseDashboardData.mockReturnValue({
        data: mockDashboardData,
        isLoading: false,
        error: null,
        refetch: jest.fn(),
        lastUpdated: new Date(),
      });

      mockUseValidationPolling.mockReturnValue({
        status: null,
        isLoading: false,
        error: null,
        syncWithApi: jest.fn(),
        lastUpdated: new Date(),
      });

      mockUseServerData.mockReturnValue({
        data: null,
        isLoading: false,
        error: null,
        refetch: jest.fn(),
      });

      const { result } = renderHook(() => useDashboardDataWiring());

      await waitFor(() => {
        expect(result.current.overviewMetrics).toEqual(mockDashboardData);
      });
    });
  });

  describe('Status Data Flow', () => {
    it('transforms validation status correctly', async () => {
      const mockValidationStatus = {
        status: 'running',
        progress: 67.5,
        currentResourceType: 'Patient',
        nextResourceType: 'Observation',
        processingRate: 1247,
        estimatedTimeRemaining: 1380,
      };

      mockUseDashboardData.mockReturnValue({
        data: null,
        isLoading: false,
        error: null,
        refetch: jest.fn(),
        lastUpdated: new Date(),
      });

      mockUseValidationPolling.mockReturnValue({
        status: mockValidationStatus,
        isLoading: false,
        error: null,
        syncWithApi: jest.fn(),
        lastUpdated: new Date(),
      });

      mockUseServerData.mockReturnValue({
        data: null,
        isLoading: false,
        error: null,
        refetch: jest.fn(),
      });

      const { result } = renderHook(() => useDashboardDataWiring());

      await waitFor(() => {
        expect(result.current.validationStatus).toEqual(mockValidationStatus);
      });
    });
  });

  describe('Trends Data Flow', () => {
    it('transforms trend data correctly', async () => {
      const mockTrendData = [
        { date: '2023-01-01', successRate: 80, totalResources: 100 },
        { date: '2023-01-02', successRate: 85, totalResources: 150 },
      ];

      mockUseDashboardData.mockReturnValue({
        data: { trends: mockTrendData },
        isLoading: false,
        error: null,
        refetch: jest.fn(),
        lastUpdated: new Date(),
      });

      mockUseValidationPolling.mockReturnValue({
        status: null,
        isLoading: false,
        error: null,
        syncWithApi: jest.fn(),
        lastUpdated: new Date(),
      });

      mockUseServerData.mockReturnValue({
        data: null,
        isLoading: false,
        error: null,
        refetch: jest.fn(),
      });

      const { result } = renderHook(() => useDashboardDataWiring());

      await waitFor(() => {
        expect(result.current.trendsData).toHaveLength(2);
        expect(result.current.trendMetrics.current).toBe(85);
      });
    });
  });

  describe('Resource Breakdown Data Flow', () => {
    it('transforms resource breakdown data correctly', async () => {
      const mockResourceData = {
        totalResources: 1000,
        resourceTypes: [
          { name: 'Patient', count: 500, percentage: 50, validated: 400, successRate: 80 },
          { name: 'Observation', count: 300, percentage: 30, validated: 250, successRate: 83 },
        ],
      };

      mockUseDashboardData.mockReturnValue({
        data: { resourceBreakdown: mockResourceData },
        isLoading: false,
        error: null,
        refetch: jest.fn(),
        lastUpdated: new Date(),
      });

      mockUseValidationPolling.mockReturnValue({
        status: null,
        isLoading: false,
        error: null,
        syncWithApi: jest.fn(),
        lastUpdated: new Date(),
      });

      mockUseServerData.mockReturnValue({
        data: null,
        isLoading: false,
        error: null,
        refetch: jest.fn(),
      });

      const { result } = renderHook(() => useDashboardDataWiring());

      await waitFor(() => {
        expect(result.current.resourceBreakdownData.totalResources).toBe(1000);
        expect(result.current.resourceBreakdownData.resourceTypes).toHaveLength(2);
      });
    });
  });

  describe('Refresh Functions', () => {
    it('provides refresh functions for each data type', () => {
      const mockRefetchDashboard = jest.fn();
      const mockSyncWithApi = jest.fn();
      const mockRefetchServer = jest.fn();

      mockUseDashboardData.mockReturnValue({
        data: null,
        isLoading: false,
        error: null,
        refetch: mockRefetchDashboard,
        lastUpdated: new Date(),
      });

      mockUseValidationPolling.mockReturnValue({
        status: null,
        isLoading: false,
        error: null,
        syncWithApi: mockSyncWithApi,
        lastUpdated: new Date(),
      });

      mockUseServerData.mockReturnValue({
        data: null,
        isLoading: false,
        error: null,
        refetch: mockRefetchServer,
      });

      const { result } = renderHook(() => useDashboardDataWiring());

      expect(typeof result.current.refreshAlerts).toBe('function');
      expect(typeof result.current.refreshOverview).toBe('function');
      expect(typeof result.current.refreshStatus).toBe('function');
      expect(typeof result.current.refreshTrends).toBe('function');
      expect(typeof result.current.refreshResourceBreakdown).toBe('function');
      expect(typeof result.current.refreshAll).toBe('function');
    });
  });

  describe('Performance Optimizations', () => {
    it('uses debounced values for rapid updates', () => {
      const { useDebouncedValue } = require('@/lib/performance-utils');
      
      mockUseDashboardData.mockReturnValue({
        data: null,
        isLoading: false,
        error: null,
        refetch: jest.fn(),
        lastUpdated: new Date(),
      });

      mockUseValidationPolling.mockReturnValue({
        status: null,
        isLoading: false,
        error: null,
        syncWithApi: jest.fn(),
        lastUpdated: new Date(),
      });

      mockUseServerData.mockReturnValue({
        data: null,
        isLoading: false,
        error: null,
        refetch: jest.fn(),
      });

      renderHook(() => useDashboardDataWiring());

      expect(useDebouncedValue).toHaveBeenCalled();
    });

    it('uses throttled callbacks for refresh functions', () => {
      const { useThrottledCallback } = require('@/lib/performance-utils');
      
      mockUseDashboardData.mockReturnValue({
        data: null,
        isLoading: false,
        error: null,
        refetch: jest.fn(),
        lastUpdated: new Date(),
      });

      mockUseValidationPolling.mockReturnValue({
        status: null,
        isLoading: false,
        error: null,
        syncWithApi: jest.fn(),
        lastUpdated: new Date(),
      });

      mockUseServerData.mockReturnValue({
        data: null,
        isLoading: false,
        error: null,
        refetch: jest.fn(),
      });

      renderHook(() => useDashboardDataWiring());

      expect(useThrottledCallback).toHaveBeenCalled();
    });
  });
});
