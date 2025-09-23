// Dashboard Types - Single responsibility: Type definitions for dashboard components
// Follows global rules: Comprehensive type safety, single responsibility

import { LucideIcon } from 'lucide-react';

// ============================================================================
// Base Dashboard Card Types
// ============================================================================

export interface BaseDashboardCardProps {
  title: string;
  icon: LucideIcon;
  className?: string;
  children: React.ReactNode;
}

export interface LoadingCardProps {
  title: string;
  icon: LucideIcon;
  className?: string;
}

export interface ErrorCardProps {
  title: string;
  icon: LucideIcon;
  error: string;
  className?: string;
}

// ============================================================================
// Dashboard Widget Types
// ============================================================================

export interface DashboardWidgetProps {
  className?: string;
}

export interface AlertData {
  id: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  timestamp: Date;
  source?: string;
}

export interface OverviewMetrics {
  totalResources: number;
  validatedResources: number;
  successRate: number;
  lastUpdated: Date;
}

export interface ValidationStatus {
  status: 'idle' | 'running' | 'paused' | 'completed' | 'failed';
  progress: number;
  currentResourceType?: string;
  processingRate?: number;
  estimatedTimeRemaining?: string;
}

export interface TrendData {
  timestamp: Date;
  value: number;
  label: string;
}

export interface TrendMetrics {
  current: number;
  previous: number;
  change: number;
  direction: 'up' | 'down' | 'stable';
}

export interface ResourceBreakdownItem {
  type: string;
  count: number;
  percentage: number;
}

export interface ResourceBreakdownData {
  items: ResourceBreakdownItem[];
  total: number;
  lastUpdated: Date;
}

// ============================================================================
// Dashboard Data Wiring Types
// ============================================================================

export interface DashboardDataWiringOptions {
  enableRealTimeUpdates?: boolean;
  refetchInterval?: number;
  enabled?: boolean;
  onError?: (error: Error) => void;
}

export interface DashboardDataWiringReturn {
  // Alert data
  alerts: AlertData[] | undefined;
  alertsLoading: boolean;
  alertsError: string | null;
  refreshAlerts: () => void;

  // Overview data
  fhirServerStats: OverviewMetrics | undefined;
  validationStats: OverviewMetrics | undefined;
  overviewLoading: boolean;
  overviewError: string | null;
  refreshOverview: () => void;

  // Status data
  validationStatus: ValidationStatus | undefined;
  statusLoading: boolean;
  statusError: string | null;
  refreshStatus: () => void;

  // Trends data
  trendsData: TrendData[] | undefined;
  trendsMetrics: TrendMetrics | undefined;
  trendsLoading: boolean;
  trendsError: string | null;
  refreshTrends: () => void;

  // Resource breakdown data
  resourceBreakdown: ResourceBreakdownData | undefined;
  resourceBreakdownLoading: boolean;
  resourceBreakdownError: string | null;
  refreshResourceBreakdown: () => void;

  // General state
  isLoading: boolean;
  hasErrors: boolean;
  refreshAll: () => void;
}

// ============================================================================
// Validation Aspect Types
// ============================================================================

export interface ValidationAspect {
  id: string;
  name: string;
  enabled: boolean;
  severity: 'error' | 'warning' | 'info';
  description: string;
}

export interface ValidationAspectsPanelProps {
  className?: string;
}

// ============================================================================
// Validation Control Panel Types
// ============================================================================

export interface ValidationControlPanelProps {
  className?: string;
}

export interface ValidationControlActions {
  start: () => Promise<void>;
  stop: () => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  refresh: () => void;
}

// ============================================================================
// Dashboard Layout Types
// ============================================================================

export interface ModernDashboardLayoutProps {
  className?: string;
}

// ============================================================================
// Utility Types
// ============================================================================

export type DashboardWidgetType = 
  | 'alert'
  | 'overview'
  | 'status'
  | 'trends'
  | 'resource-breakdown'
  | 'validation-control'
  | 'validation-aspects';

export interface DashboardWidgetConfig {
  type: DashboardWidgetType;
  title: string;
  icon: LucideIcon;
  enabled: boolean;
  position: { row: number; col: number };
  size: { width: number; height: number };
}

export interface DashboardLayoutConfig {
  widgets: DashboardWidgetConfig[];
  columns: number;
  rows: number;
}
