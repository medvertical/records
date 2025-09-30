#!/bin/bash
# check-no-mocks.sh
# Script to ensure no mock data is present in production code paths

set -e

echo "🔍 Checking for mock data in production code paths..."
echo ""

# Patterns to search for
PATTERNS=(
  "using mock"
  "mock data"
  "hapi\.fhir\.org"
  "fallback.*mock"
  "Mock.*Server"
)

EXIT_CODE=0

for PATTERN in "${PATTERNS[@]}"; do
  echo "Searching for: $PATTERN"
  
  # Search in server code (excluding tests, docs, and node_modules)
  MATCHES=$(grep -r -i "$PATTERN" \
    --exclude-dir=node_modules \
    --exclude-dir=.git \
    --exclude-dir=dist \
    --exclude-dir=build \
    --exclude="*.test.ts" \
    --exclude="*.test.tsx" \
    --exclude="*.spec.ts" \
    --exclude="*.md" \
    server/ server.ts 2>/dev/null || true)
  
  if [ -n "$MATCHES" ]; then
    echo "⚠️  Found matches:"
    echo "$MATCHES"
    echo ""
    EXIT_CODE=1
  else
    echo "✅ No matches found"
    echo ""
  fi
done

# Check for DEMO_MOCKS flag usage
echo "Checking for DEMO_MOCKS gating..."
UNGATED=$(grep -r "using mock\|mock data" \
  --exclude-dir=node_modules \
  --exclude-dir=.git \
  --exclude="*.test.ts" \
  --exclude="*.test.tsx" \
  --exclude="*.md" \
  server/ server.ts 2>/dev/null | \
  grep -v "FeatureFlags.DEMO_MOCKS" || true)

if [ -n "$UNGATED" ]; then
  echo "❌ Found ungated mock data (not behind DEMO_MOCKS flag):"
  echo "$UNGATED"
  echo ""
  EXIT_CODE=1
else
  echo "✅ All mock data is properly gated"
  echo ""
fi

if [ $EXIT_CODE -eq 0 ]; then
  echo "✅ All checks passed! No mock data found in production paths."
else
  echo "❌ Mock data check failed! Please remove or gate mock data behind DEMO_MOCKS flag."
fi

exit $EXIT_CODE
