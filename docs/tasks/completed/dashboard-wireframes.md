# Dashboard Redesign - Wireframes & Layout Specifications

**Version:** v1.0  
**Date:** January 2025  
**Document Type:** Wireframes for Dashboard Redesign

---

## 1. Desktop Dashboard Layout (Primary View)

### 1.1 Header Section
```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ 🏥 Records Dashboard                                    🔄 Last updated: 2:34 PM │
│ FHIR Validation Platform                              ⚙️ Settings    👤 User     │
├─────────────────────────────────────────────────────────────────────────────────┤
│ Server: Production FHIR Server (R4) • Connected ✅ • 847,392 Resources          │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Main Dashboard Grid Layout
```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐ │
│  │   🚨 ALERTS     │  │   📊 OVERVIEW   │  │   ⚡ STATUS      │  │   📈 TRENDS │ │
│  │                 │  │                 │  │                 │  │             │ │
│  │ • 3 Critical    │  │ Total Resources │  │ Validation      │  │ Success Rate │ │
│  │ • 12 Warnings   │  │ 847,392         │  │ ● Running       │  │ ↗️ 94.2%     │ │
│  │ • 0 Errors      │  │ Validated       │  │ Progress: 67%   │  │ (↑ 2.1%)    │ │
│  │                 │  │ 567,234         │  │ ETA: 23 min     │  │             │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  └─────────────┘ │
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────────┐ │
│  │                        🎯 VALIDATION CONTROL PANEL                         │ │
│  │                                                                             │ │
│  │ ┌─────────────────────────────────────────────────────────────────────────┐ │ │
│  │ │ Progress: ████████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░ 67.3%        │ │ │
│  │ │ Currently: Patient • Next: Observation • Rate: 1,247/min               │ │ │
│  │ └─────────────────────────────────────────────────────────────────────────┘ │ │
│  │                                                                             │ │
│  │ [⏸️ Pause] [▶️ Resume] [⏹️ Stop] [⚙️ Settings] [📊 View Details]          │ │
│  └─────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                 │
│  ┌─────────────────────────────────────┐  ┌─────────────────────────────────────┐ │
│  │          📋 RESOURCE BREAKDOWN       │  │         🔍 VALIDATION ASPECTS       │ │
│  │                                     │  │                                     │ │
│  │ Patient        ████████████ 45.2%   │  │ Structural    ✅ Enabled           │ │
│  │ Observation    ████████░░░░ 32.1%   │  │ Profile       ✅ Enabled           │ │
│  │ Encounter      ██████░░░░░░ 18.7%   │  │ Terminology   ⚠️ Warning Mode      │ │
│  │ Condition      ████░░░░░░░░ 12.3%   │  │ Reference     ✅ Enabled           │ │
│  │ Medication     ███░░░░░░░░░ 8.9%    │  │ Business Rules ❌ Disabled          │ │
│  │ Diagnostic     ██░░░░░░░░░░ 6.2%    │  │ Metadata      ✅ Enabled           │ │
│  │ ...            █░░░░░░░░░░░ 4.1%    │  │                                     │ │
│  │                                     │  │ [⚙️ Configure Aspects]              │ │
│  └─────────────────────────────────────┘  └─────────────────────────────────────┘ │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 1.3 Sidebar Navigation (Collapsible)
```
┌─────────────┐
│ 📊 Dashboard│ ← Active
├─────────────┤
│ 🗃️ Resources│
├─────────────┤
│ 📦 Packages │
├─────────────┤
│ ⚙️ Settings │
├─────────────┤
│             │
│ Quick Access│
│ • Patients  │
│ • Obs       │
│ • Encounters│
│ • Conditions│
└─────────────┘
```

---

## 2. Mobile Dashboard Layout (Responsive)

### 2.1 Mobile Header (Collapsed)
```
┌─────────────────────────────────────┐
│ ☰ Records    🔄 2:34 PM    ⚙️ 👤    │
├─────────────────────────────────────┤
│ Server: Prod FHIR • ✅ • 847K       │
└─────────────────────────────────────┘
```

### 2.2 Mobile Dashboard Stack
```
┌─────────────────────────────────────┐
│ 🚨 3 Critical • 12 Warnings         │
│ [View All Alerts →]                 │
├─────────────────────────────────────┤
│ 📊 OVERVIEW                         │
│ Total: 847,392 • Validated: 567,234 │
│ Success Rate: 94.2% ↗️              │
├─────────────────────────────────────┤
│ ⚡ VALIDATION STATUS                │
│ ● Running • Progress: 67%           │
│ ETA: 23 minutes                     │
│ [⏸️ Pause] [⏹️ Stop]               │
├─────────────────────────────────────┤
│ 📈 TRENDS                           │
│ Success Rate: ↗️ 94.2% (↑ 2.1%)     │
│ [View Chart →]                      │
└─────────────────────────────────────┘
```

### 2.3 Mobile Navigation Drawer
```
┌─────────────────────────────────────┐
│ ☰ Records Dashboard                 │
├─────────────────────────────────────┤
│ 📊 Dashboard                        │
│ 🗃️ Resources                        │
│ 📦 Packages                         │
│ ⚙️ Settings                         │
├─────────────────────────────────────┤
│ Quick Access                        │
│ • Patients (45,234)                 │
│ • Observations (32,156)             │
│ • Encounters (18,743)               │
│ • Conditions (12,891)               │
└─────────────────────────────────────┘
```

---

## 3. Detailed Component Wireframes

### 3.1 Alert Card Component
```
┌─────────────────────────────────────┐
│ 🚨 ALERTS                    [⚙️]   │
├─────────────────────────────────────┤
│                                     │
│ 🔴 Critical (3)                     │
│ • Profile validation failing        │
│ • Terminology server timeout        │
│ • Reference integrity errors        │
│                                     │
│ 🟡 Warnings (12)                    │
│ • Missing metadata in 234 resources │
│ • Deprecated codes detected         │
│                                     │
│ 🟢 Info (0)                         │
│ • All systems operational           │
│                                     │
│ [View All Alerts →]                 │
└─────────────────────────────────────┘
```

### 3.2 Validation Control Panel
```
┌─────────────────────────────────────────────────────────────────┐
│ 🎯 VALIDATION ENGINE                                     [⚙️]   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ Status: ● Running                                    [⏸️] [⏹️]  │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Progress: ████████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │ │
│ │ 67.3% Complete • 567,234 / 847,392 Resources              │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ Currently Processing:                                           │
│ 🗃️ Patient Resources • Next: Observation • Rate: 1,247/min    │
│                                                                 │
│ Elapsed: 2h 34m • Remaining: 23m • Paused: 12m               │
│                                                                 │
│ [▶️ Resume] [⏸️ Pause] [⏹️ Stop] [🔄 Revalidate All]          │
└─────────────────────────────────────────────────────────────────┘
```

### 3.3 Resource Breakdown Chart
```
┌─────────────────────────────────────┐
│ 📋 RESOURCE BREAKDOWN        [📊]   │
├─────────────────────────────────────┤
│                                     │
│ Patient        ████████████ 45.2%   │
│ └─ 382,456 resources               │
│                                     │
│ Observation    ████████░░░░ 32.1%   │
│ └─ 271,234 resources               │
│                                     │
│ Encounter      ██████░░░░░░ 18.7%   │
│ └─ 158,743 resources               │
│                                     │
│ Condition      ████░░░░░░░░ 12.3%   │
│ └─ 104,891 resources               │
│                                     │
│ [View All Types →]                  │
└─────────────────────────────────────┘
```

### 3.4 Validation Aspects Panel
```
┌─────────────────────────────────────┐
│ 🔍 VALIDATION ASPECTS        [⚙️]   │
├─────────────────────────────────────┤
│                                     │
│ Structural    ✅ Enabled           │
│ └─ JSON schema validation          │
│                                     │
│ Profile       ✅ Enabled           │
│ └─ Conformance validation          │
│                                     │
│ Terminology   ⚠️ Warning Mode      │
│ └─ Code system validation          │
│                                     │
│ Reference     ✅ Enabled           │
│ └─ Resource reference checking     │
│                                     │
│ Business Rules ❌ Disabled          │
│ └─ Custom rule validation          │
│                                     │
│ Metadata      ✅ Enabled           │
│ └─ Version & timestamp validation  │
│                                     │
│ [Configure Aspects →]               │
└─────────────────────────────────────┘
```

---

## 4. Interactive States & Behaviors

### 4.1 Hover States
```
Normal State:     ┌─────────────────────┐
                  │ 📊 Overview         │
                  │ Total: 847,392      │
                  └─────────────────────┘

Hover State:      ┌─────────────────────┐
                  │ 📊 Overview    [👁️] │ ← Show details button
                  │ Total: 847,392      │
                  │ Validated: 567,234  │ ← Additional info
                  └─────────────────────┘
```

### 4.2 Loading States
```
Loading Skeleton: ┌─────────────────────┐
                  │ 📊 Overview         │
                  │ ████████░░░░░░░░░░  │ ← Animated skeleton
                  │ ██████░░░░░░░░░░░░  │
                  └─────────────────────┘
```

### 4.3 Error States
```
Error State:      ┌─────────────────────┐
                  │ ⚠️ Overview         │
                  │ Failed to load      │
                  │ [🔄 Retry]          │
                  └─────────────────────┘
```

---

## 5. Responsive Breakpoints

### 5.1 Desktop (1200px+)
- 4-column grid layout
- Full sidebar visible
- All widgets displayed
- Hover interactions enabled

### 5.2 Tablet (768px - 1199px)
- 2-column grid layout
- Collapsible sidebar
- Condensed widget content
- Touch-optimized interactions

### 5.3 Mobile (320px - 767px)
- Single column stack
- Hidden sidebar (drawer)
- Simplified widget content
- Swipe gestures enabled

---

## 6. Accessibility Features

### 6.1 Keyboard Navigation
- Tab order: Header → Alerts → Overview → Status → Control Panel
- Enter/Space to activate buttons
- Arrow keys for widget navigation
- Escape to close modals

### 6.2 Screen Reader Support
- Semantic HTML structure
- ARIA labels for all interactive elements
- Live regions for real-time updates
- Descriptive alt text for charts

### 6.3 High Contrast Mode
- Alternative color schemes
- Increased border weights
- Enhanced focus indicators
- Monochrome chart options

---

## 7. Animation & Transitions

### 7.1 Micro-interactions
- Button hover: 200ms ease-in-out
- Card hover: Subtle elevation increase
- Loading spinner: 1s linear infinite
- Progress bar: Smooth width transitions

### 7.2 Page Transitions
- Route changes: 300ms fade transition
- Modal open/close: 250ms scale + fade
- Sidebar toggle: 300ms slide transition
- Widget expand/collapse: 200ms height transition

---

## 8. Data Visualization Specifications

### 8.1 Chart Types
- **Progress Bars:** For validation completion
- **Donut Charts:** For resource type distribution
- **Line Charts:** For trend analysis
- **Bar Charts:** For comparison data

### 8.2 Color Palette
- **Primary:** #2563eb (Blue)
- **Success:** #16a34a (Green)
- **Warning:** #d97706 (Orange)
- **Error:** #dc2626 (Red)
- **Neutral:** #6b7280 (Gray)

### 8.3 Typography
- **Headers:** Inter, 24px, 600 weight
- **Body:** Inter, 16px, 400 weight
- **Captions:** Inter, 14px, 400 weight
- **Monospace:** JetBrains Mono, 14px

---

## 9. Implementation Notes

### 9.1 Component Structure
```
Dashboard/
├── Header/
│   ├── ServerStatus
│   ├── LastUpdated
│   └── UserMenu
├── Widgets/
│   ├── AlertCard
│   ├── OverviewCard
│   ├── StatusCard
│   └── TrendsCard
├── ControlPanel/
│   ├── ProgressBar
│   ├── ValidationControls
│   └── CurrentActivity
└── Sidebar/
    ├── Navigation
    ├── QuickAccess
    └── ServerInfo
```

### 9.2 State Management
- **Server State:** TanStack Query for server data
- **UI State:** Zustand for dashboard layout
- **Real-time:** Polling with React hooks
- **Persistence:** LocalStorage for user preferences

### 9.3 Performance Considerations
- **Virtual Scrolling:** For large resource lists
- **Lazy Loading:** For chart components
- **Memoization:** For expensive calculations
- **Debouncing:** For search and filter inputs

---

## 10. User Flow Diagrams

### 10.1 Primary User Journey
```
1. User opens dashboard
   ↓
2. Sees overview of server status
   ↓
3. Notices validation is running
   ↓
4. Clicks on validation control panel
   ↓
5. Views detailed progress information
   ↓
6. Decides to pause validation
   ↓
7. Clicks pause button
   ↓
8. Confirms action in modal
   ↓
9. Validation pauses, UI updates
```

### 10.2 Mobile User Journey
```
1. User opens mobile app
   ↓
2. Sees condensed dashboard
   ↓
3. Swipes to see more widgets
   ↓
4. Taps on validation status
   ↓
5. Modal opens with details
   ↓
6. User can control validation
   ↓
7. Modal closes, dashboard updates
```

---

This wireframe specification provides a comprehensive guide for implementing the redesigned dashboard with modern UX patterns, responsive design, and accessibility features. The layout prioritizes critical information while maintaining clean visual hierarchy and intuitive navigation patterns.
