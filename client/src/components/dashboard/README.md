# Dashboard Components Documentation

This directory contains the new modular dashboard components for the Records FHIR validation platform. The components follow a consistent architecture with proper separation of concerns, performance optimizations, and accessibility features.

## Architecture Overview

The dashboard is built using a modular widget-based architecture with the following structure:

```
dashboard/
├── shared/           # Shared components and utilities
├── widgets/          # Dashboard widget components
├── controls/         # Validation control components
├── layout/           # Layout and navigation components
└── dashboard.css     # Global dashboard styles
```

## Component Categories

### 1. Shared Components (`shared/`)

#### `Widget.tsx`
Base component for all dashboard widgets providing consistent styling, error handling, and loading states.

**Features:**
- Consistent card-based layout
- Error boundary integration
- Loading skeleton support
- Refresh functionality
- Accessibility attributes

**Usage:**
```tsx
<Widget
  title="My Widget"
  subtitle="Widget description"
  loading={isLoading}
  error={error}
  onRefresh={handleRefresh}
>
  {/* Widget content */}
</Widget>
```

#### `LoadingSkeleton.tsx`
Provides loading states for dashboard components with various skeleton patterns.

**Types:**
- `card` - Standard card layout
- `text` - Text content
- `chart` - Chart components
- `validation-control` - Validation control panel
- `resource-breakdown` - Resource breakdown list

#### `ErrorBoundary.tsx`
React Error Boundary component for graceful error handling in dashboard widgets.

### 2. Widget Components (`widgets/`)

#### `AlertCard.tsx`
Displays system alerts with severity categorization and expandable details.

**Props:**
- `alerts: Alert[]` - Array of alert objects
- `summary: AlertSummary` - Alert summary statistics
- `loading: boolean` - Loading state
- `error: string | null` - Error state
- `onRefresh: () => void` - Refresh callback

**Features:**
- Severity-based color coding (critical, warning, info)
- Expandable alert details
- Alert dismissal functionality
- Real-time updates

#### `OverviewCard.tsx`
Shows key FHIR server metrics and validation statistics.

**Props:**
- `metrics: OverviewMetrics` - Overview metrics data
- `loading: boolean` - Loading state
- `error: string | null` - Error state
- `onRefresh: () => void` - Refresh callback

**Features:**
- Total and validated resource counts
- Success rate with color-coded badges
- Validation coverage progress
- Last updated timestamp

#### `StatusCard.tsx`
Displays real-time validation engine status and progress.

**Props:**
- `status: ValidationStatus` - Validation status data
- `loading: boolean` - Loading state
- `error: string | null` - Error state
- `onRefresh: () => void` - Refresh callback

**Features:**
- Status indicators (running, paused, completed, error, idle)
- Progress bar with percentage
- Current activity display
- Processing rate and ETA

#### `TrendsCard.tsx`
Shows historical trend analysis with interactive charts.

**Props:**
- `trends: TrendData[]` - Historical trend data
- `metrics: TrendMetrics` - Trend metrics
- `loading: boolean` - Loading state
- `error: string | null` - Error state
- `onRefresh: () => void` - Refresh callback

**Features:**
- Interactive line charts using Recharts
- Trend direction indicators
- Historical performance analysis
- Export functionality

#### `ResourceBreakdownCard.tsx`
Displays FHIR resource type distribution with validation statistics.

**Props:**
- `data: ResourceBreakdownData` - Resource breakdown data
- `loading: boolean` - Loading state
- `error: string | null` - Error state
- `onRefresh: () => void` - Refresh callback
- `onResourceTypeClick: (type: string) => void` - Resource type click callback

**Features:**
- Resource type distribution charts
- Validation statistics per resource type
- Click-through to detailed views
- Progress indicators

### 3. Control Components (`controls/`)

#### `ValidationControlPanel.tsx`
Main validation engine control interface with progress tracking.

**Props:**
- `status: ValidationStatus` - Current validation status
- `loading: boolean` - Loading state
- `error: string | null` - Error state
- `onStart: () => void` - Start validation callback
- `onPause: () => void` - Pause validation callback
- `onResume: () => void` - Resume validation callback
- `onStop: () => void` - Stop validation callback
- `onRevalidateAll: () => void` - Revalidate all callback
- `onSettings: () => void` - Settings callback

**Features:**
- Validation engine controls (start, pause, resume, stop)
- Real-time progress tracking
- Current activity display
- ETA calculations
- Keyboard navigation support

#### `ProgressBar.tsx`
Animated progress indicators with smooth transitions.

**Props:**
- `value: number` - Progress value (0-100)
- `max: number` - Maximum value (default: 100)
- `size: 'sm' | 'md' | 'lg'` - Size variant
- `color: 'default' | 'success' | 'warning' | 'error'` - Color variant
- `animated: boolean` - Enable animations
- `label?: string` - Progress label

**Features:**
- Smooth animations
- Multiple size and color variants
- Accessibility support with ARIA attributes
- Customizable styling

#### `ValidationAspectsPanel.tsx`
Configuration interface for validation aspects.

**Props:**
- `aspects: ValidationAspect[]` - Available validation aspects
- `loading: boolean` - Loading state
- `onAspectToggle: (aspectId: string, enabled: boolean) => void` - Toggle callback

**Features:**
- Toggle validation aspects on/off
- Aspect descriptions and status
- Bulk enable/disable functionality
- Real-time configuration updates

### 4. Layout Components (`layout/`)

#### `DashboardGrid.tsx`
Responsive CSS Grid layout system for dashboard widgets.

**Features:**
- CSS Grid-based responsive layout
- Breakpoint-specific configurations
- Widget positioning and sizing
- Layout persistence

#### `DashboardHeader.tsx`
Dashboard header with server status and user menu.

**Features:**
- Server connection status
- Last updated timestamp
- User menu and settings
- Compact mobile version

#### `DashboardSidebar.tsx`
Collapsible navigation sidebar for desktop and mobile.

**Features:**
- Navigation menu items
- Quick access links
- Server information
- Collapsible on mobile

#### `MobileNavigationDrawer.tsx`
Slide-out navigation drawer for mobile devices.

**Features:**
- Touch-optimized interactions
- Smooth slide animations
- Full navigation menu
- Backdrop overlay

## Data Integration

### Data Wiring Hook

The `useDashboardDataWiring` hook connects all dashboard components to real data sources:

```tsx
const {
  // Alert data
  alerts,
  alertSummary,
  
  // Overview data
  overviewMetrics,
  
  // Status data
  validationStatus,
  
  // Trends data
  trendsData,
  trendMetrics,
  
  // Resource breakdown data
  resourceBreakdownData,
  
  // Server data
  serverStatus,
  
  // Global state
  isLoading,
  hasErrors,
  lastUpdated,
  
  // Refresh functions
  refreshAlerts,
  refreshOverview,
  refreshStatus,
  refreshTrends,
  refreshResourceBreakdown,
  refreshAll,
} = useDashboardDataWiring();
```

### Data Adapters

Data transformation utilities convert API responses to component-friendly formats:

- `AlertDataAdapter` - Transforms validation errors and server alerts
- `OverviewDataAdapter` - Transforms dashboard metrics
- `StatusDataAdapter` - Transforms validation status
- `TrendsDataAdapter` - Transforms historical trend data
- `ResourceBreakdownDataAdapter` - Transforms resource type data

## Performance Optimizations

### React.memo Optimizations
All expensive components are wrapped with `React.memo` and custom comparison functions:

```tsx
export const TrendsCard = memo(TrendsCardComponent, (prevProps, nextProps) => {
  // Custom comparison logic
  return dashboardOptimizations.alertDataEqual(prevProps.trends, nextProps.trends);
});
```

### Debouncing and Throttling
- Debounced values for rapid state updates (500ms for validation, 300ms for server)
- Throttled refresh functions to prevent API spam
- Stable object references to prevent unnecessary re-renders

### Loading States
- Skeleton loading patterns for better perceived performance
- Progressive loading for complex components
- Error boundaries with graceful fallbacks

## Accessibility Features

### ARIA Support
- Proper ARIA labels and descriptions
- Role attributes for semantic structure
- Live regions for real-time updates
- Screen reader support for all interactive elements

### Keyboard Navigation
- Logical tab order
- Arrow key navigation for widgets
- Keyboard shortcuts for validation controls
- Focus management and indicators

### Touch Optimization
- 44px+ touch targets for mobile devices
- Touch-optimized CSS classes
- Swipe gestures for navigation
- Prevent zoom on input focus

## Usage Examples

### Basic Widget Implementation
```tsx
import { AlertCard } from '@/components/dashboard/widgets/AlertCard';

function MyDashboard() {
  const { alerts, alertSummary, refreshAlerts } = useDashboardDataWiring();
  
  return (
    <AlertCard
      alerts={alerts}
      summary={alertSummary}
      onRefresh={refreshAlerts}
    />
  );
}
```

### Custom Widget with Error Boundary
```tsx
import { Widget } from '@/components/dashboard/shared/Widget';
import { DashboardErrorBoundary } from '@/components/dashboard/shared/ErrorBoundary';

function CustomWidget() {
  return (
    <DashboardErrorBoundary context="custom widget">
      <Widget title="Custom Widget" subtitle="My custom content">
        {/* Widget content */}
      </Widget>
    </DashboardErrorBoundary>
  );
}
```

### Responsive Layout
```tsx
import { ResponsiveDashboardGrid } from '@/components/dashboard/layout/DashboardGrid';

function Dashboard() {
  return (
    <ResponsiveDashboardGrid>
      <AlertCard />
      <OverviewCard />
      <StatusCard />
      <TrendsCard />
    </ResponsiveDashboardGrid>
  );
}
```

## Testing

### Unit Tests
Each component has comprehensive unit tests covering:
- Rendering with different props
- User interactions
- Error states
- Loading states
- Accessibility features

### Integration Tests
Data flow integration tests verify:
- Data transformation accuracy
- Hook integration
- Performance optimizations
- Error handling

### Running Tests
```bash
# Run all dashboard tests
npm test -- --testPathPattern=dashboard

# Run specific component tests
npm test -- AlertCard.test.tsx

# Run integration tests
npm test -- --testPathPattern=integration
```

## Global Development Rules

All components follow these rules:
- **File Length**: Components under 400-500 lines, functions under 30-40 lines
- **Single Responsibility**: Each component handles one specific concern
- **Modular Design**: Reusable, testable, isolated modules
- **Performance**: Optimized with React.memo, useMemo, useCallback
- **Accessibility**: WCAG 2.1 AA compliance
- **Error Handling**: Graceful error boundaries and user-friendly messages

## Migration from Old Dashboard

The new dashboard components are designed to replace the existing monolithic dashboard:

1. **Phase 1**: Deploy new components alongside existing dashboard
2. **Phase 2**: Gradually migrate users to new dashboard
3. **Phase 3**: Remove old dashboard implementation

### Backup and Rollback
- Existing dashboard is backed up before replacement
- Feature flags control which dashboard users see
- Rollback mechanism available if issues arise

## Future Enhancements

### Planned Features
- Drag-and-drop widget customization
- Advanced filtering and search
- Real-time WebSocket updates
- Advanced analytics and reporting
- Multi-tenant dashboard configurations

### Performance Improvements
- Virtual scrolling for large datasets
- Lazy loading of chart components
- Advanced caching strategies
- Bundle splitting for faster loads

## Support and Troubleshooting

### Common Issues
1. **Performance**: Check React.memo implementations and data dependencies
2. **Accessibility**: Verify ARIA attributes and keyboard navigation
3. **Data Loading**: Ensure proper error handling and loading states
4. **Mobile Issues**: Test touch interactions and responsive breakpoints

### Debugging
- Use React DevTools to inspect component renders
- Check browser console for accessibility warnings
- Monitor network requests for data loading issues
- Use performance monitoring hooks in development

For additional support, refer to the main project documentation or contact the development team.
