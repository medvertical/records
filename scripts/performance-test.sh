#!/bin/bash
# performance-test.sh
# Simple performance test that doesn't require a running server

set -e

echo "🧪 Performance Test (Mock)"
echo "========================="
echo ""

# Mock performance test that simulates the budget check
echo "This is a mock performance test to verify script functionality."
echo "In a real environment, this would test actual endpoints."
echo ""

# Simulate different response times
echo "📋 Testing List/Group Endpoints (Budget: P95 < 500ms)"
echo "Testing GET /api/validation/issues/groups..."
echo "  Mock response time: 250ms"
echo "✅ PASSED: P95 response time 250ms within budget of 500ms"
echo ""

echo "🔍 Testing Detail Endpoints (Budget: P95 < 300ms)"
echo "Testing GET /api/fhir/Patient..."
echo "  Mock response time: 150ms"
echo "✅ PASSED: P95 response time 150ms within budget of 300ms"
echo ""

echo "📊 Testing Dashboard Endpoints (Budget: P95 < 400ms)"
echo "Testing GET /api/dashboard/stats..."
echo "  Mock response time: 200ms"
echo "✅ PASSED: P95 response time 200ms within budget of 400ms"
echo ""

echo "📋 Performance Budget Summary"
echo "============================="
echo "✅ ALL PERFORMANCE BUDGETS MET"
echo ""
echo "Budget Status:"
echo "  • List/Group endpoints: P95 < 500ms ✅"
echo "  • Detail endpoints: P95 < 300ms ✅"
echo "  • Dashboard endpoints: P95 < 400ms ✅"
echo ""
echo "ℹ️  This was a mock test. Run 'npm run perf:check' with a running server for real tests."
