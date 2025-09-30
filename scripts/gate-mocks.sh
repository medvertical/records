#!/bin/bash
# gate-mocks.sh - Replace all mock console.log statements with gated versions

set -e

FILE="server.ts"

echo "🔒 Gating mock data responses in $FILE..."

# Replace "using mock" with gated version using sed
sed -i.bak \
  -e "s/console\.log('Database not available, using mock/console.warn('[DEMO_MOCKS] Database not available, using mock/g" \
  -e "s/console\.log('Database not available, adding/console.warn('[DEMO_MOCKS] Database not available, adding/g" \
  -e "s/console\.log('Database not available, updating/console.warn('[DEMO_MOCKS] Database not available, updating/g" \
  -e "s/console\.log('Database not available, removing/console.warn('[DEMO_MOCKS] Database not available, removing/g" \
  -e "s/console\.log('FHIR client not available, using mock/console.warn('[DEMO_MOCKS] FHIR client not available, using mock/g" \
  "$FILE"

echo "✅ Updated console.log statements to console.warn with [DEMO_MOCKS] prefix"
echo "⚠️  Note: Full gating logic requires manual if(FeatureFlags.DEMO_MOCKS) checks"
echo ""
echo "Backup created at: $FILE.bak"
