#!/bin/bash

# ============================================================================
# Dashboard Restore Script - Restore new modular dashboard
# ============================================================================

set -e

echo "🚀 Dashboard Restore Script"
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

# Check if new dashboard backup exists
if [ ! -f "client/src/pages/Dashboard.tsx.new.backup" ]; then
    print_error "New dashboard backup not found: client/src/pages/Dashboard.tsx.new.backup"
    print_error "Cannot restore new dashboard without backup file"
    print_error "Please ensure the new dashboard was deployed and backed up"
    exit 1
fi

print_status "Found new dashboard backup: client/src/pages/Dashboard.tsx.new.backup"

# Create backup of current dashboard (in case it's the legacy one)
if [ -f "client/src/pages/Dashboard.tsx" ]; then
    print_status "Creating backup of current dashboard..."
    cp "client/src/pages/Dashboard.tsx" "client/src/pages/Dashboard.tsx.legacy.backup"
    print_status "Current dashboard backed up to: client/src/pages/Dashboard.tsx.legacy.backup"
fi

# Restore the new modular dashboard
print_status "Restoring new modular dashboard..."
cp "client/src/pages/Dashboard.tsx.new.backup" "client/src/pages/Dashboard.tsx"
print_status "New modular dashboard restored"

# Restore the updated App.tsx if backup exists
if [ -f "client/src/App.tsx.new.backup" ]; then
    print_status "Restoring updated App.tsx..."
    cp "client/src/App.tsx.new.backup" "client/src/App.tsx"
    print_status "Updated App.tsx restored"
else
    print_warning "App.tsx backup not found. You may need to manually update App.tsx for new dashboard"
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

print_status "✅ New dashboard restore completed successfully!"
print_status "The application is now using the new modular dashboard implementation"
print_warning "Note: You may need to restart your development server"

echo ""
echo "Restore Summary:"
echo "- New modular dashboard restored from backup"
echo "- App.tsx updated for new dashboard (if backup existed)"
echo "- Dependencies reinstalled"
echo "- Application rebuilt"
echo ""
echo "To rollback to legacy dashboard, run:"
echo "  ./scripts/dashboard-rollback.sh"
