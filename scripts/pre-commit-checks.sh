#!/bin/bash
# pre-commit-checks.sh
# Runs before each commit to catch common issues

set -e

echo "🔍 Running pre-commit checks..."
echo ""

# Check 1: TypeScript compilation
echo "1️⃣  TypeScript type check..."
if ! npx tsc --noEmit; then
  echo "❌ TypeScript errors found. Fix them before committing."
  exit 1
fi
echo "✅ TypeScript OK"
echo ""

# Check 2: Linting
echo "2️⃣  Linting..."
if ! npm run lint --silent; then
  echo "⚠️  Linting issues found. Run 'npm run lint:fix' to auto-fix."
  exit 1
fi
echo "✅ Linting OK"
echo ""

# Check 3: Hardcoded URLs
echo "3️⃣  Checking for hardcoded FHIR URLs..."
URLS=$(grep -r "hapi\.fhir\.org" \
  --exclude-dir=node_modules \
  --exclude-dir=.git \
  --exclude="*.test.ts" \
  --exclude="*.md" \
  --exclude="pre-commit-checks.sh" \
  . || true)

if [ -n "$URLS" ]; then
  echo "⚠️  Found hardcoded URLs (may be acceptable in tests/docs):"
  echo "$URLS"
  echo ""
  echo "If these are in production code, please remove them."
  # Don't fail on this check, just warn
fi
echo "✅ URL check complete"
echo ""

# Check 4: DEMO_MOCKS flag
echo "4️⃣  Checking for ungated DEMO_MOCKS..."
UNGATED=$(grep -r "DEMO_MOCKS.*=.*true" \
  --exclude-dir=node_modules \
  --exclude-dir=.git \
  --exclude="*.md" \
  --exclude="feature-flags.ts" \
  --exclude="pre-commit-checks.sh" \
  . || true)

if [ -n "$UNGATED" ]; then
  echo "❌ Found DEMO_MOCKS=true in code:"
  echo "$UNGATED"
  echo ""
  echo "DEMO_MOCKS should only be set via environment variables, not in code."
  exit 1
fi
echo "✅ No hardcoded DEMO_MOCKS=true"
echo ""

# Check 5: Secrets
echo "5️⃣  Checking for accidentally committed secrets..."
SECRETS=$(grep -r "sk_live_\|sk_test_\|password.*=.*['\"].*['\"]" \
  --exclude-dir=node_modules \
  --exclude-dir=.git \
  --exclude="*.md" \
  --exclude="pre-commit-checks.sh" \
  . || true)

if [ -n "$SECRETS" ]; then
  echo "⚠️  Potential secrets found:"
  echo "$SECRETS"
  echo ""
  echo "Review these carefully before committing."
  # Don't fail, just warn
fi
echo "✅ Secret check complete"
echo ""

echo "✅ All pre-commit checks passed!"
echo ""
