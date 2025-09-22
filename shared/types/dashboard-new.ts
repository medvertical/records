// ============================================================================
// New Dashboard Type Definitions - Based on Wireframe Specifications
// ============================================================================

/**
 * Alert System Types
 */
export interface Alert {
  id: string;
  type: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: Date;
  resolved: boolean;
  actions?: AlertAction[];
}

export interface AlertAction {
  id: string;
  label: string;
  type: 'primary' | 'secondary' | 'danger';
  action: () => void;
}

export interface AlertSummary {
  critical: number;
  warnings: number;
  info: number;
  total: number;
}

/**
 * Widget Base Types
 */
export interface WidgetProps {
  id: string;
  title: string;
  subtitle?: string;
  loading?: boolean;
  error?: string;
  className?: string;
  children?: React.ReactNode;
  actions?: React.ReactNode;
}

export interface WidgetState {
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  isStale: boolean;
}

/**
 * Overview Card Types
 */
export interface OverviewMetrics {
  totalResources: number;
  validatedResources: number;
  successRate: number;
  validationCoverage: number;
}

/**
 * Status Card Types
 */
export interface ValidationStatus {
  status: 'idle' | 'running' | 'paused' | 'completed' | 'error';
  progress: number; // 0-100
  currentResourceType?: string;
  nextResourceType?: string;
  processingRate: number; // resources per minute
  estimatedTimeRemaining?: number; // minutes
}

/**
 * Trends Card Types
 */
export interface TrendData {
  date: Date;
  successRate: number;
  totalValidated: number;
  errorCount: number;
  warningCount: number;
}

export interface TrendMetrics {
  current: number;
  previous: number;
  change: number; // percentage change
  direction: 'up' | 'down' | 'stable';
  period: string; // e.g., "vs last week"
}

/**
 * Resource Breakdown Types
 */
export interface ResourceTypeData {
  type: string;
  count: number;
  percentage: number;
  validated: number;
  valid: number;
  errors: number;
  warnings: number;
  successRate: number;
}

export interface ResourceBreakdownData {
  totalResources: number;
  resourceTypes: ResourceTypeData[];
  topResourceTypes: ResourceTypeData[]; // top 6 by default
}

/**
 * Validation Control Panel Types
 */
export interface ValidationControlState {
  canStart: boolean;
  canPause: boolean;
  canResume: boolean;
  canStop: boolean;
  isInitializing: boolean;
}

export interface ValidationControlActions {
  onStart: () => Promise<void>;
  onPause: () => Promise<void>;
  onResume: () => Promise<void>;
  onStop: () => Promise<void>;
  onRevalidateAll: () => Promise<void>;
  onSettings: () => void;
}

/**
 * Progress Bar Types
 */
export interface ProgressBarProps {
  value: number; // 0-100
  max?: number;
  label?: string;
  showPercentage?: boolean;
  animated?: boolean;
  color?: 'default' | 'success' | 'warning' | 'error';
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Validation Aspects Types
 */
export interface ValidationAspect {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  severity: 'error' | 'warning' | 'info';
  issueCount?: number;
}

export interface ValidationAspectsData {
  aspects: ValidationAspect[];
  totalEnabled: number;
  totalAspects: number;
}

/**
 * Dashboard Layout Types
 */
export interface DashboardLayout {
  sidebarCollapsed: boolean;
  widgetOrder: string[];
  customLayout: boolean;
  breakpoint: 'mobile' | 'tablet' | 'desktop';
}

export interface DashboardState {
  layout: DashboardLayout;
  alerts: AlertSummary;
  validation: ValidationStatus;
  server: {
    connected: boolean;
    name: string;
    version: string;
    lastUpdated: Date;
  };
  ui: {
    loading: boolean;
    error: string | null;
    theme: 'light' | 'dark';
  };
}

/**
 * Data Wiring Types
 */
export interface DataAdapter<TInput, TOutput> {
  transform: (input: TInput) => TOutput;
  validate: (input: TInput) => boolean;
  getDefaultValue: () => TOutput;
}

export interface DataWiringConfig {
  pollingInterval: number;
  retryAttempts: number;
  staleTime: number;
  enabled: boolean;
}

/**
 * Responsive Layout Types
 */
export interface BreakpointConfig {
  mobile: number; // 320px
  tablet: number; // 768px
  desktop: number; // 1200px
}

export interface ResponsiveLayout {
  currentBreakpoint: 'mobile' | 'tablet' | 'desktop';
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  columns: number;
}

/**
 * Component Props Types
 */
export interface DashboardHeaderProps {
  serverName: string;
  serverVersion: string;
  connected: boolean;
  lastUpdated: Date;
  totalResources: number;
  onSettingsClick: () => void;
  onUserMenuClick: () => void;
}

export interface DashboardSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  quickAccessItems: QuickAccessItem[];
  navigationItems: NavigationItem[];
}

export interface QuickAccessItem {
  id: string;
  label: string;
  resourceType: string;
  count: number;
  href: string;
}

export interface NavigationItem {
  id: string;
  label: string;
  icon: React.ComponentType;
  href: string;
  active: boolean;
}

/**
 * Error Boundary Types
 */
export interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error: Error; resetError: () => void }>;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

/**
 * Loading Skeleton Types
 */
export interface LoadingSkeletonProps {
  type: 'card' | 'text' | 'circle' | 'rect';
  width?: number | string;
  height?: number | string;
  className?: string;
  animated?: boolean;
}

/**
 * Dashboard Grid Types
 */
export interface DashboardGridProps {
  children: React.ReactNode;
  columns: number;
  gap?: number;
  className?: string;
}

export interface GridItemProps {
  children: React.ReactNode;
  span?: number;
  className?: string;
}

/**
 * Data Freshness Types
 */
export interface DataFreshness {
  lastUpdated: Date;
  isStale: boolean;
  staleThreshold: number; // milliseconds
  pollingInterval: number; // milliseconds
}

/**
 * Mobile Navigation Types
 */
export interface MobileNavigationProps {
  isOpen: boolean;
  onClose: () => void;
  navigationItems: NavigationItem[];
  quickAccessItems: QuickAccessItem[];
}

/**
 * Touch Interaction Types
 */
export interface TouchInteraction {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  onTap?: () => void;
  onLongPress?: () => void;
}

/**
 * Accessibility Types
 */
export interface AccessibilityProps {
  ariaLabel?: string;
  ariaDescription?: string;
  role?: string;
  tabIndex?: number;
  keyboardShortcuts?: KeyboardShortcut[];
}

export interface KeyboardShortcut {
  key: string;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  action: () => void;
  description: string;
}

/**
 * Performance Types
 */
export interface PerformanceMetrics {
  renderTime: number;
  updateTime: number;
  memoryUsage: number;
  lastMeasurement: Date;
}

/**
 * Export all types for easy importing
 */
export type {
  Alert,
  AlertAction,
  AlertSummary,
  WidgetProps,
  WidgetState,
  OverviewMetrics,
  ValidationStatus,
  TrendData,
  TrendMetrics,
  ResourceTypeData,
  ResourceBreakdownData,
  ValidationControlState,
  ValidationControlActions,
  ProgressBarProps,
  ValidationAspect,
  ValidationAspectsData,
  DashboardLayout,
  DashboardState,
  DataAdapter,
  DataWiringConfig,
  BreakpointConfig,
  ResponsiveLayout,
  DashboardHeaderProps,
  DashboardSidebarProps,
  QuickAccessItem,
  NavigationItem,
  ErrorBoundaryState,
  ErrorBoundaryProps,
  LoadingSkeletonProps,
  DashboardGridProps,
  GridItemProps,
  DataFreshness,
  MobileNavigationProps,
  TouchInteraction,
  AccessibilityProps,
  KeyboardShortcut,
  PerformanceMetrics,
};
