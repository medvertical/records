// Dashboard Widget Components - Single responsibility: Export widget components
// Follows global rules: Simple exports, no custom logic, single responsibility

// Base components for standardization
export { BaseDashboardCard, LoadingCard, ErrorCard } from './BaseDashboardCard';

// Clean widget components (renamed from WiredWireframe for better naming)
export { AlertCard } from './AlertCard';
export { OverviewCard } from './OverviewCard';
export { StatusCard } from './StatusCard';
export { TrendsCard } from './TrendsCard';
export { ResourceBreakdownCard } from './ResourceBreakdownCard';

// Legacy exports for backward compatibility (deprecated)
export { WiredWireframeAlertCard } from './WiredWireframeAlertCard';
export { WiredWireframeOverviewCard } from './WiredWireframeOverviewCard';
export { WiredWireframeStatusCard } from './WiredWireframeStatusCard';
export { WiredWireframeTrendsCard } from './WiredWireframeTrendsCard';
export { WiredWireframeResourceBreakdownCard } from './WiredWireframeResourceBreakdownCard';
