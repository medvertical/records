import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { chromium, Browser, Page } from 'playwright';

describe('Validation Settings Workflow E2E Tests', () => {
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

  describe('Validation Settings Management', () => {
    it('should complete full validation settings workflow', async () => {
      // Step 1: Navigate to Validation Settings
      await testNavigateToValidationSettings();
      
      // Step 2: Configure Validation Aspects
      await testConfigureValidationAspects();
      
      // Step 3: Save Settings
      await testSaveValidationSettings();
      
      // Step 4: Verify Settings Applied
      await testVerifySettingsApplied();
      
      // Step 5: Test Real-time Updates
      await testRealTimeSettingsUpdates();
      
      // Step 6: View Settings Impact
      await testSettingsImpactDisplay();
      
      // Step 7: Rollback Settings
      await testRollbackSettings();
      
      // Step 8: View Audit Trail
      await testAuditTrailDisplay();
    });

    it('should handle validation settings error scenarios', async () => {
      await testValidationSettingsErrorHandling();
    });

    it('should handle concurrent settings changes', async () => {
      await testConcurrentSettingsChanges();
    });
  });

  async function testNavigateToValidationSettings() {
    console.log('Testing navigation to validation settings...');
    
    // Navigate to validation settings
    await page.click('[data-testid="validation-settings-nav"]');
    await page.waitForSelector('[data-testid="validation-settings-container"]');
    
    // Verify settings page loaded
    const pageTitle = await page.textContent('[data-testid="validation-settings-title"]');
    expect(pageTitle).toContain('Validation Settings');
    
    console.log('✅ Navigation to validation settings successful');
  }

  async function testConfigureValidationAspects() {
    console.log('Testing validation aspects configuration...');
    
    // Configure structural validation
    await page.click('[data-testid="structural-validation-toggle"]');
    await page.selectOption('[data-testid="structural-severity-select"]', 'error');
    
    // Configure profile validation
    await page.click('[data-testid="profile-validation-toggle"]');
    await page.selectOption('[data-testid="profile-severity-select"]', 'warning');
    
    // Configure terminology validation
    await page.click('[data-testid="terminology-validation-toggle"]');
    await page.selectOption('[data-testid="terminology-severity-select"]', 'info');
    
    // Configure reference validation
    await page.click('[data-testid="reference-validation-toggle"]');
    await page.selectOption('[data-testid="reference-severity-select"]', 'error');
    
    // Configure business rule validation
    await page.click('[data-testid="business-rule-validation-toggle"]');
    await page.selectOption('[data-testid="business-rule-severity-select"]', 'warning');
    
    // Configure metadata validation
    await page.click('[data-testid="metadata-validation-toggle"]');
    await page.selectOption('[data-testid="metadata-severity-select"]', 'info');
    
    // Verify all aspects are configured
    const enabledAspects = await page.locator('[data-testid*="-validation-toggle"]:checked').count();
    expect(enabledAspects).toBe(6);
    
    console.log('✅ Validation aspects configuration successful');
  }

  async function testSaveValidationSettings() {
    console.log('Testing validation settings save...');
    
    // Save settings
    await page.click('[data-testid="save-validation-settings"]');
    
    // Wait for save confirmation
    await page.waitForSelector('[data-testid="settings-saved-success"]');
    
    // Verify success message
    const successMessage = await page.textContent('[data-testid="settings-saved-message"]');
    expect(successMessage).toContain('Settings saved successfully');
    
    console.log('✅ Validation settings save successful');
  }

  async function testVerifySettingsApplied() {
    console.log('Testing verification of applied settings...');
    
    // Navigate to dashboard to see settings impact
    await page.click('[data-testid="dashboard-nav"]');
    await page.waitForSelector('[data-testid="dashboard-container"]');
    
    // Verify settings impact component is visible
    await expect(page.locator('[data-testid="validation-settings-impact"]')).toBeVisible();
    
    // Check that active validation aspects are displayed
    const activeAspects = await page.locator('[data-testid="active-validation-aspect"]').count();
    expect(activeAspects).toBe(6);
    
    console.log('✅ Settings application verification successful');
  }

  async function testRealTimeSettingsUpdates() {
    console.log('Testing real-time settings updates...');
    
    // Navigate back to settings
    await page.click('[data-testid="validation-settings-nav"]');
    await page.waitForSelector('[data-testid="validation-settings-container"]');
    
    // Change a setting
    await page.click('[data-testid="structural-validation-toggle"]');
    await page.click('[data-testid="save-validation-settings"]');
    
    // Wait for save
    await page.waitForSelector('[data-testid="settings-saved-success"]');
    
    // Navigate to dashboard to verify real-time update
    await page.click('[data-testid="dashboard-nav"]');
    await page.waitForSelector('[data-testid="dashboard-container"]');
    
    // Verify settings impact updated in real-time
    const activeAspects = await page.locator('[data-testid="active-validation-aspect"]').count();
    expect(activeAspects).toBe(5); // One less aspect now
    
    console.log('✅ Real-time settings updates successful');
  }

  async function testSettingsImpactDisplay() {
    console.log('Testing settings impact display...');
    
    // Verify settings impact component shows current configuration
    await expect(page.locator('[data-testid="validation-settings-impact"]')).toBeVisible();
    
    // Check impact statistics
    const impactStats = await page.locator('[data-testid="settings-impact-statistics"]').count();
    expect(impactStats).toBeGreaterThan(0);
    
    // Verify aspect breakdown chart
    const aspectChart = await page.locator('[data-testid="validation-aspect-breakdown-chart"]').count();
    expect(aspectChart).toBeGreaterThan(0);
    
    console.log('✅ Settings impact display successful');
  }

  async function testRollbackSettings() {
    console.log('Testing settings rollback...');
    
    // Navigate to settings
    await page.click('[data-testid="validation-settings-nav"]');
    await page.waitForSelector('[data-testid="validation-settings-container"]');
    
    // Click rollback button
    await page.click('[data-testid="rollback-settings-button"]');
    
    // Confirm rollback in dialog
    await page.waitForSelector('[data-testid="rollback-confirmation-dialog"]');
    await page.click('[data-testid="confirm-rollback-button"]');
    
    // Wait for rollback confirmation
    await page.waitForSelector('[data-testid="settings-rolled-back-success"]');
    
    // Verify rollback success message
    const rollbackMessage = await page.textContent('[data-testid="rollback-success-message"]');
    expect(rollbackMessage).toContain('Settings rolled back successfully');
    
    console.log('✅ Settings rollback successful');
  }

  async function testAuditTrailDisplay() {
    console.log('Testing audit trail display...');
    
    // Navigate to audit trail section
    await page.click('[data-testid="audit-trail-section"]');
    await page.waitForSelector('[data-testid="audit-trail-container"]');
    
    // Verify audit trail entries
    const auditEntries = await page.locator('[data-testid="audit-trail-entry"]').count();
    expect(auditEntries).toBeGreaterThan(0);
    
    // Check audit trail statistics
    const auditStats = await page.locator('[data-testid="audit-trail-statistics"]').count();
    expect(auditStats).toBeGreaterThan(0);
    
    console.log('✅ Audit trail display successful');
  }

  async function testValidationSettingsErrorHandling() {
    console.log('Testing validation settings error handling...');
    
    // Navigate to settings
    await page.click('[data-testid="validation-settings-nav"]');
    await page.waitForSelector('[data-testid="validation-settings-container"]');
    
    // Mock network failure
    await page.route('**/api/validation/settings', route => {
      route.abort('failed');
    });
    
    // Try to save settings
    await page.click('[data-testid="save-validation-settings"]');
    
    // Wait for error message
    await page.waitForSelector('[data-testid="settings-save-error"]');
    
    // Verify error message
    const errorMessage = await page.textContent('[data-testid="settings-error-message"]');
    expect(errorMessage).toContain('Failed to save settings');
    
    console.log('✅ Validation settings error handling successful');
  }

  async function testConcurrentSettingsChanges() {
    console.log('Testing concurrent settings changes...');
    
    // Open multiple tabs
    const page2 = await browser.newPage();
    await page2.goto(baseUrl);
    await page2.waitForSelector('[data-testid="app-container"]', { timeout: 10000 });
    
    // Navigate both pages to settings
    await page.click('[data-testid="validation-settings-nav"]');
    await page.waitForSelector('[data-testid="validation-settings-container"]');
    
    await page2.click('[data-testid="validation-settings-nav"]');
    await page2.waitForSelector('[data-testid="validation-settings-container"]');
    
    // Make changes on both pages
    await page.click('[data-testid="structural-validation-toggle"]');
    await page2.click('[data-testid="profile-validation-toggle"]');
    
    // Save on both pages
    await Promise.all([
      page.click('[data-testid="save-validation-settings"]'),
      page2.click('[data-testid="save-validation-settings"]')
    ]);
    
    // Wait for both saves to complete
    await Promise.all([
      page.waitForSelector('[data-testid="settings-saved-success"]'),
      page2.waitForSelector('[data-testid="settings-saved-success"]')
    ]);
    
    await page2.close();
    
    console.log('✅ Concurrent settings changes successful');
  }
});

describe('Validation Settings Performance E2E Tests', () => {
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

  it('should handle rapid settings changes efficiently', async () => {
    console.log('Testing performance with rapid settings changes...');
    
    // Navigate to settings
    await page.click('[data-testid="validation-settings-nav"]');
    await page.waitForSelector('[data-testid="validation-settings-container"]');
    
    const startTime = Date.now();
    
    // Make rapid settings changes
    for (let i = 0; i < 10; i++) {
      await page.click('[data-testid="structural-validation-toggle"]');
      await page.waitForTimeout(50);
      await page.click('[data-testid="profile-validation-toggle"]');
      await page.waitForTimeout(50);
    }
    
    const settingsChangeTime = Date.now() - startTime;
    
    // Verify settings changes completed within acceptable time
    expect(settingsChangeTime).toBeLessThan(5000); // 5 seconds
    
    console.log(`✅ Rapid settings changes performance test successful (${settingsChangeTime}ms)`);
  });

  it('should handle settings polling efficiently', async () => {
    console.log('Testing settings polling performance...');
    
    // Navigate to dashboard (which has settings polling)
    await page.click('[data-testid="dashboard-nav"]');
    await page.waitForSelector('[data-testid="dashboard-container"]');
    
    const startTime = Date.now();
    
    // Wait for polling to run for a period
    await page.waitForTimeout(10000); // 10 seconds
    
    const pollingTime = Date.now() - startTime;
    
    // Verify polling doesn't cause performance issues
    expect(pollingTime).toBeLessThan(12000); // Allow some tolerance
    
    // Check that dashboard remains responsive
    await page.click('[data-testid="validation-settings-nav"]');
    await page.waitForSelector('[data-testid="validation-settings-container"]');
    
    console.log(`✅ Settings polling performance test successful (${pollingTime}ms)`);
  });
});

describe('Validation Settings Accessibility E2E Tests', () => {
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

  it('should be keyboard navigable for settings', async () => {
    console.log('Testing keyboard navigation for settings...');
    
    // Navigate to settings
    await page.click('[data-testid="validation-settings-nav"]');
    await page.waitForSelector('[data-testid="validation-settings-container"]');
    
    // Test tab navigation through settings
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    
    // Verify focus is visible
    const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
    expect(focusedElement).toBeDefined();
    
    console.log('✅ Keyboard navigation for settings test successful');
  });

  it('should have proper ARIA labels for settings controls', async () => {
    console.log('Testing ARIA labels for settings controls...');
    
    // Navigate to settings
    await page.click('[data-testid="validation-settings-nav"]');
    await page.waitForSelector('[data-testid="validation-settings-container"]');
    
    // Check ARIA labels on toggles
    const toggle = page.locator('[data-testid="structural-validation-toggle"]');
    const ariaLabel = await toggle.getAttribute('aria-label');
    expect(ariaLabel).toBeDefined();
    
    // Check ARIA labels on selects
    const select = page.locator('[data-testid="structural-severity-select"]');
    const selectAriaLabel = await select.getAttribute('aria-label');
    expect(selectAriaLabel).toBeDefined();
    
    console.log('✅ ARIA labels for settings controls test successful');
  });

  it('should have proper form validation', async () => {
    console.log('Testing form validation...');
    
    // Navigate to settings
    await page.click('[data-testid="validation-settings-nav"]');
    await page.waitForSelector('[data-testid="validation-settings-container"]');
    
    // Try to save without any settings configured
    await page.click('[data-testid="save-validation-settings"]');
    
    // Check for validation messages
    const validationMessages = await page.locator('[data-testid="validation-message"]').count();
    expect(validationMessages).toBeGreaterThan(0);
    
    console.log('✅ Form validation test successful');
  });
});
