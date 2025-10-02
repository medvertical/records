#!/bin/bash
# performance-budget-check.sh
# Script to verify performance budgets for key endpoints

set -e

# Configuration
BASE_URL=${1:-"http://localhost:5000"}
MAX_LIST_GROUP_P95=500    # ms
MAX_DETAIL_P95=300        # ms
MAX_DASHBOARD_P95=400     # ms
SAMPLE_SIZE=10            # Number of requests per endpoint

echo "🎯 Performance Budget Check"
echo "=========================="
echo "Base URL: $BASE_URL"
echo "Sample size: $SAMPLE_SIZE requests per endpoint"
echo ""

# Function to measure response time
measure_response_time() {
    local url="$1"
    local label="$2"
    
    echo "Testing $label..."
    echo "URL: $url"
    
    local times=()
    local total_time=0
    
    # Make multiple requests to get a good sample
    for i in $(seq 1 $SAMPLE_SIZE); do
        local start_time=$(date +%s.%N)
        local response_code=$(curl -o /dev/null -s -w '%{http_code}' "$url" || echo "000")
        local end_time=$(date +%s.%N)
        
        if [ "$response_code" = "200" ]; then
            local duration=$(echo "$end_time - $start_time" | bc -l)
            local duration_ms=$(echo "$duration * 1000" | bc -l)
            times+=($duration_ms)
            total_time=$(echo "$total_time + $duration_ms" | bc -l)
            echo "  Request $i: ${duration_ms}ms (HTTP $response_code)"
        else
            echo "  Request $i: FAILED (HTTP $response_code)"
            return 1
        fi
        
        # Small delay between requests
        sleep 0.1
    done
    
    # Calculate statistics
    local avg_time=$(echo "scale=2; $total_time / $SAMPLE_SIZE" | bc -l)
    
    # Sort times for percentile calculation
    local sorted_times=($(printf '%s\n' "${times[@]}" | sort -n))
    local p95_index=$(echo "scale=0; ($SAMPLE_SIZE - 1) * 0.95" | bc -l | cut -d. -f1)
    local p95_time=${sorted_times[$p95_index]}
    
    echo "  Average: ${avg_time}ms"
    echo "  P95: ${p95_time}ms"
    echo ""
    
    echo "$p95_time"
}

# Check if server is running
echo "🔍 Checking if server is running..."
if ! curl -s "$BASE_URL/api/health" > /dev/null; then
    echo "❌ Server is not running at $BASE_URL"
    echo "Please start the server before running performance tests."
    exit 1
fi
echo "✅ Server is running"
echo ""

# Track overall results
OVERALL_EXIT_CODE=0

# Test 1: List/Group endpoints (p95 < 500ms)
echo "📋 Testing List/Group Endpoints (Budget: P95 < ${MAX_LIST_GROUP_P95}ms)"
echo "=================================================================="

# Test validation issues groups
P95_TIME=$(measure_response_time "$BASE_URL/api/validation/issues/groups" "GET /api/validation/issues/groups")
if (( $(echo "$P95_TIME > $MAX_LIST_GROUP_P95" | bc -l) )); then
    echo "❌ FAILED: P95 response time ${P95_TIME}ms exceeds budget of ${MAX_LIST_GROUP_P95}ms"
    OVERALL_EXIT_CODE=1
else
    echo "✅ PASSED: P95 response time ${P95_TIME}ms within budget of ${MAX_LIST_GROUP_P95}ms"
fi
echo ""

# Test validation results list
P95_TIME=$(measure_response_time "$BASE_URL/api/validation/results" "GET /api/validation/results")
if (( $(echo "$P95_TIME > $MAX_LIST_GROUP_P95" | bc -l) )); then
    echo "❌ FAILED: P95 response time ${P95_TIME}ms exceeds budget of ${MAX_LIST_GROUP_P95}ms"
    OVERALL_EXIT_CODE=1
else
    echo "✅ PASSED: P95 response time ${P95_TIME}ms within budget of ${MAX_LIST_GROUP_P95}ms"
fi
echo ""

# Test 2: Detail endpoints (p95 < 300ms)
echo "🔍 Testing Detail Endpoints (Budget: P95 < ${MAX_DETAIL_P95}ms)"
echo "============================================================="

# Test individual resource detail
P95_TIME=$(measure_response_time "$BASE_URL/api/fhir/Patient" "GET /api/fhir/Patient")
if (( $(echo "$P95_TIME > $MAX_DETAIL_P95" | bc -l) )); then
    echo "❌ FAILED: P95 response time ${P95_TIME}ms exceeds budget of ${MAX_DETAIL_P95}ms"
    OVERALL_EXIT_CODE=1
else
    echo "✅ PASSED: P95 response time ${P95_TIME}ms within budget of ${MAX_DETAIL_P95}ms"
fi
echo ""

# Test validation result detail
P95_TIME=$(measure_response_time "$BASE_URL/api/validation/results/1" "GET /api/validation/results/1")
if (( $(echo "$P95_TIME > $MAX_DETAIL_P95" | bc -l) )); then
    echo "❌ FAILED: P95 response time ${P95_TIME}ms exceeds budget of ${MAX_DETAIL_P95}ms"
    OVERALL_EXIT_CODE=1
else
    echo "✅ PASSED: P95 response time ${P95_TIME}ms within budget of ${MAX_DETAIL_P95}ms"
fi
echo ""

# Test 3: Dashboard endpoints (p95 < 400ms)
echo "📊 Testing Dashboard Endpoints (Budget: P95 < ${MAX_DASHBOARD_P95}ms)"
echo "=================================================================="

# Test dashboard stats
P95_TIME=$(measure_response_time "$BASE_URL/api/dashboard/stats" "GET /api/dashboard/stats")
if (( $(echo "$P95_TIME > $MAX_DASHBOARD_P95" | bc -l) )); then
    echo "❌ FAILED: P95 response time ${P95_TIME}ms exceeds budget of ${MAX_DASHBOARD_P95}ms"
    OVERALL_EXIT_CODE=1
else
    echo "✅ PASSED: P95 response time ${P95_TIME}ms within budget of ${MAX_DASHBOARD_P95}ms"
fi
echo ""

# Test dashboard cards
P95_TIME=$(measure_response_time "$BASE_URL/api/dashboard/cards" "GET /api/dashboard/cards")
if (( $(echo "$P95_TIME > $MAX_DASHBOARD_P95" | bc -l) )); then
    echo "❌ FAILED: P95 response time ${P95_TIME}ms exceeds budget of ${MAX_DASHBOARD_P95}ms"
    OVERALL_EXIT_CODE=1
else
    echo "✅ PASSED: P95 response time ${P95_TIME}ms within budget of ${MAX_DASHBOARD_P95}ms"
fi
echo ""

# Test combined dashboard data
P95_TIME=$(measure_response_time "$BASE_URL/api/dashboard/combined" "GET /api/dashboard/combined")
if (( $(echo "$P95_TIME > $MAX_DASHBOARD_P95" | bc -l) )); then
    echo "❌ FAILED: P95 response time ${P95_TIME}ms exceeds budget of ${MAX_DASHBOARD_P95}ms"
    OVERALL_EXIT_CODE=1
else
    echo "✅ PASSED: P95 response time ${P95_TIME}ms within budget of ${MAX_DASHBOARD_P95}ms"
fi
echo ""

# Summary
echo "📋 Performance Budget Summary"
echo "============================="
if [ $OVERALL_EXIT_CODE -eq 0 ]; then
    echo "✅ ALL PERFORMANCE BUDGETS MET"
    echo ""
    echo "Budget Status:"
    echo "  • List/Group endpoints: P95 < ${MAX_LIST_GROUP_P95}ms ✅"
    echo "  • Detail endpoints: P95 < ${MAX_DETAIL_P95}ms ✅"
    echo "  • Dashboard endpoints: P95 < ${MAX_DASHBOARD_P95}ms ✅"
else
    echo "❌ PERFORMANCE BUDGETS EXCEEDED"
    echo ""
    echo "Some endpoints exceeded their performance budgets."
    echo "Please optimize the failing endpoints before deployment."
fi

exit $OVERALL_EXIT_CODE
