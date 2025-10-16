#!/bin/bash
# Performance Profiling Script
# Task 10.5: Automated profiling workflow

set -e

echo "╔════════════════════════════════════════════════════════════╗"
echo "║   FHIR Validation Engine - Performance Profiling Tool     ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
PROFILE_TYPE="timing"
OUTPUT_DIR="./performance-results"
LOAD_TEST_DURATION=30
PORT=3000

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --type)
      PROFILE_TYPE="$2"
      shift 2
      ;;
    --output)
      OUTPUT_DIR="$2"
      shift 2
      ;;
    --duration)
      LOAD_TEST_DURATION="$2"
      shift 2
      ;;
    --port)
      PORT="$2"
      shift 2
      ;;
    --help)
      echo "Usage: $0 [options]"
      echo ""
      echo "Options:"
      echo "  --type TYPE        Profiling type: timing|clinic|cpu|memory (default: timing)"
      echo "  --output DIR       Output directory for results (default: ./performance-results)"
      echo "  --duration SECS    Load test duration in seconds (default: 30)"
      echo "  --port PORT        Server port (default: 3000)"
      echo "  --help             Show this help message"
      echo ""
      echo "Examples:"
      echo "  $0 --type timing"
      echo "  $0 --type clinic --duration 60"
      echo "  $0 --type cpu --output ./my-results"
      exit 0
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"
      exit 1
      ;;
  esac
done

# Create output directory
mkdir -p "$OUTPUT_DIR"

echo -e "${BLUE}Configuration:${NC}"
echo "  Profile Type: $PROFILE_TYPE"
echo "  Output Dir:   $OUTPUT_DIR"
echo "  Duration:     ${LOAD_TEST_DURATION}s"
echo "  Port:         $PORT"
echo ""

# Function to check if server is running
check_server() {
  curl -s "http://localhost:$PORT/api/health" > /dev/null 2>&1
  return $?
}

# Function to wait for server
wait_for_server() {
  echo -ne "${YELLOW}Waiting for server to start...${NC}"
  for i in {1..30}; do
    if check_server; then
      echo -e " ${GREEN}✓${NC}"
      return 0
    fi
    echo -n "."
    sleep 1
  done
  echo -e " ${RED}✗${NC}"
  echo -e "${RED}Server failed to start${NC}"
  return 1
}

# Function to run timing profiling
profile_timing() {
  echo -e "${GREEN}═══ Timing Profiling ═══${NC}"
  echo ""
  
  # 1. Capture baseline
  echo -e "${BLUE}Step 1: Capturing baseline metrics...${NC}"
  npm test -- tests/performance/validation-performance.test.ts > "$OUTPUT_DIR/baseline.log" 2>&1
  echo -e "${GREEN}✓ Baseline captured${NC}"
  echo ""
  
  # 2. Start server with timing enabled
  echo -e "${BLUE}Step 2: Starting server with detailed timing...${NC}"
  LOG_VALIDATION_TIMING=true npm start > "$OUTPUT_DIR/server.log" 2>&1 &
  SERVER_PID=$!
  
  if ! wait_for_server; then
    kill $SERVER_PID 2>/dev/null || true
    exit 1
  fi
  
  # 3. Fetch initial timing stats
  echo -e "${BLUE}Step 3: Running validation workload (${LOAD_TEST_DURATION}s)...${NC}"
  sleep 2
  
  # Simple load test using curl
  END_TIME=$((SECONDS + LOAD_TEST_DURATION))
  REQUEST_COUNT=0
  while [ $SECONDS -lt $END_TIME ]; do
    curl -s -X POST "http://localhost:$PORT/api/validate" \
      -H "Content-Type: application/json" \
      -d '{"resourceType":"Patient","name":[{"family":"Test"}]}' > /dev/null 2>&1 && ((REQUEST_COUNT++)) || true
    sleep 0.5
  done
  
  echo -e "${GREEN}✓ Completed $REQUEST_COUNT validation requests${NC}"
  echo ""
  
  # 4. Fetch timing stats
  echo -e "${BLUE}Step 4: Collecting timing statistics...${NC}"
  curl -s "http://localhost:$PORT/api/performance/timing/stats" | jq '.' > "$OUTPUT_DIR/timing-stats.json" 2>/dev/null || \
    curl -s "http://localhost:$PORT/api/performance/timing/stats" > "$OUTPUT_DIR/timing-stats.json"
  
  curl -s "http://localhost:$PORT/api/performance/baseline/current" | jq '.' > "$OUTPUT_DIR/baseline-current.json" 2>/dev/null || \
    curl -s "http://localhost:$PORT/api/performance/baseline/current" > "$OUTPUT_DIR/baseline-current.json"
  
  echo -e "${GREEN}✓ Timing data collected${NC}"
  echo ""
  
  # 5. Stop server
  echo -e "${BLUE}Step 5: Stopping server...${NC}"
  kill $SERVER_PID 2>/dev/null || true
  wait $SERVER_PID 2>/dev/null || true
  echo -e "${GREEN}✓ Server stopped${NC}"
  echo ""
  
  # 6. Generate report
  echo -e "${GREEN}═══ Profiling Complete ═══${NC}"
  echo ""
  echo "Results saved to: $OUTPUT_DIR"
  echo "  • baseline.log          - Test suite baseline"
  echo "  • timing-stats.json     - Aggregate timing statistics"
  echo "  • baseline-current.json - Current performance baseline"
  echo "  • server.log            - Server logs with detailed timing"
  echo ""
  
  # Display summary if jq is available
  if command -v jq &> /dev/null; then
    echo -e "${BLUE}Performance Summary:${NC}"
    jq -r '
      "  Cold Start:  \(.coldStartTimeMs)ms",
      "  Warm Cache:  \(.warmCacheTimeMs)ms",
      "  Throughput:  \(.throughputResourcesPerSecond | tonumber | round) resources/sec"
    ' "$OUTPUT_DIR/baseline-current.json" 2>/dev/null || echo "  (Unable to parse baseline)"
    echo ""
  fi
}

# Function to run clinic profiling
profile_clinic() {
  echo -e "${GREEN}═══ Clinic.js Profiling ═══${NC}"
  echo ""
  
  # Check if clinic is installed
  if ! command -v clinic &> /dev/null; then
    echo -e "${YELLOW}Clinic.js not found. Installing...${NC}"
    npm install -g clinic
  fi
  
  echo -e "${BLUE}Starting Clinic Doctor profiling...${NC}"
  echo "This will:"
  echo "  1. Start the server with profiling"
  echo "  2. Run for ${LOAD_TEST_DURATION}s"
  echo "  3. Generate an HTML report"
  echo ""
  echo -e "${YELLOW}Press Ctrl+C after the load test completes${NC}"
  echo ""
  
  # Run clinic doctor
  clinic doctor --on-port "sleep $LOAD_TEST_DURATION" -- node server.ts
  
  echo ""
  echo -e "${GREEN}✓ Clinic report generated and opened in browser${NC}"
}

# Function to run CPU profiling
profile_cpu() {
  echo -e "${GREEN}═══ CPU Profiling ═══${NC}"
  echo ""
  
  echo -e "${BLUE}Step 1: Starting server with CPU profiler...${NC}"
  node --cpu-prof --cpu-prof-interval=500 server.ts > "$OUTPUT_DIR/server.log" 2>&1 &
  SERVER_PID=$!
  
  if ! wait_for_server; then
    kill $SERVER_PID 2>/dev/null || true
    exit 1
  fi
  
  echo -e "${BLUE}Step 2: Running validation workload (${LOAD_TEST_DURATION}s)...${NC}"
  sleep 2
  
  # Simple load test
  END_TIME=$((SECONDS + LOAD_TEST_DURATION))
  REQUEST_COUNT=0
  while [ $SECONDS -lt $END_TIME ]; do
    curl -s -X POST "http://localhost:$PORT/api/validate" \
      -H "Content-Type: application/json" \
      -d '{"resourceType":"Patient","name":[{"family":"Test"}]}' > /dev/null 2>&1 && ((REQUEST_COUNT++)) || true
    sleep 0.5
  done
  
  echo -e "${GREEN}✓ Completed $REQUEST_COUNT validation requests${NC}"
  echo ""
  
  echo -e "${BLUE}Step 3: Stopping server and saving CPU profile...${NC}"
  kill $SERVER_PID 2>/dev/null || true
  wait $SERVER_PID 2>/dev/null || true
  
  # Move CPU profile to output directory
  LATEST_PROFILE=$(ls -t isolate-*.cpuprofile 2>/dev/null | head -1)
  if [ -n "$LATEST_PROFILE" ]; then
    mv "$LATEST_PROFILE" "$OUTPUT_DIR/"
    echo -e "${GREEN}✓ CPU profile saved: $OUTPUT_DIR/$LATEST_PROFILE${NC}"
    echo ""
    echo "To analyze:"
    echo "  1. Open Chrome DevTools"
    echo "  2. Go to 'Profiler' tab"
    echo "  3. Click 'Load' and select: $OUTPUT_DIR/$LATEST_PROFILE"
  else
    echo -e "${YELLOW}Warning: No CPU profile file generated${NC}"
  fi
  echo ""
}

# Function to run memory profiling
profile_memory() {
  echo -e "${GREEN}═══ Memory Profiling ═══${NC}"
  echo ""
  
  echo -e "${BLUE}Starting server with inspector for heap snapshots...${NC}"
  echo ""
  echo "To take heap snapshots:"
  echo "  1. Open Chrome and go to: chrome://inspect"
  echo "  2. Click 'inspect' under Remote Target"
  echo "  3. Go to 'Memory' tab"
  echo "  4. Take heap snapshot before validation"
  echo "  5. Run validation workload"
  echo "  6. Force GC (trash icon)"
  echo "  7. Take another heap snapshot"
  echo "  8. Compare snapshots"
  echo ""
  echo -e "${YELLOW}Press Ctrl+C when done${NC}"
  echo ""
  
  node --inspect=0.0.0.0:9229 --expose-gc server.ts
}

# Main execution
case $PROFILE_TYPE in
  timing)
    profile_timing
    ;;
  clinic)
    profile_clinic
    ;;
  cpu)
    profile_cpu
    ;;
  memory)
    profile_memory
    ;;
  *)
    echo -e "${RED}Unknown profile type: $PROFILE_TYPE${NC}"
    echo "Valid types: timing, clinic, cpu, memory"
    exit 1
    ;;
esac

echo -e "${GREEN}Profiling complete!${NC}"


