#!/bin/bash
# performance-monitor.sh
# Continuous performance monitoring for development

set -e

# Configuration
BASE_URL=${1:-"http://localhost:5000"}
INTERVAL=${2:-30}  # seconds between checks
LOG_FILE=${3:-"performance.log"}

echo "📊 Performance Monitor"
echo "===================="
echo "Base URL: $BASE_URL"
echo "Check interval: ${INTERVAL}s"
echo "Log file: $LOG_FILE"
echo ""

# Create log file header
echo "timestamp,endpoint,response_time_ms,status_code" > "$LOG_FILE"

# Function to monitor a single endpoint
monitor_endpoint() {
    local url="$1"
    local endpoint_name="$2"
    
    local start_time=$(date +%s.%N)
    local response_code=$(curl -o /dev/null -s -w '%{http_code}' "$url" || echo "000")
    local end_time=$(date +%s.%N)
    
    local duration=$(echo "$end_time - $start_time" | bc -l)
    local duration_ms=$(echo "$duration * 1000" | bc -l)
    local timestamp=$(date -Iseconds)
    
    # Log to file
    echo "$timestamp,$endpoint_name,$duration_ms,$response_code" >> "$LOG_FILE"
    
    # Color coding for status
    local status_color=""
    if [ "$response_code" = "200" ]; then
        status_color="\033[32m"  # Green
    else
        status_color="\033[31m"  # Red
    fi
    
    # Console output
    echo -e "${status_color}$(date '+%H:%M:%S') - $endpoint_name: ${duration_ms}ms (HTTP $response_code)\033[0m"
}

# Function to show performance summary
show_summary() {
    echo ""
    echo "📈 Performance Summary (last 10 checks)"
    echo "======================================="
    
    if [ -f "$LOG_FILE" ] && [ $(wc -l < "$LOG_FILE") -gt 1 ]; then
        # Get last 10 entries for each endpoint
        local endpoints=("validation/issues/groups" "validation/results" "dashboard/stats" "dashboard/cards")
        
        for endpoint in "${endpoints[@]}"; do
            echo ""
            echo "🔍 /api/$endpoint"
            local recent_data=$(tail -n +2 "$LOG_FILE" | grep ",$endpoint," | tail -10)
            
            if [ -n "$recent_data" ]; then
                local times=$(echo "$recent_data" | cut -d',' -f3)
                local avg_time=$(echo "$times" | awk '{sum+=$1} END {printf "%.2f", sum/NR}')
                local max_time=$(echo "$times" | sort -n | tail -1)
                local min_time=$(echo "$times" | sort -n | head -1)
                
                echo "  Average: ${avg_time}ms"
                echo "  Min: ${min_time}ms"
                echo "  Max: ${max_time}ms"
                
                # Check against budgets
                local budget=""
                if [[ "$endpoint" == *"validation/issues/groups"* ]] || [[ "$endpoint" == *"validation/results"* ]]; then
                    budget="500ms"
                    if (( $(echo "$avg_time > 500" | bc -l) )); then
                        echo "  ⚠️  Average exceeds budget of ${budget}"
                    else
                        echo "  ✅ Within budget of ${budget}"
                    fi
                elif [[ "$endpoint" == *"dashboard"* ]]; then
                    budget="400ms"
                    if (( $(echo "$avg_time > 400" | bc -l) )); then
                        echo "  ⚠️  Average exceeds budget of ${budget}"
                    else
                        echo "  ✅ Within budget of ${budget}"
                    fi
                fi
            else
                echo "  No data available"
            fi
        done
    else
        echo "No performance data available yet."
    fi
}

# Main monitoring loop
echo "Starting continuous performance monitoring..."
echo "Press Ctrl+C to stop and view summary"
echo ""

# Check if server is running
if ! curl -s "$BASE_URL/api/health" > /dev/null; then
    echo "❌ Server is not running at $BASE_URL"
    echo "Please start the server before running performance monitoring."
    exit 1
fi

# Set up signal handler for graceful shutdown
trap 'show_summary; exit 0' INT

# Monitoring loop
while true; do
    echo "$(date '+%H:%M:%S') - Checking endpoints..."
    
    # Monitor key endpoints
    monitor_endpoint "$BASE_URL/api/validation/issues/groups" "validation/issues/groups"
    monitor_endpoint "$BASE_URL/api/validation/results" "validation/results"
    monitor_endpoint "$BASE_URL/api/dashboard/stats" "dashboard/stats"
    monitor_endpoint "$BASE_URL/api/dashboard/cards" "dashboard/cards"
    
    echo ""
    sleep "$INTERVAL"
done
