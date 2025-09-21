# End-to-End Tests for Records FHIR Validation Platform

This directory contains comprehensive end-to-end tests for the Records FHIR Validation Platform using Playwright.

## Test Coverage

The E2E tests cover the complete validation workflow from user interaction through the entire system:

### 1. **Validation Workflow Tests** (`validation-workflow.e2e.test.ts`)
- **Complete Validation Workflow**: Server connection → Resource browsing → Page validation → Results viewing → Settings configuration → Settings impact → Resource details → Dashboard statistics
- **Error Scenarios**: Network failures, API errors, validation failures
- **Concurrent Operations**: Multiple validation operations running simultaneously
- **Performance Tests**: Large datasets, rapid interactions, concurrent operations
- **Accessibility Tests**: Keyboard navigation, ARIA labels, color contrast

### 2. **Validation Settings Workflow Tests** (`validation-settings-workflow.e2e.test.ts`)
- **Settings Management**: Navigation → Configuration → Save → Verification → Real-time updates → Settings impact → Rollback → Audit trail
- **Error Handling**: Network failures, save errors, validation errors
- **Concurrent Settings**: Multiple users changing settings simultaneously
- **Performance Tests**: Rapid settings changes, polling efficiency
- **Accessibility Tests**: Keyboard navigation, ARIA labels, form validation

### 3. **Dashboard Analytics Workflow Tests** (`dashboard-analytics-workflow.e2e.test.ts`)
- **Dashboard Analytics**: Navigation → Server statistics → Validation statistics → Aspect breakdown → Settings impact → Real-time updates → Queue management → Individual progress → Cancellation controls
- **Error Handling**: API failures, dashboard load errors
- **Performance Tests**: Large datasets, real-time updates, rapid navigation
- **Accessibility Tests**: Keyboard navigation, ARIA labels, color contrast

## Prerequisites

1. **Node.js**: Version 18 or higher
2. **Playwright**: Installed via npm
3. **Application**: Records FHIR Validation Platform running on `http://localhost:5173`
4. **Database**: PostgreSQL database with test data
5. **FHIR Server**: Accessible FHIR server for testing (e.g., `https://server.fire.ly`)

## Installation

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Install Playwright browsers**:
   ```bash
   npm run test:e2e:install
   ```

3. **Start the application**:
   ```bash
   npm run dev:full
   ```

## Running Tests

### Basic Commands

```bash
# Run all E2E tests
npm run test:e2e

# Run E2E tests with UI
npm run test:e2e:ui

# Run E2E tests in headed mode (see browser)
npm run test:e2e:headed

# Debug E2E tests
npm run test:e2e:debug
```

### Specific Test Suites

```bash
# Run only validation workflow tests
npx playwright test validation-workflow.e2e.test.ts

# Run only validation settings tests
npx playwright test validation-settings-workflow.e2e.test.ts

# Run only dashboard analytics tests
npx playwright test dashboard-analytics-workflow.e2e.test.ts
```

### Browser-Specific Tests

```bash
# Run tests in Chrome only
npx playwright test --project=chromium

# Run tests in Firefox only
npx playwright test --project=firefox

# Run tests in Safari only
npx playwright test --project=webkit

# Run tests on mobile devices
npx playwright test --project="Mobile Chrome"
npx playwright test --project="Mobile Safari"
```

## Test Configuration

### Environment Variables

- `E2E_BASE_URL`: Base URL for the application (default: `http://localhost:5173`)
- `CI`: Set to `true` in CI environments for different retry/timeout settings

### Playwright Configuration

The tests are configured in `playwright.config.ts` with:

- **Parallel execution**: Tests run in parallel for faster execution
- **Retry logic**: 2 retries on CI, 0 locally
- **Timeouts**: 60s global timeout, 30s action timeout
- **Reporting**: HTML, JSON, and JUnit reports
- **Screenshots**: On failure only
- **Videos**: Retained on failure
- **Traces**: On first retry

### Test Data Requirements

The tests expect:

1. **FHIR Server**: Accessible server with test resources
2. **Database**: Clean test database with proper schema
3. **Application**: Fully functional application with all features enabled

## Test Structure

### Page Object Model

Tests use Playwright's built-in page object model:

- **Page objects**: Encapsulate page interactions
- **Test data**: Centralized test data management
- **Utilities**: Common test utilities and helpers

### Test Categories

1. **Happy Path Tests**: Complete workflows without errors
2. **Error Handling Tests**: Network failures, API errors, validation errors
3. **Performance Tests**: Large datasets, rapid interactions, concurrent operations
4. **Accessibility Tests**: Keyboard navigation, ARIA labels, color contrast
5. **Cross-browser Tests**: Chrome, Firefox, Safari, mobile browsers

### Test Data Management

- **Mock Data**: Uses realistic FHIR resource data
- **Test Isolation**: Each test runs independently
- **Cleanup**: Automatic cleanup after tests
- **State Management**: Proper state management between tests

## Debugging Tests

### Debug Mode

```bash
# Run tests in debug mode
npm run test:e2e:debug

# Debug specific test
npx playwright test validation-workflow.e2e.test.ts --debug
```

### Debugging Tips

1. **Use headed mode**: `npm run test:e2e:headed` to see browser
2. **Add breakpoints**: Use `await page.pause()` in tests
3. **Slow down tests**: Use `await page.waitForTimeout(1000)` for debugging
4. **Check console logs**: Look for console errors in browser
5. **Use trace viewer**: Enable traces in `playwright.config.ts`

### Common Issues

1. **Timeout errors**: Increase timeout in configuration
2. **Element not found**: Check selectors and wait conditions
3. **Network errors**: Verify server is running and accessible
4. **Database errors**: Ensure test database is properly set up
5. **FHIR server errors**: Verify FHIR server is accessible and has test data

## Continuous Integration

### GitHub Actions

```yaml
name: E2E Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: npm ci
      - run: npm run test:e2e:install
      - run: npm run dev:full &
      - run: npm run test:e2e
        env:
          CI: true
```

### Test Reports

Tests generate multiple report formats:

- **HTML Report**: Interactive HTML report with screenshots and videos
- **JSON Report**: Machine-readable JSON report for CI integration
- **JUnit Report**: Standard JUnit XML report for CI systems

## Maintenance

### Updating Tests

1. **Keep tests up-to-date** with application changes
2. **Update selectors** when UI changes
3. **Add new test cases** for new features
4. **Remove obsolete tests** for removed features

### Test Data

1. **Maintain test data** consistency across environments
2. **Update test data** when FHIR server changes
3. **Add new test scenarios** for new validation aspects
4. **Clean up test data** regularly

### Performance

1. **Monitor test execution time** and optimize slow tests
2. **Use parallel execution** for faster test runs
3. **Optimize selectors** for better performance
4. **Reduce test data** size where possible

## Best Practices

### Test Design

1. **Independent tests**: Each test should run independently
2. **Clear assertions**: Use descriptive assertions and error messages
3. **Proper waits**: Use appropriate wait conditions
4. **Error handling**: Test both happy path and error scenarios

### Selectors

1. **Use data-testid**: Prefer `data-testid` attributes for selectors
2. **Avoid brittle selectors**: Don't use CSS classes or text content
3. **Stable selectors**: Use selectors that won't change frequently
4. **Semantic selectors**: Use semantic HTML elements where possible

### Performance

1. **Parallel execution**: Run tests in parallel for faster execution
2. **Efficient waits**: Use specific wait conditions instead of timeouts
3. **Minimize page loads**: Reuse pages where possible
4. **Optimize test data**: Use minimal test data for faster execution

### Maintenance

1. **Regular updates**: Keep tests updated with application changes
2. **Documentation**: Document test scenarios and requirements
3. **Code review**: Review test code like production code
4. **Monitoring**: Monitor test stability and performance

## Troubleshooting

### Common Issues

1. **Tests failing intermittently**: Check for race conditions and timing issues
2. **Element not found**: Verify selectors and wait conditions
3. **Network timeouts**: Check server connectivity and response times
4. **Database errors**: Verify test database setup and data

### Debugging Steps

1. **Check logs**: Look at application and test logs
2. **Run in headed mode**: Use `--headed` to see browser interactions
3. **Use debug mode**: Use `--debug` for step-by-step debugging
4. **Check screenshots**: Review failure screenshots for clues
5. **Verify environment**: Ensure all prerequisites are met

### Getting Help

1. **Check documentation**: Review Playwright and test documentation
2. **Review test logs**: Look at detailed test execution logs
3. **Check CI reports**: Review CI test reports for patterns
4. **Ask for help**: Reach out to the development team for assistance

## Contributing

### Adding New Tests

1. **Follow existing patterns**: Use similar structure to existing tests
2. **Add proper documentation**: Document new test scenarios
3. **Update this README**: Add new tests to documentation
4. **Test locally**: Ensure tests pass locally before submitting

### Test Guidelines

1. **Use descriptive names**: Test names should clearly describe what they test
2. **Keep tests focused**: Each test should test one specific scenario
3. **Use proper assertions**: Use appropriate assertions for the test scenario
4. **Handle errors gracefully**: Test both success and failure scenarios

### Code Review

1. **Review test logic**: Ensure test logic is correct and comprehensive
2. **Check selectors**: Verify selectors are stable and appropriate
3. **Review performance**: Ensure tests don't unnecessarily slow down test suite
4. **Verify documentation**: Ensure documentation is updated for new tests
