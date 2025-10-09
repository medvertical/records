import React, { createContext, useContext, ReactNode } from 'react';
import { useDashboardDataWiring } from '@/hooks/use-dashboard-data-wiring';

interface DashboardContextType {
  // Alert Data
  alerts: any[];
  alertSummary: any;
  refreshAlerts: () => void;
  
  // Overview Data
  overviewMetrics: any;
  refreshOverview: () => void;
  
  // Status Data
  serverStatus: any;
  refreshStatus: () => void;
  
  // Trends Data
  trendData: any;
  trendMetrics: any;
  refreshTrends: () => void;
  
  // Resource Breakdown Data
  resourceBreakdown: any;
  refreshResourceBreakdown: () => void;
  
  // Validation Data
  validationProgress: any;
  validationConnected: boolean;
  connectionState: string;
  pollingError: any;
  startPolling: () => void;
  stopPolling: () => void;
  syncWithApi: () => void;
  
  // Global States
  isLoading: boolean;
  hasErrors: boolean;
  lastUpdated: Date | null;
  refreshAll: () => void;
}

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

interface DashboardProviderProps {
  children: ReactNode;
}

export const DashboardProvider: React.FC<DashboardProviderProps> = ({ children }) => {
  // Use real data wiring hook now that infinite loop is fixed
  const dashboardData = useDashboardDataWiring();

  return (
    <DashboardContext.Provider value={dashboardData}>
      {children}
    </DashboardContext.Provider>
  );
};

export function useDashboard(): DashboardContextType {
  const context = useContext(DashboardContext);
  if (context === undefined) {
    throw new Error('useDashboard must be used within a DashboardProvider');
  }
  return context;
}
