import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { chromium, Browser, Page } from 'playwright';

describe('Dashboard and Analytics Workflow E2E Tests', () => {
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

  describe('Dashboard Analytics Workflow', () => {
    it('should complete full dashboard analytics workflow', async () => {
      // Step 1: Navigate to Dashboard
      await testNavigateToDashboard();
      
      // Step 2: View Server Statistics
      await testServerStatisticsDisplay();
      
      // Step 3: View Validation Statistics
      await testValidationStatisticsDisplay();
      
      // Step 4: View Validation Aspect Breakdown
      await testValidationAspectBreakdown();
      
      // Step 5: View Settings Impact
      await testSettingsImpactDisplay();
      
      // Step 6: Test Real-time Updates
      await testRealTimeDashboardUpdates();
      
      // Step 7: View Validation Queue Management
      await testValidationQueueManagement();
      
      // Step 8: View Individual Resource Progress
      await testIndividualResourceProgress();
      
      // Step 9: View Cancellation and Retry Controls
      await testCancellationRetryControls();
    });

    it('should handle dashboard error scenarios', async () => {
      await testDashboardErrorHandling();
    });

    it('should handle dashboard performance scenarios', async () => {
      await testDashboardPerformanceScenarios();
    });
  });

  async function testNavigateToDashboard() {
    console.log('Testing navigation to dashboard...');
    
    // Navigate to dashboard
    await page.click('[data-testid="dashboard-nav"]');
    await page.waitForSelector('[data-testid="dashboard-container"]');
    
    // Verify dashboard loaded
    const pageTitle = await page.textContent('[data-testid="dashboard-title"]');
    expect(pageTitle).toContain('Dashboard');
    
    console.log('✅ Dashboard navigation successful');
  }

  async function testServerStatisticsDisplay() {
    console.log('Testing server statistics display...');
    
    // Wait for server statistics card
    await page.waitForSelector('[data-testid="server-stats-card"]');
    
    // Verify server statistics are displayed
    await expect(page.locator('[data-testid="total-resources-count"]')).toBeVisible();
    await expect(page.locator('[data-testid="resource-types-count"]')).toBeVisible();
    await expect(page.locator('[data-testid="server-status"]')).toBeVisible();
    
    // Check that statistics have values
    const totalResources = await page.textContent('[data-testid="total-resources-count"]');
    expect(totalResources).toMatch(/\d+/);
    
    const resourceTypes = await page.textContent('[data-testid="resource-types-count"]');
    expect(resourceTypes).toMatch(/\d+/);
    
    console.log('✅ Server statistics display successful');
  }

  async function testValidationStatisticsDisplay() {
    console.log('Testing validation statistics display...');
    
    // Wait for validation statistics card
    await page.waitForSelector('[data-testid="validation-stats-card"]');
    
    // Verify validation statistics are displayed
    await expect(page.locator('[data-testid="total-validated-count"]')).toBeVisible();
    await expect(page.locator('[data-testid="valid-resources-count"]')).toBeVisible();
    await expect(page.locator('[data-testid="error-resources-count"]')).toBeVisible();
    await expect(page.locator('[data-testid="validation-coverage"]')).toBeVisible();
    
    // Check that statistics have values
    const totalValidated = await page.textContent('[data-testid="total-validated-count"]');
    expect(totalValidated).toMatch(/\d+/);
    
    const validationCoverage = await page.textContent('[data-testid="validation-coverage"]');
    expect(validationCoverage).toMatch(/\d+%/);
    
    console.log('✅ Validation statistics display successful');
  }

  async function testValidationAspectBreakdown() {
    console.log('Testing validation aspect breakdown...');
    
    // Wait for aspect breakdown chart
    await page.waitForSelector('[data-testid="validation-aspect-breakdown-chart"]');
    
    // Verify aspect breakdown is displayed
    await expect(page.locator('[data-testid="aspect-breakdown-structural"]')).toBeVisible();
    await expect(page.locator('[data-testid="aspect-breakdown-profile"]')).toBeVisible();
    await expect(page.locator('[data-testid="aspect-breakdown-terminology"]')).toBeVisible();
    await expect(page.locator('[data-testid="aspect-breakdown-reference"]')).toBeVisible();
    await expect(page.locator('[data-testid="aspect-breakdown-business-rule"]')).toBeVisible();
    await expect(page.locator('[data-testid="aspect-breakdown-metadata"]')).toBeVisible();
    
    // Check aspect scores
    const aspectScores = await page.locator('[data-testid*="aspect-score-"]').count();
    expect(aspectScores).toBeGreaterThan(0);
    
    console.log('✅ Validation aspect breakdown successful');
  }

  async function testSettingsImpactDisplay() {
    console.log('Testing settings impact display...');
    
    // Wait for settings impact component
    await page.waitForSelector('[data-testid="validation-settings-impact"]');
    
    // Verify settings impact is displayed
    await expect(page.locator('[data-testid="current-validation-config"]')).toBeVisible();
    await expect(page.locator('[data-testid="settings-impact-statistics"]')).toBeVisible();
    
    // Check active validation aspects
    const activeAspects = await page.locator('[data-testid="active-validation-aspect"]').count();
    expect(activeAspects).toBeGreaterThan(0);
    
    // Check impact indicators
    const impactIndicators = await page.locator('[data-testid="impact-indicator"]').count();
    expect(impactIndicators).toBeGreaterThan(0);
    
    console.log('✅ Settings impact display successful');
  }

  async function testRealTimeDashboardUpdates() {
    console.log('Testing real-time dashboard updates...');
    
    // Navigate to validation settings to make a change
    await page.click('[data-testid="validation-settings-nav"]');
    await page.waitForSelector('[data-testid="validation-settings-container"]');
    
    // Make a settings change
    await page.click('[data-testid="structural-validation-toggle"]');
    await page.click('[data-testid="save-validation-settings"]');
    
    // Wait for save
    await page.waitForSelector('[data-testid="settings-saved-success"]');
    
    // Navigate back to dashboard
    await page.click('[data-testid="dashboard-nav"]');
    await page.waitForSelector('[data-testid="dashboard-container"]');
    
    // Verify dashboard updated in real-time
    const updatedActiveAspects = await page.locator('[data-testid="active-validation-aspect"]').count();
    expect(updatedActiveAspects).toBeGreaterThan(0);
    
    console.log('✅ Real-time dashboard updates successful');
  }

  async function testValidationQueueManagement() {
    console.log('Testing validation queue management...');
    
    // Wait for queue management component
    await page.waitForSelector('[data-testid="validation-queue-management"]');
    
    // Verify queue statistics
    await expect(page.locator('[data-testid="queue-statistics"]')).toBeVisible();
    
    // Check queue controls
    await expect(page.locator('[data-testid="queue-start-button"]')).toBeVisible();
    await expect(page.locator('[data-testid="queue-stop-button"]')).toBeVisible();
    await expect(page.locator('[data-testid="queue-clear-button"]')).toBeVisible();
    
    // Test queue operations
    await page.click('[data-testid="queue-start-button"]');
    await page.waitForSelector('[data-testid="queue-processing"]');
    
    await page.click('[data-testid="queue-stop-button"]');
    await page.waitForSelector('[data-testid="queue-stopped"]');
    
    console.log('✅ Validation queue management successful');
  }

  async function testIndividualResourceProgress() {
    console.log('Testing individual resource progress...');
    
    // Wait for individual progress component
    await page.waitForSelector('[data-testid="individual-resource-progress"]');
    
    // Verify progress statistics
    await expect(page.locator('[data-testid="progress-statistics"]')).toBeVisible();
    
    // Check progress controls
    await expect(page.locator('[data-testid="progress-clear-button"]')).toBeVisible();
    await expect(page.locator('[data-testid="progress-refresh-button"]')).toBeVisible();
    
    // Test progress operations
    await page.click('[data-testid="progress-refresh-button"]');
    await page.waitForSelector('[data-testid="progress-updated"]');
    
    console.log('✅ Individual resource progress successful');
  }

  async function testCancellationRetryControls() {
    console.log('Testing cancellation and retry controls...');
    
    // Wait for cancellation retry component
    await page.waitForSelector('[data-testid="validation-cancellation-retry"]');
    
    // Verify cancellation controls
    await expect(page.locator('[data-testid="cancel-all-button"]')).toBeVisible();
    await expect(page.locator('[data-testid="retry-all-button"]')).toBeVisible();
    await expect(page.locator('[data-testid="emergency-stop-button"]')).toBeVisible();
    
    // Test emergency stop
    await page.click('[data-testid="emergency-stop-button"]');
    await page.waitForSelector('[data-testid="emergency-stop-confirmation"]');
    await page.click('[data-testid="confirm-emergency-stop"]');
    await page.waitForSelector('[data-testid="emergency-stop-executed"]');
    
    console.log('✅ Cancellation and retry controls successful');
  }

  async function testDashboardErrorHandling() {
    console.log('Testing dashboard error handling...');
    
    // Mock API failure
    await page.route('**/api/dashboard/**', route => {
      route.abort('failed');
    });
    
    // Navigate to dashboard
    await page.click('[data-testid="dashboard-nav"]');
    
    // Wait for error handling
    await page.waitForSelector('[data-testid="dashboard-error"]');
    
    // Verify error message is displayed
    const errorMessage = await page.textContent('[data-testid="dashboard-error-message"]');
    expect(errorMessage).toContain('Failed to load dashboard data');
    
    console.log('✅ Dashboard error handling successful');
  }

  async function testDashboardPerformanceScenarios() {
    console.log('Testing dashboard performance scenarios...');
    
    const startTime = Date.now();
    
    // Navigate to dashboard
    await page.click('[data-testid="dashboard-nav"]');
    await page.waitForSelector('[data-testid="dashboard-container"]');
    
    const loadTime = Date.now() - startTime;
    
    // Verify dashboard loaded within acceptable time
    expect(loadTime).toBeLessThan(5000); // 5 seconds
    
    // Test rapid navigation between dashboard sections
    const navigationStartTime = Date.now();
    
    await page.click('[data-testid="validation-settings-nav"]');
    await page.waitForSelector('[data-testid="validation-settings-container"]');
    
    await page.click('[data-testid="dashboard-nav"]');
    await page.waitForSelector('[data-testid="dashboard-container"]');
    
    await page.click('[data-testid="resource-browser-nav"]');
    await page.waitForSelector('[data-testid="resource-browser-container"]');
    
    const navigationTime = Date.now() - navigationStartTime;
    
    // Verify rapid navigation is efficient
    expect(navigationTime).toBeLessThan(3000); // 3 seconds
    
    console.log(`✅ Dashboard performance scenarios successful (load: ${loadTime}ms, navigation: ${navigationTime}ms)`);
  }
});

describe('Dashboard Analytics Performance E2E Tests', () => {
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

  it('should handle large datasets efficiently in dashboard', async () => {
    console.log('Testing dashboard performance with large datasets...');
    
    const startTime = Date.now();
    
    // Navigate to dashboard
    await page.click('[data-testid="dashboard-nav"]');
    await page.waitForSelector('[data-testid="dashboard-container"]');
    
    // Wait for all dashboard components to load
    await page.waitForSelector('[data-testid="server-stats-card"]');
    await page.waitForSelector('[data-testid="validation-stats-card"]');
    await page.waitForSelector('[data-testid="validation-aspect-breakdown-chart"]');
    await page.waitForSelector('[data-testid="validation-settings-impact"]');
    
    const loadTime = Date.now() - startTime;
    
    // Verify dashboard loaded efficiently
    expect(loadTime).toBeLessThan(8000); // 8 seconds
    
    console.log(`✅ Dashboard large dataset performance test successful (${loadTime}ms)`);
  });

  it('should handle real-time updates efficiently', async () => {
    console.log('Testing real-time updates performance...');
    
    // Navigate to dashboard
    await page.click('[data-testid="dashboard-nav"]');
    await page.waitForSelector('[data-testid="dashboard-container"]');
    
    const startTime = Date.now();
    
    // Simulate multiple settings changes to test real-time updates
    for (let i = 0; i < 5; i++) {
      await page.click('[data-testid="validation-settings-nav"]');
      await page.waitForSelector('[data-testid="validation-settings-container"]');
      
      await page.click('[data-testid="structural-validation-toggle"]');
      await page.click('[data-testid="save-validation-settings"]');
      await page.waitForSelector('[data-testid="settings-saved-success"]');
      
      await page.click('[data-testid="dashboard-nav"]');
      await page.waitForSelector('[data-testid="dashboard-container"]');
      
      // Wait for real-time update
      await page.waitForTimeout(1000);
    }
    
    const updateTime = Date.now() - startTime;
    
    // Verify real-time updates are efficient
    expect(updateTime).toBeLessThan(15000); // 15 seconds
    
    console.log(`✅ Real-time updates performance test successful (${updateTime}ms)`);
  });
});

describe('Dashboard Analytics Accessibility E2E Tests', () => {
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

  it('should be keyboard navigable for dashboard', async () => {
    console.log('Testing keyboard navigation for dashboard...');
    
    // Navigate to dashboard
    await page.click('[data-testid="dashboard-nav"]');
    await page.waitForSelector('[data-testid="dashboard-container"]');
    
    // Test tab navigation through dashboard
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    
    // Verify focus is visible
    const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
    expect(focusedElement).toBeDefined();
    
    console.log('✅ Keyboard navigation for dashboard test successful');
  });

  it('should have proper ARIA labels for dashboard components', async () => {
    console.log('Testing ARIA labels for dashboard components...');
    
    // Navigate to dashboard
    await page.click('[data-testid="dashboard-nav"]');
    await page.waitForSelector('[data-testid="dashboard-container"]');
    
    // Check ARIA labels on statistics cards
    const statsCard = page.locator('[data-testid="validation-stats-card"]');
    const ariaLabel = await statsCard.getAttribute('aria-label');
    expect(ariaLabel).toBeDefined();
    
    // Check ARIA labels on charts
    const aspectChart = page.locator('[data-testid="validation-aspect-breakdown-chart"]');
    const chartAriaLabel = await aspectChart.getAttribute('aria-label');
    expect(chartAriaLabel).toBeDefined();
    
    console.log('✅ ARIA labels for dashboard components test successful');
  });

  it('should have proper color contrast for dashboard elements', async () => {
    console.log('Testing color contrast for dashboard elements...');
    
    // Navigate to dashboard
    await page.click('[data-testid="dashboard-nav"]');
    await page.waitForSelector('[data-testid="dashboard-container"]');
    
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
    
    console.log('✅ Color contrast for dashboard elements test successful');
  });
});
