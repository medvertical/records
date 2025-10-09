#!/bin/bash

# Setup HAPI FHIR Validator for Records Platform
# This script downloads the HAPI validator CLI JAR and verifies Java installation

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
LIB_DIR="$PROJECT_ROOT/server/lib"
JAR_FILE="$LIB_DIR/validator_cli.jar"
VALIDATOR_VERSION="6.3.23"
DOWNLOAD_URL="https://github.com/hapifhir/org.hl7.fhir.core/releases/download/${VALIDATOR_VERSION}/validator_cli.jar"

echo "=========================================="
echo "HAPI FHIR Validator Setup"
echo "=========================================="
echo ""

# Check if Java is installed
echo "Checking Java installation..."
if command -v java &> /dev/null; then
    JAVA_VERSION=$(java -version 2>&1 | head -1 | cut -d'"' -f2)
    echo "✅ Java is installed: $JAVA_VERSION"
else
    echo "❌ Java is not installed"
    echo ""
    echo "Please install Java 11 or higher:"
    echo "  macOS:   brew install openjdk@11"
    echo "  Ubuntu:  sudo apt-get install openjdk-11-jre"
    echo "  Windows: https://www.oracle.com/java/technologies/downloads/"
    echo ""
    exit 1
fi

# Create lib directory if it doesn't exist
mkdir -p "$LIB_DIR"

# Check if validator JAR already exists
if [ -f "$JAR_FILE" ]; then
    JAR_SIZE=$(du -h "$JAR_FILE" | cut -f1)
    echo "✅ Validator JAR already exists ($JAR_SIZE)"
    echo "   Location: $JAR_FILE"
    echo ""
    read -p "Do you want to re-download it? (y/N): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Skipping download."
        echo ""
    else
        rm "$JAR_FILE"
    fi
fi

# Download validator JAR if not present
if [ ! -f "$JAR_FILE" ]; then
    echo "Downloading HAPI FHIR Validator CLI..."
    echo "Version: $VALIDATOR_VERSION"
    echo "URL: $DOWNLOAD_URL"
    echo ""
    
    if command -v curl &> /dev/null; then
        curl -L -o "$JAR_FILE" "$DOWNLOAD_URL" --progress-bar
    elif command -v wget &> /dev/null; then
        wget -O "$JAR_FILE" "$DOWNLOAD_URL"
    else
        echo "❌ Neither curl nor wget is available. Please install one of them."
        exit 1
    fi
    
    echo ""
    echo "✅ Download complete"
    JAR_SIZE=$(du -h "$JAR_FILE" | cut -f1)
    echo "   Size: $JAR_SIZE"
    echo ""
fi

# Test validator
echo "Testing HAPI FHIR Validator..."
if java -jar "$JAR_FILE" -help > /dev/null 2>&1; then
    echo "✅ Validator is working correctly"
else
    echo "❌ Validator test failed"
    exit 1
fi

echo ""
echo "=========================================="
echo "Setup Complete!"
echo "=========================================="
echo ""
echo "Validator location: $JAR_FILE"
echo ""
echo "Next steps:"
echo "  1. Copy env.example.txt to .env and configure settings"
echo "  2. Run 'npm install' to install dependencies"
echo "  3. Run 'npm run dev' to start the development server"
echo ""
echo "For Docker deployment:"
echo "  docker-compose up -d"
echo ""
echo "Documentation:"
echo "  - server/lib/README.md"
echo "  - docs/technical/validation/HAPI_VALIDATOR_INTEGRATION_RESEARCH.md"
echo ""

