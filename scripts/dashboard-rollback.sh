#!/bin/bash

# ============================================================================
# Dashboard Rollback Script - Rollback to legacy dashboard if needed
# ============================================================================

set -e

echo "🔄 Dashboard Rollback Script"
echo "================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if backup exists
if [ ! -f "client/src/pages/Dashboard.tsx.backup" ]; then
    print_error "Backup file not found: client/src/pages/Dashboard.tsx.backup"
    print_error "Cannot perform rollback without backup file"
    exit 1
fi

print_status "Found backup file: client/src/pages/Dashboard.tsx.backup"

# Create backup of current new dashboard
if [ -f "client/src/pages/Dashboard.tsx" ]; then
    print_status "Creating backup of current new dashboard..."
    cp "client/src/pages/Dashboard.tsx" "client/src/pages/Dashboard.tsx.new.backup"
    print_status "New dashboard backed up to: client/src/pages/Dashboard.tsx.new.backup"
fi

# Restore the legacy dashboard
print_status "Restoring legacy dashboard..."
cp "client/src/pages/Dashboard.tsx.backup" "client/src/pages/Dashboard.tsx"
print_status "Legacy dashboard restored"

# Restore the legacy App.tsx if backup exists
if [ -f "client/src/App.tsx.backup" ]; then
    print_status "Restoring legacy App.tsx..."
    cp "client/src/App.tsx.backup" "client/src/App.tsx"
    print_status "Legacy App.tsx restored"
else
    print_warning "App.tsx backup not found. You may need to manually revert App.tsx changes"
fi

# Clean up node_modules and reinstall if needed
print_status "Cleaning up dependencies..."
if [ -d "node_modules" ]; then
    rm -rf node_modules
fi

if [ -f "package-lock.json" ]; then
    rm package-lock.json
fi

print_status "Installing dependencies..."
npm install

print_status "Building application..."
npm run build

print_status "✅ Dashboard rollback completed successfully!"
print_status "The application is now using the legacy dashboard implementation"
print_warning "Note: You may need to restart your development server"

echo ""
echo "Rollback Summary:"
echo "- Legacy dashboard restored from backup"
echo "- App.tsx reverted to legacy configuration (if backup existed)"
echo "- Dependencies reinstalled"
echo "- Application rebuilt"
echo ""
echo "To re-enable the new dashboard, run:"
echo "  ./scripts/dashboard-restore.sh"
