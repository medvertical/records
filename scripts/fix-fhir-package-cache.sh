#!/bin/bash

# Fix FHIR Package Cache - Remove Corrupted Packages
# 
# This script clears potentially corrupted FHIR packages from the cache.
# HAPI will automatically re-download clean versions when needed.
#
# Usage:
#   bash scripts/fix-fhir-package-cache.sh [option]
#
# Options:
#   mii-only    - Clear only German MII packages (recommended)
#   all         - Clear entire package cache (nuclear option)
#   list        - List all cached packages

set -e

CACHE_DIR="${HOME}/.fhir/packages"
BACKUP_DIR="${HOME}/.fhir/packages-backup-$(date +%Y%m%d-%H%M%S)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "======================================"
echo "FHIR Package Cache Repair Tool"
echo "======================================"
echo ""

# Check if cache directory exists
if [ ! -d "$CACHE_DIR" ]; then
    echo -e "${YELLOW}Warning: FHIR package cache not found at $CACHE_DIR${NC}"
    echo "Cache will be created automatically when HAPI validator runs."
    exit 0
fi

# Function to list packages
list_packages() {
    echo "Cached FHIR packages:"
    echo "------------------------------------"
    ls -1 "$CACHE_DIR" | sort
    echo "------------------------------------"
    echo "Total packages: $(ls -1 "$CACHE_DIR" | wc -l)"
}

# Function to backup cache
backup_cache() {
    echo -e "${YELLOW}Creating backup at: $BACKUP_DIR${NC}"
    mkdir -p "$BACKUP_DIR"
    cp -R "$CACHE_DIR"/* "$BACKUP_DIR/" 2>/dev/null || true
    echo -e "${GREEN}✓ Backup created${NC}"
    echo ""
}

# Function to clear MII packages
clear_mii_packages() {
    echo "Clearing German MII packages..."
    echo "------------------------------------"
    
    local removed=0
    
    # Remove MII packages
    for pkg in "$CACHE_DIR"/de.medizininformatikinitiative.* "$CACHE_DIR"/de.basisprofil.r4*; do
        if [ -d "$pkg" ]; then
            echo "  Removing: $(basename "$pkg")"
            rm -rf "$pkg"
            ((removed++))
        fi
    done
    
    echo "------------------------------------"
    echo -e "${GREEN}✓ Removed $removed package(s)${NC}"
    echo ""
    echo "HAPI will automatically re-download clean versions when needed."
}

# Function to clear all packages
clear_all_packages() {
    echo -e "${RED}WARNING: This will remove ALL cached FHIR packages!${NC}"
    echo "HAPI will need to re-download them (may take several minutes)."
    echo ""
    read -p "Are you sure? (yes/no): " -r
    echo ""
    
    if [[ $REPLY =~ ^[Yy]es$ ]]; then
        echo "Clearing all packages..."
        echo "------------------------------------"
        
        local count=$(ls -1 "$CACHE_DIR" | wc -l)
        rm -rf "$CACHE_DIR"/*
        
        echo "------------------------------------"
        echo -e "${GREEN}✓ Removed $count package(s)${NC}"
        echo ""
        echo "HAPI will automatically re-download packages when needed."
    else
        echo "Cancelled."
        exit 0
    fi
}

# Parse command line argument
case "${1:-mii-only}" in
    list)
        list_packages
        ;;
    
    mii-only)
        echo "Mode: Clear German MII packages only (recommended)"
        echo ""
        list_packages
        echo ""
        backup_cache
        clear_mii_packages
        echo -e "${GREEN}Done!${NC}"
        echo ""
        echo "If you need to restore the backup:"
        echo "  cp -R $BACKUP_DIR/* $CACHE_DIR/"
        ;;
    
    all)
        echo "Mode: Clear ALL packages (nuclear option)"
        echo ""
        list_packages
        echo ""
        backup_cache
        clear_all_packages
        echo -e "${GREEN}Done!${NC}"
        echo ""
        echo "If you need to restore the backup:"
        echo "  cp -R $BACKUP_DIR/* $CACHE_DIR/"
        ;;
    
    *)
        echo "Usage: $0 [option]"
        echo ""
        echo "Options:"
        echo "  mii-only    - Clear only German MII packages (default, recommended)"
        echo "  all         - Clear entire package cache"
        echo "  list        - List all cached packages"
        echo ""
        exit 1
        ;;
esac

