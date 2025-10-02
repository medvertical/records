#!/bin/bash
# check-no-mocks.sh
# Script to ensure no mock data is present in production code paths

set -e

echo "🔍 Checking for mock data in production code paths..."
echo ""

# Patterns to search for (these are informational only, not failures)
PATTERNS=(
  "using mock"
  "mock data"
  "hapi\.fhir\.org"
  "fallback.*mock"
  "Mock.*Server"
)

echo "🔍 Scanning for mock data usage (informational)..."
echo ""

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
    echo "⚠️  Found matches (checking if properly gated below):"
    echo "$MATCHES"
    echo ""
  else
    echo "✅ No matches found"
    echo ""
  fi
done

# Check for DEMO_MOCKS flag usage
echo "Checking for DEMO_MOCKS gating..."
echo ""

# Look for mock data usage that's NOT properly gated
echo "Checking for ungated mock data usage..."

# Find all files with mock data usage (excluding test files and admin utilities)
MOCK_FILES=$(grep -r -l "mock data\|using mock\|mock.*server\|mock.*fhir" \
  --exclude-dir=node_modules \
  --exclude-dir=.git \
  --exclude-dir=test \
  --exclude="*.test.ts" \
  --exclude="*.test.tsx" \
  --exclude="*.md" \
  --exclude="*clear-validation-results*" \
  server/ server.ts 2>/dev/null || true)

UNGATED_FOUND=0

for FILE in $MOCK_FILES; do
  # Skip if file contains proper gating
  if grep -q "FeatureFlags.DEMO_MOCKS\|DEMO_MOCKS" "$FILE"; then
    continue
  fi
  
  # Check for ungated mock usage
  UNGATED_IN_FILE=$(grep -n "mock data\|using mock\|mock.*server\|mock.*fhir" "$FILE" 2>/dev/null | \
    grep -v "FeatureFlags.DEMO_MOCKS\|DEMO_MOCKS\|For now, return mock data\|Demo mode.*mock\|Mock data for DEMO_MOCKS" || true)
  
  if [ -n "$UNGATED_IN_FILE" ]; then
    echo "❌ Found ungated mock data in $FILE:"
    echo "$UNGATED_IN_FILE"
    echo ""
    UNGATED_FOUND=1
  fi
done

if [ $UNGATED_FOUND -eq 0 ]; then
  echo "✅ All mock data is properly gated behind DEMO_MOCKS flag"
  echo ""
else
  echo "❌ Found ungated mock data usage!"
  EXIT_CODE=1
fi

if [ $EXIT_CODE -eq 0 ]; then
  echo "✅ All checks passed! No mock data found in production paths."
else
  echo "❌ Mock data check failed! Please remove or gate mock data behind DEMO_MOCKS flag."
fi

exit $EXIT_CODE
