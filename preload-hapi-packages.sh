#!/bin/bash
# Preload HAPI FHIR IG Packages
# This script downloads all required IG packages to speed up validation

set -e

JAVA_HOME=/opt/homebrew/opt/openjdk@17
VALIDATOR_JAR="server/lib/validator_cli.jar"
CACHE_DIR="./server/cache/fhir-packages"
TX_CACHE="./server/cache/fhir-tx-cache"

# Create cache directories
mkdir -p "$CACHE_DIR"
mkdir -p "$TX_CACHE"

echo "════════════════════════════════════════════════════════════════"
echo "  HAPI FHIR Package Preloader"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "📦 Cache Directory: $CACHE_DIR"
echo "📦 TX Cache: $TX_CACHE"
echo ""

# MII Profile Packages
PACKAGES=(
  "de.medizininformatikinitiative.kerndatensatz.person#2025.0.1"
  "de.basisprofil.r4#1.5.0"
  "de.medizininformatikinitiative.kerndatensatz.meta#2025.0.1"
)

echo "📋 Packages to preload:"
for pkg in "${PACKAGES[@]}"; do
  echo "   - $pkg"
done
echo ""

# Create a minimal test patient
TEST_PATIENT=$(cat <<'EOF'
{
  "resourceType": "Patient",
  "id": "test",
  "meta": {
    "profile": ["https://www.medizininformatik-initiative.de/fhir/core/modul-person/StructureDefinition/Patient|2025.0.1"]
  },
  "identifier": [{
    "system": "http://example.org/test",
    "value": "test"
  }],
  "name": [{
    "family": "Test",
    "given": ["Test"]
  }],
  "gender": "unknown"
}
EOF
)

# Write test patient to temp file
TEST_FILE=$(mktemp /tmp/hapi-preload-XXXXXX.json)
echo "$TEST_PATIENT" > "$TEST_FILE"
echo "📝 Created test resource: $TEST_FILE"
echo ""

# Build IG package arguments
IG_ARGS=""
for pkg in "${PACKAGES[@]}"; do
  IG_ARGS="$IG_ARGS -ig $pkg"
done

echo "🔄 Starting package download..."
echo "   (This will take 30-60 seconds on first run)"
echo ""

# Run HAPI validator to trigger package download
"$JAVA_HOME/bin/java" -jar "$VALIDATOR_JAR" \
  "$TEST_FILE" \
  -version 4.0 \
  $IG_ARGS \
  -tx https://tx.fhir.org/r4 \
  -txCache "$TX_CACHE" \
  -level hints \
  -best-practice warning \
  2>&1 | while IFS= read -r line; do
    # Show progress
    if [[ "$line" =~ "Loading" ]] || [[ "$line" =~ "Fetch" ]] || [[ "$line" =~ "Download" ]] || [[ "$line" =~ "package" ]]; then
      echo "   📥 $line"
    elif [[ "$line" =~ "Error" ]] || [[ "$line" =~ "error" ]]; then
      echo "   ❌ $line"
    elif [[ "$line" =~ "Success" ]] || [[ "$line" =~ "done" ]]; then
      echo "   ✅ $line"
    fi
  done

# Cleanup
rm -f "$TEST_FILE"

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "✅ Package preload complete!"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "📊 Cache contents:"
ls -lh "$TX_CACHE" 2>/dev/null || echo "   (empty or not found)"
echo ""
echo "🚀 Next validation will be fast (packages are cached)"
echo ""

