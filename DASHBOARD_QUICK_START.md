# Dashboard Quick Start Guide

## 🚀 Getting Started

The new dashboard with batch validation control is now live and ready to use!

### Access the Dashboard
Navigate to: `http://localhost:5000/dashboard` (or your deployment URL)

---

## 📖 Quick Overview

### Layout at a Glance
```
┌──────────────────────────────────────────────┐
│  [📊 Metrics] [📈 Coverage] [❌ Errors] [⚠️ Warnings] │
├──────────────────────────────────────────────┤
│         🎛️ Batch Validation Control          │
├───────────────────────┬──────────────────────┤
│  📋 Resources by Type │  📊 Validation Chart │
└───────────────────────┴──────────────────────┘
```

---

## 🎯 Common Tasks

### Task 1: Start a Batch Validation

**Steps:**
1. Click on "Select resource types..." dropdown
2. Select one or more resource types (e.g., Patient, Observation)
3. (Optional) Click "Advanced Options" to configure:
   - Batch Size: 5-50 resources per batch
   - Max Concurrency: 1-10 parallel validations
   - Validation Aspects: Choose which layers to validate
4. Click **"Start Batch Validation"**

**What Happens:**
- Widget switches to running state
- Progress bar shows real-time updates
- Statistics update every 2 seconds
- Top metrics reflect live validation progress

### Task 2: Monitor Progress

**Real-time Information:**
- **Progress Bar**: Overall completion percentage
- **Statistics Cards**: Valid (green), Errors (red), Warnings (yellow)
- **Processing Rate**: Resources validated per minute
- **Time Remaining**: Estimated completion time
- **Per-Type Progress**: Individual progress for each resource type

### Task 3: Pause & Resume

**To Pause:**
1. Click **"Pause"** button
2. Validation stops immediately
3. Progress is saved

**To Resume:**
1. Click **"Resume"** button
2. Validation continues from where it stopped

### Task 4: Stop Validation

**Steps:**
1. Click **"Stop"** button
2. Confirm in the dialog that appears
3. Validation terminates and saves progress

**Note:** Stopped validations appear in the batch history.

### Task 5: View Batch History

**Location:** Bottom of the Batch Control Widget (when idle)

**Information Shown:**
- Start time (relative: "2 hours ago")
- Duration (formatted: "5m 30s")
- Resource types validated
- Status (Completed, Stopped, Error)
- Results (processed/total, errors, warnings)

### Task 6: Refresh Resource Counts

**Manual Refresh:**
1. Open browser developer console
2. Run: `fetch('/api/dashboard/resource-counts/refresh', { method: 'POST' })`
3. Wait ~5 seconds for background refresh
4. Dashboard will automatically update

**Automatic Refresh:**
- Counts refresh every hour automatically
- Fresh counts after FHIR server changes may take up to 1 hour to appear

---

## 🔧 Configuration Options

### Batch Size (5-50 resources)
- **Small (5-10)**: Better error isolation, slower overall
- **Medium (10-20)**: Balanced performance (recommended)
- **Large (25-50)**: Faster completion, more resources per batch

### Max Concurrency (1-10)
- **Low (1-3)**: Lighter server load
- **Medium (4-6)**: Balanced (recommended)
- **High (7-10)**: Faster but higher server load

### Validation Aspects
- **Structural**: JSON structure and FHIR compliance
- **Profile**: Profile conformance
- **Terminology**: Code systems and value sets
- **Reference**: Resource reference integrity
- **Business Rule**: Business logic validation
- **Metadata**: Version and metadata compliance

**Tip:** Enable only the aspects you need to speed up validation.

---

## 📊 Understanding the Data

### Top Metrics

**Total Resources**
- Count of all resources on FHIR server
- Updates during batch validation as new resources are fetched

**Validation Coverage**
- Percentage of total resources that have been validated
- Formula: `(validatedResources / totalResources) × 100`

**Errors**
- Count of resources with validation errors
- Red color indicates issues requiring attention

**Warnings**
- Count of resources with validation warnings
- Yellow color indicates items to review

### Resources by Type Table
- Shows top 15 resource types by count
- Sorted from most to least common
- Percentages show distribution across all types

### Validation Status Chart
- **Green bars**: Valid resources (no issues)
- **Red bars**: Resources with errors
- **Yellow bars**: Resources with warnings
- **Hover** over bars for detailed breakdown

---

## ⚡ Performance Tips

### For Large Datasets (10,000+ resources)

1. **Start with High-Volume Types First**
   - Validate Patient, Observation separately
   - Allows early progress feedback

2. **Use Higher Concurrency**
   - Set max concurrency to 8-10
   - Speeds up overall processing

3. **Monitor Processing Rate**
   - Typical: 100-200 resources/minute
   - If < 50/min, consider reducing concurrency

4. **Validate During Off-Hours**
   - Less load on FHIR server
   - Better performance overall

### For Quick Validation (< 1,000 resources)

1. **Select Specific Types**
   - Don't use "Select All"
   - Focus on types that changed

2. **Enable Only Needed Aspects**
   - Disable aspects you don't need
   - Significant speed improvement

3. **Use Medium Batch Size**
   - 15-20 resources per batch
   - Good balance for small datasets

---

## 🐛 Troubleshooting

### Issue: Validation Starts but No Progress

**Possible Causes:**
- FHIR server not responding
- Selected resource types have 0 resources
- Network connectivity issues

**Solution:**
1. Check browser console for errors
2. Verify FHIR server is accessible
3. Try selecting different resource types
4. Stop and restart validation

### Issue: Progress Bar Stuck

**Possible Causes:**
- Browser tab inactive (polling paused)
- Network temporarily disconnected
- Backend processing stalled

**Solution:**
1. Switch back to the dashboard tab
2. Check network connectivity
3. Refresh the page if needed
4. Check `/api/validation/bulk/progress` in network tab

### Issue: Metrics Not Updating

**Possible Causes:**
- Cache not cleared
- Polling stopped
- API error

**Solution:**
1. Hard refresh browser (Ctrl+Shift+R / Cmd+Shift+R)
2. Clear browser cache
3. Check browser console for errors
4. Verify `/api/dashboard/combined` returns data

### Issue: Chart Not Rendering

**Possible Causes:**
- No validated resources yet
- Browser compatibility issue
- Chart library error

**Solution:**
1. Complete a batch validation first
2. Try a different browser (Chrome recommended)
3. Check browser console for Recharts errors
4. Verify data is present in network response

---

## 🎓 Advanced Usage

### API Direct Access

**Get Current Progress:**
```bash
curl http://localhost:5000/api/validation/bulk/progress
```

**Get Batch History:**
```bash
curl http://localhost:5000/api/validation/batch/history?limit=10
```

**Start Batch Validation:**
```bash
curl -X POST http://localhost:5000/api/validation/bulk/start \
  -H "Content-Type: application/json" \
  -d '{
    "resourceTypes": ["Patient", "Observation"],
    "validationAspects": {
      "structural": true,
      "profile": true
    },
    "config": {
      "batchSize": 10,
      "maxConcurrent": 5
    }
  }'
```

### Programmatic Control

**React Hook Usage:**
```typescript
import { useDashboardBatchState } from '@/hooks/use-dashboard-batch-state';

function MyComponent() {
  const { 
    mode, 
    progress, 
    startBatch, 
    pauseBatch,
    resumeBatch,
    stopBatch 
  } = useDashboardBatchState();

  const handleStart = () => {
    startBatch({
      resourceTypes: ['Patient', 'Observation'],
      validationAspects: {
        structural: true,
        profile: true,
      },
      config: {
        batchSize: 10,
        maxConcurrent: 5,
      },
    });
  };

  return (
    <div>
      <p>Mode: {mode}</p>
      {mode === 'running' && (
        <p>Progress: {progress?.processedResources}/{progress?.totalResources}</p>
      )}
      <button onClick={handleStart}>Start</button>
    </div>
  );
}
```

---

## 📚 Additional Resources

- **Full Documentation**: See `DASHBOARD_IMPLEMENTATION_COMPLETE.md`
- **Testing Guide**: See `DASHBOARD_TESTING_CHECKLIST.md`
- **Layout Reference**: See `DASHBOARD_LAYOUT_GUIDE.md`
- **Component Source**: `/client/src/components/dashboard/`

---

## 💡 Tips & Best Practices

### Do's ✅
- ✅ Start with a few resource types to test
- ✅ Monitor processing rate during validation
- ✅ Use pause if you need to inspect errors
- ✅ Check batch history before starting new validation
- ✅ Enable only necessary validation aspects

### Don'ts ❌
- ❌ Don't start multiple batches simultaneously
- ❌ Don't close browser during validation
- ❌ Don't run with max settings on slow servers
- ❌ Don't ignore error messages
- ❌ Don't forget to stop before closing tab

---

## 🎉 You're Ready!

The dashboard is intuitive and self-explanatory. Start by selecting a few resource types and clicking "Start Batch Validation" to see it in action!

**Questions?** Check the comprehensive documentation files or inspect component source code for detailed information.

---

**Quick Reference Card**

| Action | Location | Result |
|--------|----------|--------|
| Start Validation | Idle Widget → Start Button | Begin batch validation |
| Pause | Running Widget → Pause Button | Pause processing |
| Resume | Running Widget → Resume Button | Continue processing |
| Stop | Running Widget → Stop Button | Terminate validation |
| View History | Idle Widget → Bottom Table | See past batches |
| Configure Options | Idle Widget → Advanced Options | Adjust settings |
| Monitor Progress | Running Widget → Progress Bar | Watch real-time updates |

**Happy Validating! 🚀**

