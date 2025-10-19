# Dashboard Testing Checklist

## Pre-Testing Setup

### Environment Requirements
- ✅ Node.js and npm installed
- ✅ FHIR server running and accessible
- ✅ Database connected
- ✅ Active FHIR server configured in the application

### Data Requirements
- Ensure FHIR server has resources available (Patient, Observation, etc.)
- Ideally have at least 100+ resources for meaningful testing
- Have a mix of resource types for better visualization

## Test Procedures

### 1. Initial Load Tests

#### 1.1 Dashboard Loads Successfully
- [ ] Navigate to `/dashboard`
- [ ] Dashboard renders without errors
- [ ] All 4 metric cards display
- [ ] Batch control widget shows in idle state
- [ ] Resources by type table loads
- [ ] Validation chart renders (or shows empty state)

**Expected Results:**
- No console errors
- Loading skeletons appear briefly, then data loads
- Metrics show actual counts from FHIR server

#### 1.2 Metric Cards Display Correctly
- [ ] Total Resources shows count from FHIR server
- [ ] Validation Coverage shows percentage (0-100%)
- [ ] Errors card shows error count with red styling
- [ ] Warnings card shows warning count with yellow styling

**Expected Results:**
- All values are numbers (not NaN or undefined)
- Cards have appropriate color coding
- Numbers formatted with locale (e.g., 1,000 instead of 1000)

### 2. Resource Type Selection Tests

#### 2.1 Multi-Select Dropdown Functionality
- [ ] Click "Select resource types..." dropdown
- [ ] Dropdown opens with list of resource types
- [ ] Each type shows count next to it
- [ ] Types are sorted by count (highest first)

**Expected Results:**
- Dropdown is searchable
- "Select All" and "Clear All" buttons visible
- Resource counts match FHIR server data

#### 2.2 Selection Actions
- [ ] Click a resource type to select it
- [ ] Selected type appears as badge below dropdown
- [ ] Click badge X to remove selection
- [ ] Use "Select All" - all types selected
- [ ] Use "Clear All" - all selections removed

**Expected Results:**
- Checkmarks appear next to selected types
- Badge count in dropdown trigger updates
- Badges show resource counts

### 3. Advanced Options Tests

#### 3.1 Advanced Options Expand/Collapse
- [ ] Click "Advanced Options" to expand
- [ ] Options panel appears with sliders and checkboxes
- [ ] Click again to collapse
- [ ] Panel smoothly animates

**Expected Results:**
- Smooth transition animation
- All controls visible when expanded

#### 3.2 Batch Size Slider
- [ ] Drag slider to change batch size (5-50)
- [ ] Value updates in label
- [ ] Can click anywhere on slider track

**Expected Results:**
- Slider moves smoothly
- Value stays within range (5-50)
- Increments by 5

#### 3.3 Max Concurrency Slider
- [ ] Drag slider to change concurrency (1-10)
- [ ] Value updates in label
- [ ] Can click anywhere on slider track

**Expected Results:**
- Slider moves smoothly
- Value stays within range (1-10)
- Increments by 1

#### 3.4 Validation Aspects Checkboxes
- [ ] Click checkboxes to toggle aspects
- [ ] Multiple aspects can be selected
- [ ] Aspect names are capitalized and readable

**Expected Results:**
- Checkboxes toggle correctly
- At least one aspect can be selected
- Labels are user-friendly

### 4. Batch Validation Start Tests

#### 4.1 Validation Without Selection
- [ ] Clear all resource type selections
- [ ] Click "Start Batch Validation"

**Expected Results:**
- Alert/error message appears
- Message says "Please select at least one resource type"
- Validation does NOT start

#### 4.2 Valid Batch Start
- [ ] Select 1-3 resource types (e.g., Patient, Observation)
- [ ] Keep default advanced options
- [ ] Click "Start Batch Validation"

**Expected Results:**
- Button shows "Starting..." briefly
- Widget switches to running state
- Progress bar appears at 0%
- Job ID is displayed
- Status badge shows "Running"

### 5. Batch Validation Running State Tests

#### 5.1 Progress Updates
- [ ] Watch progress bar increase
- [ ] Verify percentage updates
- [ ] Check "Processed / Total" count increases
- [ ] Observe "Current: [ResourceType]" label

**Expected Results:**
- Progress updates every 2 seconds
- Percentage increases from 0% to 100%
- Current resource type changes as validation proceeds
- Processing rate is calculated and displayed

#### 5.2 Statistics Cards Update
- [ ] Watch "Valid" count increase (green card)
- [ ] Watch "Errors" count update (red card)
- [ ] Watch "Warnings" count update (yellow card)

**Expected Results:**
- Cards update in real-time
- Numbers match progress data
- Card colors are appropriate (green, red, yellow)

#### 5.3 Performance Metrics
- [ ] Check "Processing Rate" displays resources/min
- [ ] Check "Estimated Time Remaining" updates

**Expected Results:**
- Processing rate is reasonable (> 0)
- Time remaining decreases as validation progresses
- Time formatted as duration (e.g., "3m 30s")

#### 5.4 Per-Type Progress Bars
- [ ] Verify each selected resource type has a progress bar
- [ ] Check progress bars increase individually
- [ ] Verify error/warning counts per type

**Expected Results:**
- One progress bar per selected resource type
- Each updates independently
- Sub-counts match overall counts

#### 5.5 Top Metric Cards Update Live
- [ ] Watch "Total Resources" in top cards
- [ ] Watch "Errors" metric increase
- [ ] Watch "Warnings" metric increase

**Expected Results:**
- Top cards update during validation
- Changes reflect current progress
- No flickering or glitches

### 6. Batch Control Tests

#### 6.1 Pause Functionality
- [ ] Click "Pause" button during validation
- [ ] Button changes to "Resume"
- [ ] Status badge changes to "Paused"
- [ ] Progress stops updating

**Expected Results:**
- Validation pauses immediately
- Progress numbers freeze
- No new resources processed
- Current state is maintained

#### 6.2 Resume Functionality
- [ ] After pausing, click "Resume" button
- [ ] Button changes back to "Pause"
- [ ] Status badge changes to "Running"
- [ ] Progress continues from where it stopped

**Expected Results:**
- Validation resumes immediately
- Progress continues updating
- No data loss during pause
- Processing rate recalculates

#### 6.3 Stop Functionality
- [ ] Click "Stop" button during validation
- [ ] Confirmation dialog appears
- [ ] Click "Cancel" - validation continues
- [ ] Click "Stop" again, then "Stop Validation"

**Expected Results:**
- Confirmation dialog has clear warning
- Canceling returns to running state
- Confirming stops validation
- Widget returns to idle state
- History updates with stopped batch

### 7. Batch Completion Tests

#### 7.1 Natural Completion
- [ ] Let a small batch complete naturally
- [ ] Watch progress reach 100%
- [ ] Widget returns to idle state
- [ ] Batch appears in history

**Expected Results:**
- Smooth transition to idle
- History table updates automatically
- Completed batch shows in recent runs
- Final statistics are saved

#### 7.2 History Table Update
- [ ] Verify completed batch in history
- [ ] Check start time is correct
- [ ] Check duration is calculated
- [ ] Check resource types are listed
- [ ] Check status is "Completed"
- [ ] Check results show processed/total

**Expected Results:**
- History table shows up to 5 recent batches
- Times formatted as "X ago" (e.g., "2 minutes ago")
- Duration formatted properly
- Resource type badges visible
- Status has appropriate icon and color

### 8. Dashboard Data Updates

#### 8.1 Post-Validation Data Refresh
- [ ] After batch completes, verify metrics update
- [ ] Check "Validation Coverage" increases
- [ ] Check "Errors" and "Warnings" reflect new data
- [ ] Verify validation chart updates

**Expected Results:**
- Dashboard data refreshes automatically
- New validation results visible in chart
- Resource breakdown updated
- All metrics consistent

#### 8.2 Resources by Type Table
- [ ] Verify table shows top 15 resource types
- [ ] Check counts are accurate
- [ ] Check percentages sum correctly
- [ ] Verify total at bottom

**Expected Results:**
- Types sorted by count (highest first)
- Percentages calculated correctly
- Table scrolls if > 15 types
- Total matches sum of all types

#### 8.3 Validation Status Chart
- [ ] Verify chart shows validated resource types
- [ ] Check stacked bars show Valid, Errors, Warnings
- [ ] Hover over bars to see tooltip
- [ ] Check legend is correct

**Expected Results:**
- Chart renders without errors
- Colors: Green (valid), Red (errors), Yellow (warnings)
- Tooltip shows detailed breakdown
- X-axis labels readable (rotated if needed)
- Empty state shown if no validated resources

### 9. Responsive Design Tests

#### 9.1 Desktop View (1024px+)
- [ ] Metric cards in 4 columns
- [ ] Batch widget full width
- [ ] Bottom section in 2 columns

**Expected Results:**
- Clean, spacious layout
- No horizontal scroll
- All elements properly aligned

#### 9.2 Tablet View (768px - 1023px)
- [ ] Metric cards in 2 columns
- [ ] Batch widget full width
- [ ] Bottom section in 2 columns

**Expected Results:**
- Layout adapts smoothly
- Text remains readable
- Controls still accessible

#### 9.3 Mobile View (< 768px)
- [ ] All cards in single column
- [ ] Batch widget stacks vertically
- [ ] Bottom section stacks vertically

**Expected Results:**
- All content visible
- Scrolling works smoothly
- Touch targets adequate size
- No overlapping elements

### 10. Error Handling Tests

#### 10.1 Network Error During Load
- [ ] Disconnect network
- [ ] Refresh dashboard
- [ ] Verify error boundaries catch errors
- [ ] Reconnect and retry

**Expected Results:**
- Graceful error display
- No application crash
- Retry functionality available
- Fallback data shown if available

#### 10.2 Validation API Error
- [ ] Start validation when backend unavailable
- [ ] Verify error message displays
- [ ] Check dashboard remains functional

**Expected Results:**
- Clear error message
- Dashboard doesn't crash
- Can retry operation

#### 10.3 Timeout Handling
- [ ] Start validation with large dataset
- [ ] Monitor for timeout issues

**Expected Results:**
- No timeout errors with reasonable datasets
- Long-running validations continue properly
- Progress continues to update

### 11. Performance Tests

#### 11.1 Large Dataset Handling
- [ ] Select resource types with 5,000+ resources each
- [ ] Start batch validation
- [ ] Monitor browser performance

**Expected Results:**
- UI remains responsive
- Progress updates don't lag
- Memory usage reasonable
- No excessive re-renders

#### 11.2 Polling Efficiency
- [ ] Monitor network tab during validation
- [ ] Verify polling interval is 2 seconds
- [ ] Check payload sizes are reasonable

**Expected Results:**
- Consistent 2-second polling
- Small, efficient payloads
- No unnecessary requests
- Polling stops when idle

#### 11.3 Chart Rendering Performance
- [ ] Load validation chart with 10+ resource types
- [ ] Check render time
- [ ] Interact with chart (hover, etc.)

**Expected Results:**
- Chart renders quickly (< 1 second)
- Smooth interactions
- No lag on hover/tooltip

### 12. Edge Cases

#### 12.1 Empty States
- [ ] View dashboard with no FHIR resources
- [ ] View chart with no validated resources
- [ ] View history with no batches

**Expected Results:**
- Appropriate empty state messages
- No errors or crashes
- Helpful guidance provided

#### 12.2 Single Resource Type
- [ ] Select only one resource type
- [ ] Start and complete validation

**Expected Results:**
- Works correctly with single type
- Progress and stats accurate
- No layout issues

#### 12.3 Very Fast Completion
- [ ] Select resource type with < 10 resources
- [ ] Start validation

**Expected Results:**
- Completes quickly without errors
- All states transition properly
- History records correctly

#### 12.4 Concurrent Actions
- [ ] Try to start another batch while one running
- [ ] Verify proper handling

**Expected Results:**
- Second start prevented or queued
- Clear message to user
- No state corruption

### 13. Browser Compatibility

Test in the following browsers:
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)

**Expected Results:**
- Consistent behavior across browsers
- No browser-specific errors
- Charts render in all browsers

### 14. Accessibility Tests

#### 14.1 Keyboard Navigation
- [ ] Tab through all interactive elements
- [ ] Use Enter/Space to activate buttons
- [ ] Use arrow keys in dropdowns

**Expected Results:**
- All controls reachable via keyboard
- Focus indicators visible
- Logical tab order

#### 14.2 Screen Reader Compatibility
- [ ] Enable screen reader
- [ ] Navigate dashboard
- [ ] Verify announcements for state changes

**Expected Results:**
- Labels are announced
- State changes communicated
- Progress updates announced

## Success Criteria

The dashboard implementation is considered successful if:

✅ All core functionality works without errors
✅ Real-time updates function correctly
✅ Batch validation can be started, paused, resumed, and stopped
✅ All metrics update accurately
✅ UI is responsive across device sizes
✅ Performance is acceptable with realistic data volumes
✅ Error handling is graceful
✅ No data loss during state transitions
✅ History tracking works correctly
✅ Charts render properly

## Known Limitations

Document any known limitations discovered during testing:

1. **History Limit**: Only last 10 batches stored (configurable)
2. **Polling Frequency**: Fixed at 2 seconds (not user-configurable)
3. **Browser Tab Focus**: Polling pauses when tab inactive (by design)
4. **Cache Duration**: Resource counts cached for 1 hour

## Test Results Log

Date: _______________
Tester: _______________

| Test Section | Status | Notes |
|--------------|--------|-------|
| Initial Load | ⬜ | |
| Resource Selection | ⬜ | |
| Advanced Options | ⬜ | |
| Batch Start | ⬜ | |
| Running State | ⬜ | |
| Batch Controls | ⬜ | |
| Completion | ⬜ | |
| Data Updates | ⬜ | |
| Responsive Design | ⬜ | |
| Error Handling | ⬜ | |
| Performance | ⬜ | |
| Edge Cases | ⬜ | |
| Browser Compatibility | ⬜ | |
| Accessibility | ⬜ | |

Legend: ⬜ Not Started | 🔄 In Progress | ✅ Passed | ❌ Failed | ⚠️ Issues Found

