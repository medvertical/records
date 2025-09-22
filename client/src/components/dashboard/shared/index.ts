// Dashboard Shared Components - Single responsibility: Export shared dashboard components
// Follows global rules: Simple exports, no custom logic, single responsibility

export { Widget, WidgetHeader, WidgetContent, WidgetFooter } from './Widget';
export { 
  LoadingSkeleton, 
  WidgetSkeleton, 
  ChartSkeleton, 
  ProgressSkeleton, 
  ListSkeleton, 
  GridSkeleton 
} from './LoadingSkeleton';
export { 
  DashboardErrorBoundary, 
  SimpleErrorFallback, 
  CompactErrorFallback, 
  withDashboardErrorBoundary 
} from './ErrorBoundary';

// Import CSS for global dashboard styles
import '../dashboard.css';
