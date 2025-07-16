#!/bin/bash

echo "Testing validation settings on individual resources..."

# Get a sample resource
RESOURCE=$(curl -s http://localhost:5000/api/fhir/resources?count=1 | jq -r '.resources[0]')

if [ -z "$RESOURCE" ] || [ "$RESOURCE" = "null" ]; then
  echo "Failed to get a test resource"
  exit 1
fi

echo "Test resource:"
echo "$RESOURCE" | jq '.data.resourceType, .data.id' | head -2

# Test 1: All validations enabled
echo -e "\n1. Testing with ALL validations enabled..."
curl -s -X POST http://localhost:5000/api/validation/settings \
  -H "Content-Type: application/json" \
  -d '{
    "enableStructuralValidation": true,
    "enableProfileValidation": true,
    "enableTerminologyValidation": true,
    "enableReferenceValidation": true,
    "enableBusinessRuleValidation": true,
    "enableMetadataValidation": true
  }' > /dev/null

# Validate the resource
RESULT_ALL=$(curl -s -X POST http://localhost:5000/api/validation/test-settings \
  -H "Content-Type: application/json" \
  -d "{\"resource\": $(echo "$RESOURCE" | jq '.data')}")

echo "Issues found with all validations: $(echo "$RESULT_ALL" | jq '.validationResults[0].issues | length')"

# Test 2: Only structural validation enabled
echo -e "\n2. Testing with ONLY structural validation enabled..."
curl -s -X POST http://localhost:5000/api/validation/settings \
  -H "Content-Type: application/json" \
  -d '{
    "enableStructuralValidation": true,
    "enableProfileValidation": false,
    "enableTerminologyValidation": false,
    "enableReferenceValidation": false,
    "enableBusinessRuleValidation": false,
    "enableMetadataValidation": false
  }' > /dev/null

# Validate the resource again
RESULT_STRUCTURAL=$(curl -s -X POST http://localhost:5000/api/validation/test-settings \
  -H "Content-Type: application/json" \
  -d "{\"resource\": $(echo "$RESOURCE" | jq '.data')}")

echo "Issues found with only structural: $(echo "$RESULT_STRUCTURAL" | jq '.validationResults[0].issues | length')"

# Compare results
ALL_COUNT=$(echo "$RESULT_ALL" | jq '.validationResults[0].issues | length')
STRUCTURAL_COUNT=$(echo "$RESULT_STRUCTURAL" | jq '.validationResults[0].issues | length')

echo -e "\nValidation Settings Test Results:"
echo "================================="
echo "Issues with all validations: $ALL_COUNT"
echo "Issues with only structural: $STRUCTURAL_COUNT"

if [ "$ALL_COUNT" -gt "$STRUCTURAL_COUNT" ]; then
  echo -e "\n✅ SUCCESS: Validation settings are properly applied!"
  echo "   Disabling validation aspects reduces the number of issues found."
else
  echo -e "\n❌ FAILED: Validation settings may not be working correctly."
  echo "   The number of issues should decrease when validations are disabled."
fi

# Show issue categories
echo -e "\nIssue categories with all validations:"
echo "$RESULT_ALL" | jq -r '.validationResults[0].issues[].category' | sort | uniq -c

echo -e "\nIssue categories with only structural:"
echo "$RESULT_STRUCTURAL" | jq -r '.validationResults[0].issues[].category' | sort | uniq -c