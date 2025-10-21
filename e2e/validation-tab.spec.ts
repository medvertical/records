import { test, expect } from '@playwright/test';

/**
 * ValidationTab E2E Tests
 * 
 * Tests for ValidationTab component covering:
 * - All 7 sections render correctly
 * - Per-aspect toggles and settings work
 * - Engine changes affect performance section
 * - Save All flow works
 * - Dirty state tracking
 */

test.describe('ValidationTab', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to settings with validation tab
    await page.goto('/settings?tab=validation');
    // Wait for settings to load
    await page.waitForSelector('[data-testid="validation-tab"], text="Validation Settings"');
  });

  test('should render all 7 sections correctly', async ({ page }) => {
    // Section 1: Validation Engine
    await expect(page.getByText('Validation Engine')).toBeVisible();
    await expect(page.getByRole('radio', { name: /Auto.*Recommended/i })).toBeVisible();
    await expect(page.getByRole('radio', { name: /Server/i })).toBeVisible();
    await expect(page.getByRole('radio', { name: /Local.*HAPI/i })).toBeVisible();
    await expect(page.getByRole('radio', { name: /Schema/i })).toBeVisible();
    await expect(page.getByRole('radio', { name: /Hybrid/i })).toBeVisible();

    // Section 2: Terminology Mode
    await expect(page.getByText('Terminology Mode')).toBeVisible();
    await expect(page.getByText(/Online|Offline/)).toBeVisible();

    // Section 3: Profile Sources
    await expect(page.getByText('Profile Sources')).toBeVisible();
    
    // Section 4: Validation Aspects
    await expect(page.getByText('Validation Aspects')).toBeVisible();
    await expect(page.getByText('Structural Validation')).toBeVisible();
    await expect(page.getByText('Profile Validation')).toBeVisible();
    await expect(page.getByText('Terminology Validation')).toBeVisible();
    await expect(page.getByText('Reference Validation')).toBeVisible();
    await expect(page.getByText('Business Rules')).toBeVisible();
    await expect(page.getByText('Metadata Validation')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reset Aspect Defaults' })).toBeVisible();

    // Section 5: Performance & Concurrency
    await expect(page.getByText('Performance & Concurrency')).toBeVisible();
    await expect(page.getByText('Max Concurrent Validations')).toBeVisible();
    await expect(page.getByText('Batch Size')).toBeVisible();
    await expect(page.getByText('Enable Result Caching')).toBeVisible();

    // Section 6: Resource Filtering
    await expect(page.getByText('Resource Filtering')).toBeVisible();
    await expect(page.getByText('Filter Types')).toBeVisible();

    // Section 7: Advanced Settings
    await expect(page.getByText('Advanced Settings')).toBeVisible();
  });

  test('should toggle aspect enabled state', async ({ page }) => {
    // Find the structural validation aspect card
    const structuralCard = page.locator('text=Structural Validation').locator('..');
    
    // Find the switch within the card (going up to parent then finding switch)
    const aspectSwitch = structuralCard.locator('..').locator('button[role="switch"]').first();
    
    // Get initial state
    const initialState = await aspectSwitch.getAttribute('data-state');
    
    // Toggle it
    await aspectSwitch.click();
    
    // Wait for state change
    await page.waitForTimeout(100);
    
    // Verify state changed
    const newState = await aspectSwitch.getAttribute('data-state');
    expect(newState).not.toBe(initialState);
    
    // Check for dirty state indicator (unsaved changes alert)
    await expect(page.getByText(/Unsaved changes|click Save to apply/i)).toBeVisible();
  });

  test('should disable performance settings when engine is server', async ({ page }) => {
    // Select server engine
    await page.getByRole('radio', { name: /Server/i }).click();
    
    // Wait for performance section to update
    await page.waitForTimeout(200);
    
    // Check for info alert about disabled performance settings
    await expect(
      page.getByText(/Performance settings are not applicable when using server-side validation/i)
    ).toBeVisible();
    
    // Verify sliders are disabled
    const maxConcurrentSlider = page.locator('input[type="range"]').first();
    await expect(maxConcurrentSlider).toBeDisabled();
  });

  test('should change aspect severity', async ({ page }) => {
    // Find first aspect card severity dropdown
    const firstSeverityDropdown = page.locator('text=Severity').first().locator('..').locator('[role="combobox"]');
    
    // Click to open dropdown
    await firstSeverityDropdown.click();
    
    // Select "Warning" option
    await page.getByRole('option', { name: 'Warning' }).click();
    
    // Check for dirty state
    await expect(page.getByText(/Unsaved changes/i)).toBeVisible();
  });

  test('should reset aspects to defaults', async ({ page }) => {
    // Make a change first
    const firstAspectSwitch = page.locator('button[role="switch"]').first();
    await firstAspectSwitch.click();
    
    // Wait for dirty state
    await expect(page.getByText(/Unsaved changes/i)).toBeVisible();
    
    // Click reset button
    await page.getByRole('button', { name: 'Reset Aspect Defaults' }).click();
    
    // Check for success toast
    await expect(page.getByText(/Aspects Reset|restored to default/i)).toBeVisible();
  });

  test('should toggle resource type filtering', async ({ page }) => {
    // Find the resource filtering section
    const filterSwitch = page.locator('text=Filter Types').locator('..').locator('button[role="switch"]');
    
    // Get initial state
    const initialState = await filterSwitch.getAttribute('data-state');
    
    // Toggle it
    await filterSwitch.click();
    
    // Verify state changed
    await page.waitForTimeout(100);
    const newState = await filterSwitch.getAttribute('data-state');
    expect(newState).not.toBe(initialState);
    
    // Check for dirty state
    await expect(page.getByText(/Unsaved changes/i)).toBeVisible();
  });

  test('should show responsive layout on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Validation aspects grid should stack vertically on mobile
    const aspectsGrid = page.locator('text=Validation Aspects').locator('..').locator('.grid');
    
    // Check that grid has single column class
    const gridClasses = await aspectsGrid.getAttribute('class');
    expect(gridClasses).toContain('grid-cols-1');
  });

  test('should track dirty state across multiple changes', async ({ page }) => {
    // Make multiple changes
    
    // 1. Change engine
    await page.getByRole('radio', { name: /Hybrid/i }).click();
    await expect(page.getByText(/Unsaved changes/i)).toBeVisible();
    
    // 2. Toggle aspect
    const firstSwitch = page.locator('button[role="switch"]').first();
    await firstSwitch.click();
    await expect(page.getByText(/Unsaved changes/i)).toBeVisible();
    
    // 3. Change mode
    const modeSwitch = page.locator('text=Terminology Mode').locator('..').locator('button[role="switch"]');
    await modeSwitch.click();
    
    // Dirty state should still be visible
    await expect(page.getByText(/Unsaved changes/i)).toBeVisible();
  });

  test('should expand and collapse advanced settings', async ({ page }) => {
    // Find advanced settings accordion
    const advancedAccordion = page.getByText('Advanced Settings');
    
    // Should be collapsed initially (content not visible)
    await expect(page.getByText('Validation Timeout')).not.toBeVisible();
    
    // Click to expand
    await advancedAccordion.click();
    
    // Content should now be visible
    await expect(page.getByText('Validation Timeout')).toBeVisible();
    await expect(page.getByText('Memory Limit')).toBeVisible();
    
    // Click to collapse
    await advancedAccordion.click();
    
    // Content should be hidden again
    await expect(page.getByText('Validation Timeout')).not.toBeVisible();
  });
});

