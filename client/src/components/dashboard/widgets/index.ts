// Dashboard Widget Components - Single responsibility: Export widget components
// Follows global rules: Simple exports, no custom logic, single responsibility

// Base widget components
export { AlertCard, AlertSummaryDisplay } from './AlertCard';
export { OverviewCard, CompactOverview } from './OverviewCard';
export { StatusCard, CompactStatus } from './StatusCard';
export { TrendsCard, CompactTrends } from './TrendsCard';
export { ResourceBreakdownCard, CompactResourceBreakdown } from './ResourceBreakdownCard';

// Wired widget components (connected to real data)
export { default as WiredAlertCard } from './WiredAlertCard';
export { default as WiredOverviewCard } from './WiredOverviewCard';
export { default as WiredStatusCard } from './WiredStatusCard';
export { default as WiredTrendsCard } from './WiredTrendsCard';
export { default as WiredResourceBreakdownCard } from './WiredResourceBreakdownCard';

// Modern wired widget components (new design)
export { WiredModernAlertCard } from './WiredModernAlertCard';
export { WiredModernOverviewCard } from './WiredModernOverviewCard';
export { WiredModernStatusCard } from './WiredModernStatusCard';
export { WiredModernTrendsCard } from './WiredModernTrendsCard';
export { WiredModernResourceBreakdownCard } from './WiredModernResourceBreakdownCard';
