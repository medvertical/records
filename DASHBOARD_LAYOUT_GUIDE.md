# Dashboard Layout Guide

## Visual Structure

```
┌────────────────────────────────────────────────────────────────────────┐
│                         DASHBOARD HEADER                                │
│                    (max-width: 1600px, centered)                        │
└────────────────────────────────────────────────────────────────────────┘

┌─────────────────────┬─────────────────────┬─────────────────────┬──────┐
│   Total Resources   │  Validation Coverage│      Errors         │ Warn │  ← 4 Metric Cards
│      50,000         │        75.5%        │        150          │  25  │    (grid: 1-2-4 cols)
│   From FHIR server  │  Resources validated│ Validation errors   │ Valid│
└─────────────────────┴─────────────────────┴─────────────────────┴──────┘

┌────────────────────────────────────────────────────────────────────────┐
│              BATCH VALIDATION CONTROL WIDGET (Full Width)              │
│                                                                         │
│  [IDLE STATE] ──────────────────────────────────────────────────────  │
│                                                                         │
│  Batch Validation Control                                              │
│  Last validation run: 2 hours ago                                      │
│                                                                         │
│  Select Resource Types                                                 │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │ [Select resource types... ▼]                                     │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│  [Patient (5000)] [Observation (10000)] [Encounter (2500)] [x]        │
│                                                                         │
│  ▼ Advanced Options                                                    │
│    Batch Size: 10 resources    [═══════○════]                         │
│    Max Concurrency: 5          [════○═══════]                         │
│    ☑ Structural  ☑ Profile  ☐ Terminology                            │
│    ☐ Reference   ☐ Business  ☐ Metadata                              │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │             ▶ Start Batch Validation                             │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  Recent Batch Runs                                                     │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │ Start Time │ Duration │ Resource Types │ Status    │ Results    │  │
│  │ 2h ago     │ 5m 30s   │ Patient +2     │ Completed │ 5000/5000 │  │
│  └─────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────┐
│              BATCH VALIDATION CONTROL WIDGET (Full Width)              │
│                                                                         │
│  [RUNNING STATE] ───────────────────────────────────────────────────  │
│                                                                         │
│  Batch Validation in Progress                    [Running]            │
│  Job ID: validation_1729344000_abc123                                 │
│                                                                         │
│  Overall Progress                                          65%        │
│  [████████████████████████████░░░░░░░░░░░░]                          │
│  6,500 / 10,000 resources               Current: Patient             │
│                                                                         │
│  ┌──────────────────┬──────────────────┬──────────────────┐          │
│  │ ✓ Valid          │ ✗ Errors         │ ⚠ Warnings       │          │
│  │   6,350          │     100          │      50          │          │
│  └──────────────────┴──────────────────┴──────────────────┘          │
│                                                                         │
│  Processing Rate: 125.5 resources/min | Est. Time: 3m 30s            │
│                                                                         │
│  Progress by Resource Type:                                           │
│  Patient      [████████████████████░░░] 3200/4000                    │
│               15 errors, 25 warnings                                  │
│  Observation  [██████████░░░░░░░░░░░░] 2500/5000                    │
│               50 errors, 15 warnings                                  │
│  Encounter    [████████░░░░░░░░░░░░░░] 800/1000                     │
│               10 errors, 5 warnings                                   │
│                                                                         │
│  ┌──────────────────────┬────────────────────────────────────┐       │
│  │  ⏸ Pause / ▶ Resume │             ⏹ Stop                │       │
│  └──────────────────────┴────────────────────────────────────┘       │
│                                                                         │
│  ▼ Live Activity Log                                                  │
│     Processing Patient...                                             │
│     6500 of 10000 resources validated                                │
│     Running at 125.5 resources/minute                                │
└────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────┬─────────────────────────────────┐
│  Resources by Type                   │  Valid vs Invalid Chart         │
│                                      │                                 │
│  Resource Type  │ Count    │ %      │  ┌────────────────────────────┐│
│  ─────────────────────────────────── │  │                            ││
│  Patient        │ 5,000    │ 33.3%  │  │ █████  Patient             ││
│  Observation    │ 10,000   │ 66.7%  │  │ ██████████  Observation    ││
│  Encounter      │ 2,500    │ 16.7%  │  │ ███  Encounter             ││
│  ...            │ ...      │ ...    │  │ ▓▓ Errors  ░░ Warnings     ││
│                                      │  └────────────────────────────┘│
│  Total: 15,000 resources             │  Total: 14,850 Valid           │
└──────────────────────────────────────┴─────────────────────────────────┘
```

## Responsive Breakpoints

### Mobile (< 768px)
```
┌──────────────────┐
│ Total Resources  │
├──────────────────┤
│ Validation Cov.  │
├──────────────────┤
│ Errors           │
├──────────────────┤
│ Warnings         │
├──────────────────┤
│ Batch Control    │
│ (Full Width)     │
├──────────────────┤
│ Resources by     │
│ Type             │
├──────────────────┤
│ Validation       │
│ Chart            │
└──────────────────┘
```

### Tablet (768px - 1023px)
```
┌─────────────┬─────────────┐
│ Total Res.  │ Valid. Cov. │
├─────────────┼─────────────┤
│ Errors      │ Warnings    │
├─────────────┴─────────────┤
│   Batch Control Widget    │
├─────────────┬─────────────┤
│ Resources   │ Validation  │
│ by Type     │ Chart       │
└─────────────┴─────────────┘
```

### Desktop (1024px+)
```
┌──────┬──────┬──────┬──────┐
│Total │Valid.│Errors│Warns │
├──────┴──────┴──────┴──────┤
│  Batch Validation Control  │
├──────────────┬─────────────┤
│ Resources    │ Validation  │
│ by Type      │ Chart       │
└──────────────┴─────────────┘
```

## Component Hierarchy

```
Dashboard
├── MetricCard (x4)
│   ├── Total Resources
│   ├── Validation Coverage
│   ├── Errors
│   └── Warnings
├── Batch Control Widget (conditional render)
│   ├── BatchControlIdleWidget
│   │   ├── ResourceTypeMultiSelect
│   │   │   └── Command + Popover
│   │   ├── Advanced Options (collapsible)
│   │   │   ├── Batch Size Slider
│   │   │   ├── Max Concurrency Slider
│   │   │   └── Validation Aspects Checkboxes
│   │   ├── Start Button
│   │   └── BatchHistoryTable
│   │       └── Table with recent runs
│   └── BatchControlRunningWidget
│       ├── Progress Bar
│       ├── Statistics Cards (x3)
│       ├── Performance Metrics
│       ├── Per-Type Progress Bars
│       ├── Control Buttons (Pause/Resume, Stop)
│       └── Live Activity Log (collapsible)
├── ResourcesByTypeCard
│   └── Table with resource counts
└── ValidationStatusChartCard
    ├── Bar Chart (Recharts)
    └── Total Summary
```

## Color Scheme

### Metric Cards
- **Default**: `bg-card` with standard text
- **Success**: Green tint (`bg-green-50 dark:bg-green-950`)
- **Warning**: Yellow tint (`bg-yellow-50 dark:bg-yellow-950`)
- **Error**: Red tint (`bg-red-50 dark:bg-red-950`)

### Status Badges
- **Running**: Default blue
- **Paused**: Secondary gray
- **Completed**: Green with checkmark
- **Stopped**: Gray with stop icon
- **Error**: Destructive red with X

### Chart Colors
- **Valid**: Green (`hsl(142, 76%, 36%)`)
- **Errors**: Red (`hsl(0, 84%, 60%)`)
- **Warnings**: Yellow (`hsl(48, 96%, 53%)`)

## Interactive States

### Idle State → Running State Transition
1. User selects resource types
2. User clicks "Start Batch Validation"
3. `POST /api/validation/bulk/start` is called
4. `mode` changes from 'idle' to 'running'
5. Widget smoothly transitions to running state
6. Polling begins (every 2s)

### Running State → Idle State Transition
1. Validation completes or user stops
2. `mode` changes from 'running' to 'idle'
3. Widget transitions back to idle state
4. Batch history is refreshed
5. Dashboard metrics are updated
6. Polling stops

## Data Flow

```
User Action (Select Types, Start Batch)
         ↓
useDashboardBatchState Hook
         ↓
POST /api/validation/bulk/start
         ↓
Backend starts validation
         ↓
Polling (every 2s)
         ↓
GET /api/validation/bulk/progress
         ↓
Update BatchControlRunningWidget
         ↓
Update MetricCards (real-time)
         ↓
Completion detected
         ↓
Refresh history + metrics
         ↓
Return to idle state
```

## Key UX Considerations

1. **Loading States**: All cards show skeleton loaders while fetching data
2. **Error Handling**: Each section wrapped in ErrorBoundary
3. **Responsive Grid**: Automatically adjusts to screen size
4. **Smooth Transitions**: Widget state changes are animated
5. **Confirmation Dialogs**: Stop action requires confirmation
6. **Real-time Feedback**: Progress updates every 2 seconds
7. **Accessibility**: Proper ARIA labels and keyboard navigation
8. **Performance**: Efficient polling with automatic stop when idle

