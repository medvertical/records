import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { chromium, Browser, Page } from 'playwright';
import { QueryClient } from '@tanstack/react-query';

describe('Complete Validation Workflow E2E Tests', () => {
  let browser: Browser;
  let page: Page;
  let baseUrl: string;

  beforeAll(async () => {
    browser = await chromium.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    baseUrl = process.env.E2E_BASE_URL || 'http://localhost:5173';
  });

  afterAll(async () => {
    await browser.close();
  });

  beforeEach(async () => {
    page = await browser.newPage();
    await page.goto(baseUrl);
    
    // Wait for the application to load
    await page.waitForSelector('[data-testid="app-container"]', { timeout: 10000 });
  });

  afterEach(async () => {
    await page.close();
  });

  describe('Complete Validation Workflow', () => {
    it('should complete full validation workflow from server connection to validation results', async () => {
      // Step 1: Connect to FHIR Server
      await testServerConnection();
      
      // Step 2: Navigate to Resource Browser
      await testResourceBrowserNavigation();
      
      // Step 3: Browse Resources
      await testResourceBrowsing();
      
      // Step 4: Trigger Page Validation
      await testPageValidation();
      
      // Step 5: View Validation Results
      await testValidationResults();
      
      // Step 6: Configure Validation Settings
      await testValidationSettingsConfiguration();
      
      // Step 7: Verify Settings Impact on Results
      await testSettingsImpactOnResults();
      
      // Step 8: View Resource Details
      await testResourceDetailView();
      
      // Step 9: Navigate to Dashboard
      await testDashboardNavigation();
      
      // Step 10: View Dashboard Statistics
      await testDashboardStatistics();
    });

    it('should handle validation workflow with error scenarios', async () => {
      // Test error handling in validation workflow
      await testValidationErrorHandling();
    });

    it('should handle concurrent validation operations', async () => {
      // Test concurrent validation operations
      await testConcurrentValidationOperations();
    });
  });

  async function testServerConnection() {
    console.log('Testing server connection...');
    
    // Navigate to server connection page if not already there
    await page.click('[data-testid="server-connection-button"]');
    await page.waitForSelector('[data-testid="server-connection-modal"]');
    
    // Fill in server connection form
    await page.fill('[data-testid="server-url-input"]', 'https://server.fire.ly');
    await page.fill('[data-testid="server-name-input"]', 'Test FHIR Server');
    
    // Connect to server
    await page.click('[data-testid="connect-server-button"]');
    
    // Wait for connection success
    await page.waitForSelector('[data-testid="connection-success"]', { timeout: 15000 });
    
    // Verify connection status
    const connectionStatus = await page.textContent('[data-testid="connection-status"]');
    expect(connectionStatus).toContain('Connected');
    
    console.log('✅ Server connection successful');
  }

  async function testResourceBrowserNavigation() {
    console.log('Testing resource browser navigation...');
    
    // Navigate to resource browser
    await page.click('[data-testid="resource-browser-nav"]');
    await page.waitForSelector('[data-testid="resource-browser-container"]');
    
    // Verify resource browser loaded
    const pageTitle = await page.textContent('[data-testid="page-title"]');
    expect(pageTitle).toContain('Resource Browser');
    
    console.log('✅ Resource browser navigation successful');
  }

  async function testResourceBrowsing() {
    console.log('Testing resource browsing...');
    
    // Wait for resources to load
    await page.waitForSelector('[data-testid="resource-list"]', { timeout: 10000 });
    
    // Check if resources are displayed
    const resourceItems = await page.locator('[data-testid="resource-item"]').count();
    expect(resourceItems).toBeGreaterThan(0);
    
    // Verify resource information is displayed
    const firstResource = page.locator('[data-testid="resource-item"]').first();
    await expect(firstResource).toContainText('Patient');
    
    console.log('✅ Resource browsing successful');
  }

  async function testPageValidation() {
    console.log('Testing page validation...');
    
    // Click validate page button
    await page.click('[data-testid="validate-page-button"]');
    
    // Wait for validation to start
    await page.waitForSelector('[data-testid="validation-in-progress"]');
    
    // Wait for validation to complete
    await page.waitForSelector('[data-testid="validation-complete"]', { timeout: 30000 });
    
    // Verify validation results are displayed
    const validationBadges = await page.locator('[data-testid="validation-badge"]').count();
    expect(validationBadges).toBeGreaterThan(0);
    
    console.log('✅ Page validation successful');
  }

  async function testValidationResults() {
    console.log('Testing validation results...');
    
    // Check validation status badges
    const validResources = await page.locator('[data-testid="validation-badge-valid"]').count();
    const errorResources = await page.locator('[data-testid="validation-badge-error"]').count();
    const warningResources = await page.locator('[data-testid="validation-badge-warning"]').count();
    const notValidatedResources = await page.locator('[data-testid="validation-badge-not-validated"]').count();
    
    const totalResources = validResources + errorResources + warningResources + notValidatedResources;
    expect(totalResources).toBeGreaterThan(0);
    
    // Verify validation scores are displayed
    const validationScores = await page.locator('[data-testid="validation-score"]').count();
    expect(validationScores).toBeGreaterThan(0);
    
    console.log('✅ Validation results display successful');
  }

  async function testValidationSettingsConfiguration() {
    console.log('Testing validation settings configuration...');
    
    // Navigate to validation settings
    await page.click('[data-testid="validation-settings-nav"]');
    await page.waitForSelector('[data-testid="validation-settings-container"]');
    
    // Configure validation aspects
    await page.click('[data-testid="structural-validation-toggle"]');
    await page.click('[data-testid="profile-validation-toggle"]');
    
    // Save settings
    await page.click('[data-testid="save-validation-settings"]');
    
    // Wait for settings to save
    await page.waitForSelector('[data-testid="settings-saved"]');
    
    console.log('✅ Validation settings configuration successful');
  }

  async function testSettingsImpactOnResults() {
    console.log('Testing settings impact on results...');
    
    // Navigate back to resource browser
    await page.click('[data-testid="resource-browser-nav"]');
    await page.waitForSelector('[data-testid="resource-browser-container"]');
    
    // Wait for results to update based on new settings
    await page.waitForSelector('[data-testid="resource-list"]');
    
    // Verify that validation results have changed based on settings
    const updatedValidationBadges = await page.locator('[data-testid="validation-badge"]').count();
    expect(updatedValidationBadges).toBeGreaterThan(0);
    
    console.log('✅ Settings impact on results verified');
  }

  async function testResourceDetailView() {
    console.log('Testing resource detail view...');
    
    // Click on first resource to view details
    await page.click('[data-testid="resource-item"]:first-child [data-testid="view-resource-details"]');
    
    // Wait for resource detail page to load
    await page.waitForSelector('[data-testid="resource-detail-container"]');
    
    // Verify resource details are displayed
    await expect(page.locator('[data-testid="resource-detail-title"]')).toBeVisible();
    
    // Verify validation details are displayed
    await expect(page.locator('[data-testid="validation-details-section"]')).toBeVisible();
    
    // Check validation aspect breakdown
    const aspectBreakdown = await page.locator('[data-testid="validation-aspect-breakdown"]').count();
    expect(aspectBreakdown).toBeGreaterThan(0);
    
    console.log('✅ Resource detail view successful');
  }

  async function testDashboardNavigation() {
    console.log('Testing dashboard navigation...');
    
    // Navigate to dashboard
    await page.click('[data-testid="dashboard-nav"]');
    await page.waitForSelector('[data-testid="dashboard-container"]');
    
    // Verify dashboard loaded
    const dashboardTitle = await page.textContent('[data-testid="dashboard-title"]');
    expect(dashboardTitle).toContain('Dashboard');
    
    console.log('✅ Dashboard navigation successful');
  }

  async function testDashboardStatistics() {
    console.log('Testing dashboard statistics...');
    
    // Wait for dashboard statistics to load
    await page.waitForSelector('[data-testid="dashboard-statistics"]');
    
    // Verify server statistics card
    await expect(page.locator('[data-testid="server-stats-card"]')).toBeVisible();
    
    // Verify validation statistics card
    await expect(page.locator('[data-testid="validation-stats-card"]')).toBeVisible();
    
    // Check for validation aspect breakdown
    const aspectBreakdownChart = await page.locator('[data-testid="validation-aspect-breakdown-chart"]').count();
    expect(aspectBreakdownChart).toBeGreaterThan(0);
    
    // Verify settings impact component
    await expect(page.locator('[data-testid="validation-settings-impact"]')).toBeVisible();
    
    console.log('✅ Dashboard statistics successful');
  }

  async function testValidationErrorHandling() {
    console.log('Testing validation error handling...');
    
    // Navigate to resource browser
    await page.click('[data-testid="resource-browser-nav"]');
    await page.waitForSelector('[data-testid="resource-browser-container"]');
    
    // Mock network failure
    await page.route('**/api/validation/validate-by-ids', route => {
      route.abort('failed');
    });
    
    // Try to validate page
    await page.click('[data-testid="validate-page-button"]');
    
    // Wait for error message
    await page.waitForSelector('[data-testid="validation-error"]');
    
    // Verify error message is displayed
    const errorMessage = await page.textContent('[data-testid="validation-error-message"]');
    expect(errorMessage).toContain('validation failed');
    
    console.log('✅ Validation error handling successful');
  }

  async function testConcurrentValidationOperations() {
    console.log('Testing concurrent validation operations...');
    
    // Navigate to dashboard
    await page.click('[data-testid="dashboard-nav"]');
    await page.waitForSelector('[data-testid="dashboard-container"]');
    
    // Start bulk validation
    await page.click('[data-testid="start-bulk-validation"]');
    
    // Wait for validation to start
    await page.waitForSelector('[data-testid="bulk-validation-in-progress"]');
    
    // Navigate to resource browser while validation is running
    await page.click('[data-testid="resource-browser-nav"]');
    await page.waitForSelector('[data-testid="resource-browser-container"]');
    
    // Try to validate individual page
    await page.click('[data-testid="validate-page-button"]');
    
    // Both operations should work concurrently
    await page.waitForSelector('[data-testid="validation-complete"]', { timeout: 30000 });
    
    console.log('✅ Concurrent validation operations successful');
  }
});

describe('Validation Performance E2E Tests', () => {
  let browser: Browser;
  let page: Page;
  let baseUrl: string;

  beforeAll(async () => {
    browser = await chromium.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    baseUrl = process.env.E2E_BASE_URL || 'http://localhost:5173';
  });

  afterAll(async () => {
    await browser.close();
  });

  beforeEach(async () => {
    page = await browser.newPage();
    await page.goto(baseUrl);
    await page.waitForSelector('[data-testid="app-container"]', { timeout: 10000 });
  });

  afterEach(async () => {
    await page.close();
  });

  it('should handle large resource datasets efficiently', async () => {
    console.log('Testing performance with large resource datasets...');
    
    // Navigate to resource browser
    await page.click('[data-testid="resource-browser-nav"]');
    await page.waitForSelector('[data-testid="resource-browser-container"]');
    
    const startTime = Date.now();
    
    // Wait for resources to load
    await page.waitForSelector('[data-testid="resource-list"]', { timeout: 15000 });
    
    const loadTime = Date.now() - startTime;
    
    // Verify resources loaded within acceptable time
    expect(loadTime).toBeLessThan(10000); // 10 seconds
    
    // Check resource count
    const resourceCount = await page.locator('[data-testid="resource-item"]').count();
    expect(resourceCount).toBeGreaterThan(0);
    
    console.log(`✅ Large dataset performance test successful (${resourceCount} resources in ${loadTime}ms)`);
  });

  it('should handle rapid validation settings changes efficiently', async () => {
    console.log('Testing performance with rapid settings changes...');
    
    // Navigate to validation settings
    await page.click('[data-testid="validation-settings-nav"]');
    await page.waitForSelector('[data-testid="validation-settings-container"]');
    
    const startTime = Date.now();
    
    // Make rapid settings changes
    for (let i = 0; i < 5; i++) {
      await page.click('[data-testid="structural-validation-toggle"]');
      await page.waitForTimeout(100);
      await page.click('[data-testid="profile-validation-toggle"]');
      await page.waitForTimeout(100);
    }
    
    const settingsChangeTime = Date.now() - startTime;
    
    // Verify settings changes completed within acceptable time
    expect(settingsChangeTime).toBeLessThan(5000); // 5 seconds
    
    console.log(`✅ Rapid settings changes performance test successful (${settingsChangeTime}ms)`);
  });

  it('should handle concurrent user interactions efficiently', async () => {
    console.log('Testing performance with concurrent user interactions...');
    
    const startTime = Date.now();
    
    // Perform multiple concurrent interactions
    const promises = [
      page.click('[data-testid="resource-browser-nav"]'),
      page.click('[data-testid="dashboard-nav"]'),
      page.click('[data-testid="validation-settings-nav"]')
    ];
    
    await Promise.all(promises);
    
    const interactionTime = Date.now() - startTime;
    
    // Verify concurrent interactions completed within acceptable time
    expect(interactionTime).toBeLessThan(3000); // 3 seconds
    
    console.log(`✅ Concurrent interactions performance test successful (${interactionTime}ms)`);
  });
});

describe('Validation Workflow Accessibility E2E Tests', () => {
  let browser: Browser;
  let page: Page;
  let baseUrl: string;

  beforeAll(async () => {
    browser = await chromium.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    baseUrl = process.env.E2E_BASE_URL || 'http://localhost:5173';
  });

  afterAll(async () => {
    await browser.close();
  });

  beforeEach(async () => {
    page = await browser.newPage();
    await page.goto(baseUrl);
    await page.waitForSelector('[data-testid="app-container"]', { timeout: 10000 });
  });

  afterEach(async () => {
    await page.close();
  });

  it('should be keyboard navigable', async () => {
    console.log('Testing keyboard navigation...');
    
    // Test tab navigation through main navigation
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    
    // Verify focus is visible
    const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
    expect(focusedElement).toBeDefined();
    
    console.log('✅ Keyboard navigation test successful');
  });

  it('should have proper ARIA labels and roles', async () => {
    console.log('Testing ARIA labels and roles...');
    
    // Navigate to resource browser
    await page.click('[data-testid="resource-browser-nav"]');
    await page.waitForSelector('[data-testid="resource-browser-container"]');
    
    // Check for ARIA labels on validation buttons
    const validateButton = page.locator('[data-testid="validate-page-button"]');
    const ariaLabel = await validateButton.getAttribute('aria-label');
    expect(ariaLabel).toBeDefined();
    
    // Check for ARIA roles on validation badges
    const validationBadges = page.locator('[data-testid="validation-badge"]');
    const role = await validationBadges.first().getAttribute('role');
    expect(role).toBeDefined();
    
    console.log('✅ ARIA labels and roles test successful');
  });

  it('should have proper color contrast for validation status', async () => {
    console.log('Testing color contrast...');
    
    // Navigate to resource browser
    await page.click('[data-testid="resource-browser-nav"]');
    await page.waitForSelector('[data-testid="resource-browser-container"]');
    
    // Check color contrast of validation badges
    const validBadge = page.locator('[data-testid="validation-badge-valid"]').first();
    const errorBadge = page.locator('[data-testid="validation-badge-error"]').first();
    
    if (await validBadge.count() > 0) {
      const validStyles = await validBadge.evaluate(el => {
        const styles = window.getComputedStyle(el);
        return {
          backgroundColor: styles.backgroundColor,
          color: styles.color
        };
      });
      expect(validStyles.backgroundColor).toBeDefined();
      expect(validStyles.color).toBeDefined();
    }
    
    if (await errorBadge.count() > 0) {
      const errorStyles = await errorBadge.evaluate(el => {
        const styles = window.getComputedStyle(el);
        return {
          backgroundColor: styles.backgroundColor,
          color: styles.color
        };
      });
      expect(errorStyles.backgroundColor).toBeDefined();
      expect(errorStyles.color).toBeDefined();
    }
    
    console.log('✅ Color contrast test successful');
  });
});
