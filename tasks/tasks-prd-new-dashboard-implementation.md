# Task List: New Dashboard Implementation

**Based on:** `prd-new-dashboard-implementation.md` and `dashboard-wireframes.md`  
**Generated:** January 2025  
**Target Audience:** Junior Developer

---

## Relevant Files

- `client/src/components/dashboard/layout/DashboardHeader.tsx` - New header component with server status and user menu
- `client/src/components/dashboard/layout/DashboardGrid.tsx` - Responsive grid layout system using CSS Grid
- `client/src/components/dashboard/layout/DashboardSidebar.tsx` - Collapsible navigation sidebar for mobile/desktop
- `client/src/components/dashboard/widgets/AlertCard.tsx` - Alert system with severity categorization and expandable details
- `client/src/components/dashboard/widgets/OverviewCard.tsx` - Key metrics display with real-time updates
- `client/src/components/dashboard/widgets/StatusCard.tsx` - Validation engine status with progress indicators
- `client/src/components/dashboard/widgets/TrendsCard.tsx` - Historical trend analysis with interactive charts
- `client/src/components/dashboard/widgets/ResourceBreakdownCard.tsx` - Resource type distribution with click-through functionality
- `client/src/components/dashboard/controls/ValidationControlPanel.tsx` - Main validation engine control interface
- `client/src/components/dashboard/controls/ProgressBar.tsx` - Animated progress indicators with smooth transitions
- `client/src/components/dashboard/controls/ValidationAspectsPanel.tsx` - Validation configuration interface
- `client/src/components/dashboard/shared/Widget.tsx` - Base widget component with consistent styling and behavior
- `client/src/components/dashboard/shared/LoadingSkeleton.tsx` - Loading state components for better perceived performance
- `client/src/components/dashboard/shared/ErrorBoundary.tsx` - Error handling wrapper for dashboard components
- `client/src/pages/Dashboard.tsx` - New dashboard page component replacing the existing monolithic Dashboard.tsx
- `client/src/hooks/use-dashboard-state.ts` - State management hook for dashboard layout and preferences
- `client/src/hooks/use-dashboard-alerts.ts` - Alert management hook with real-time updates
- `client/src/hooks/use-responsive-layout.ts` - Responsive layout management hook
- `client/src/hooks/use-dashboard-data-wiring.ts` - Hook for wiring dashboard components to real data sources
- `client/src/lib/dashboard-data-adapters.ts` - Data transformation utilities for dashboard components
- `server/api/dashboard/server-status.ts` - API endpoint for server status information
- `server/api/dashboard/validation-progress.ts` - API endpoint for real-time validation progress
- `server/api/dashboard/alerts.ts` - API endpoint for alert system data
- `server/api/dashboard/resource-breakdown.ts` - API endpoint for resource analytics
- `server/api/dashboard/validation-controls.ts` - API endpoints for validation engine controls
- `shared/types/dashboard-new.ts` - TypeScript interfaces for new dashboard components
- `client/src/components/dashboard/layout/DashboardHeader.test.tsx` - Unit tests for header component
- `client/src/components/dashboard/widgets/AlertCard.test.tsx` - Unit tests for alert card component
- `client/src/components/dashboard/controls/ValidationControlPanel.test.tsx` - Unit tests for control panel
- `client/src/hooks/use-dashboard-state.test.ts` - Unit tests for dashboard state management

### Notes

- Unit tests should be placed alongside the code files they are testing (e.g., `DashboardHeader.tsx` and `DashboardHeader.test.tsx` in the same directory)
- Use `npx jest [optional/path/to/test/file]` to run tests. Running without a path executes all tests found by the Jest configuration
- The new dashboard will replace the existing dashboard implementation, with backup/rollback capability
- Existing hooks like `use-dashboard-data.ts` and `use-validation-polling.ts` can be leveraged but may need modifications

### Global Development Rules Applied

- **File Length Limits**: Break components when they approach 400 lines, never exceed 500 lines
- **Modular Design**: Build interchangeable, testable, isolated modules - each component handles one concern
- **Reuse Existing Patterns**: Prefer existing UI components (Card, Badge, Button, Progress) and Tailwind utilities
- **Simple Solutions**: Avoid over-engineering - use existing patterns before creating new ones
- **Root Cause Focus**: Fix problems at the source, not just symptoms

### MVP Implementation Guidelines

- **Follow wireframe layouts**: Desktop (4-column grid), Tablet (2-column), Mobile (single column stack)
- **Use existing UI components**: Leverage existing Card, Badge, Button, Progress components from shadcn/ui
- **Use existing Tailwind classes**: Don't create custom design system, use existing color and spacing utilities
- **Keep animations simple**: Use existing transition classes, avoid complex custom animations
- **Follow existing responsive patterns**: Use existing breakpoint patterns in the codebase
- **Small, focused components**: Each widget should be under 300 lines, split larger components

### Data Wiring Strategy

- **Leverage existing data sources**: Connect new components to existing `use-dashboard-data.ts`, `use-validation-polling.ts`, and `use-server-data.ts` hooks
- **Create data adapters**: Transform existing API responses to match new widget data requirements
- **Maintain real-time updates**: Use existing polling mechanisms while adding new data transformation layers
- **Preserve existing functionality**: Ensure all current dashboard features continue working during migration
- **Single responsibility**: Each data adapter handles one specific transformation concern

## Tasks

- [x] 1.0 Set up new dashboard architecture (MVP scope)
  - [x] 1.1 Create new dashboard component directory structure following wireframe specifications
  - [x] 1.2 Create TypeScript interfaces for new dashboard components in `shared/types/dashboard-new.ts` (keep under 300 lines)
  - [x] 1.3 Implement base Widget component using existing UI components (Card, Badge, Button) - single responsibility
  - [x] 1.4 Create simple LoadingSkeleton component using existing skeleton patterns (under 200 lines)
  - [x] 1.5 Implement basic ErrorBoundary component for error handling (focused on dashboard errors only)
  - [x] 1.6 Set up basic dashboard CSS using existing Tailwind classes and patterns (no custom design system)

- [ ] 2.0 Implement responsive layout system and base components
  - [ ] 2.1 Create DashboardGrid component with CSS Grid responsive layout system (under 300 lines)
  - [ ] 2.2 Implement responsive breakpoints using existing Tailwind patterns (desktop 1200px+, tablet 768px-1199px, mobile 320px-767px)
  - [ ] 2.3 Build DashboardHeader component with server status and user menu (single responsibility, under 400 lines)
  - [ ] 2.4 Create DashboardSidebar component with collapsible navigation (separate concerns for mobile/desktop)
  - [ ] 2.5 Implement mobile navigation drawer as separate component (under 200 lines)
  - [ ] 2.6 Wire DashboardHeader to real server status data from existing server connection hooks
  - [ ] 2.7 Wire DashboardSidebar to real server data and resource counts for quick access
  - [ ] 2.8 Add responsive layout management hook for breakpoint detection (reuse existing patterns)
  - [ ] 2.9 Create dashboard state management hook for layout preferences (focused on layout only)

- [ ] 3.0 Build core dashboard widgets with real-time data integration
  - [ ] 3.1 Implement AlertCard component with severity categorization (single responsibility, under 300 lines)
  - [ ] 3.2 Create OverviewCard component displaying key metrics (focused on overview data only, under 250 lines)
  - [ ] 3.3 Build StatusCard component showing validation engine status (separate from progress details, under 200 lines)
  - [ ] 3.4 Implement TrendsCard component with historical trend analysis (reuse existing chart components, under 300 lines)
  - [ ] 3.5 Create ResourceBreakdownCard component with resource type distribution (under 250 lines)
  - [ ] 3.6 Wire AlertCard to real alert data from existing validation system and server health monitoring
  - [ ] 3.7 Wire OverviewCard to real FHIR server stats and validation metrics from use-dashboard-data hook
  - [ ] 3.8 Wire StatusCard to real validation progress data from use-validation-polling hook
  - [ ] 3.9 Wire TrendsCard to historical validation data and performance metrics
  - [ ] 3.10 Wire ResourceBreakdownCard to real resource type counts and validation results
  - [ ] 3.11 Create focused data transformation utilities (one adapter per data type, under 200 lines each)
  - [ ] 3.12 Implement real-time data synchronization using existing polling patterns

- [ ] 4.0 Create validation control panel and progress tracking
  - [ ] 4.1 Implement ValidationControlPanel component with validation engine controls following wireframe layout
  - [ ] 4.2 Create ProgressBar component with smooth animated transitions matching wireframe specifications
  - [ ] 4.3 Build ValidationAspectsPanel component for validation configuration per wireframe design
  - [ ] 4.4 Add validation control buttons (Start, Pause, Resume, Stop, Settings) with wireframe styling
  - [ ] 4.5 Wire validation controls to real validation engine API endpoints (start, pause, resume, stop)
  - [ ] 4.6 Wire progress tracking to real validation progress data with ETA calculations
  - [ ] 4.7 Wire current activity display to real resource type and processing rate data
  - [ ] 4.8 Integrate with existing validation polling system for live updates and state synchronization
  - [ ] 4.9 Create data adapters to transform validation API responses to control panel format

- [ ] 5.0 Implement mobile responsiveness and basic accessibility (MVP scope)
  - [ ] 5.1 Add touch-optimized interactions for mobile devices (44px+ touch targets)
  - [ ] 5.2 Implement basic mobile navigation with collapsible sidebar
  - [ ] 5.3 Add basic keyboard navigation support with logical tab order
  - [ ] 5.4 Implement basic ARIA labels and semantic HTML structure
  - [ ] 5.5 Add basic screen reader support for key interactive elements

- [ ] 6.0 Add basic performance optimizations and error handling (MVP scope)
  - [ ] 6.1 Implement basic React.memo optimizations for expensive components
  - [ ] 6.2 Add basic error handling with user-friendly messages
  - [ ] 6.3 Implement basic loading states and error boundaries
  - [ ] 6.4 Add basic debouncing for rapid state updates

- [ ] 7.0 Create basic test suite (MVP scope)
  - [ ] 7.1 Write unit tests for core dashboard components (AlertCard, OverviewCard, StatusCard)
  - [ ] 7.2 Write unit tests for validation control panel
  - [ ] 7.3 Add basic integration tests for data flow
  - [ ] 7.4 Write basic component documentation

- [ ] 8.0 Wire dashboard components to real data sources and existing systems
  - [ ] 8.1 Create data wiring hook (use-dashboard-data-wiring.ts) to connect components to existing APIs
  - [ ] 8.2 Wire AlertCard to real validation errors, server health alerts, and system notifications
  - [ ] 8.3 Wire OverviewCard to real FHIR server statistics and validation metrics from existing endpoints
  - [ ] 8.4 Wire StatusCard to real validation progress and engine status from use-validation-polling
  - [ ] 8.5 Wire TrendsCard to historical validation data and performance trends from database
  - [ ] 8.6 Wire ResourceBreakdownCard to real resource type counts and validation results
  - [ ] 8.7 Wire ValidationControlPanel to existing validation API endpoints (/api/validation/bulk/*)
  - [ ] 8.8 Wire DashboardHeader to real server connection status and last updated timestamps
  - [ ] 8.9 Wire DashboardSidebar to real server data and resource counts for quick access
  - [ ] 8.10 Create data transformation layer to convert existing API responses to widget format
  - [ ] 8.11 Implement real-time data synchronization between existing hooks and new components
  - [ ] 8.12 Add error handling and fallback data for when real data sources are unavailable

- [ ] 9.0 Deploy and integrate with existing dashboard system (MVP scope)
  - [ ] 9.1 Replace existing Dashboard.tsx with new modular dashboard implementation
  - [ ] 9.2 Update routing configuration to use new dashboard
  - [ ] 9.3 Implement backup/rollback mechanism for existing dashboard
  - [ ] 9.4 Add basic monitoring for new dashboard usage
