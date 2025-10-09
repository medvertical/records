/**
 * End-to-End Tests for Simplified Validation Settings Workflow
 * 
 * Tests the complete validation settings workflow including:
 * - Settings page navigation
 * - Toggle validation aspects
 * - Update performance settings
 * - Configure resource type filtering
 * - FHIR version migration
 * - Reset to defaults
 * - Save and apply settings
 */

import { test, expect } from '@playwright/test';

test.describe('Validation Settings Simplified Workflow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the settings page
    await page.goto('/settings');
    
    // Wait for the page to load
    await page.waitForSelector('[data-testid="validation-settings-tab"]');
  });

  test('should display simplified validation settings interface', async ({ page }) => {
    // Check that the simplified interface is displayed
    await expect(page.locator('[data-testid="validation-settings-tab"]')).toBeVisible();
    
    // Check that only essential sections are present
    await expect(page.locator('[data-testid="validation-aspects-section"]')).toBeVisible();
    await expect(page.locator('[data-testid="performance-settings-section"]')).toBeVisible();
    await expect(page.locator('[data-testid="resource-types-section"]')).toBeVisible();
    
    // Check that complex features are not present
    await expect(page.locator('[data-testid="audit-trail-section"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="versioning-section"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="backup-section"]')).not.toBeVisible();
  });

  test('should toggle validation aspects', async ({ page }) => {
    // Toggle structural validation
    const structuralToggle = page.locator('[data-testid="aspect-toggle-structural"]');
    await expect(structuralToggle).toBeChecked();
    
    await structuralToggle.click();
    await expect(structuralToggle).not.toBeChecked();
    
    // Toggle profile validation
    const profileToggle = page.locator('[data-testid="aspect-toggle-profile"]');
    await expect(profileToggle).toBeChecked();
    
    await profileToggle.click();
    await expect(profileToggle).not.toBeChecked();
    
    // Check that changes are reflected in the UI
    await expect(page.locator('[data-testid="settings-changed-indicator"]')).toBeVisible();
  });

  test('should update aspect severity levels', async ({ page }) => {
    // Change structural validation severity
    const structuralSeverity = page.locator('[data-testid="aspect-severity-structural"]');
    await structuralSeverity.selectOption('warning');
    
    // Change profile validation severity
    const profileSeverity = page.locator('[data-testid="aspect-severity-profile"]');
    await profileSeverity.selectOption('error');
    
    // Check that changes are reflected
    await expect(structuralSeverity).toHaveValue('warning');
    await expect(profileSeverity).toHaveValue('error');
  });

  test('should update performance settings', async ({ page }) => {
    // Update max concurrent validations
    const maxConcurrentInput = page.locator('[data-testid="max-concurrent-input"]');
    await maxConcurrentInput.clear();
    await maxConcurrentInput.fill('10');
    
    // Update batch size
    const batchSizeInput = page.locator('[data-testid="batch-size-input"]');
    await batchSizeInput.clear();
    await batchSizeInput.fill('100');
    
    // Check that values are updated
    await expect(maxConcurrentInput).toHaveValue('10');
    await expect(batchSizeInput).toHaveValue('100');
    
    // Check validation constraints
    await maxConcurrentInput.clear();
    await maxConcurrentInput.fill('25'); // Invalid value > 20
    
    await expect(page.locator('[data-testid="max-concurrent-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="max-concurrent-error"]')).toContainText('Must be between 1 and 20');
  });

  test('should configure resource type filtering', async ({ page }) => {
    // Enable resource type filtering
    const resourceTypesToggle = page.locator('[data-testid="resource-types-toggle"]');
    await expect(resourceTypesToggle).toBeChecked();
    
    // Add included resource types
    const includedTypesInput = page.locator('[data-testid="included-types-input"]');
    await includedTypesInput.fill('Patient,Observation,Encounter');
    
    // Add excluded resource types
    const excludedTypesInput = page.locator('[data-testid="excluded-types-input"]');
    await excludedTypesInput.fill('Binary,OperationOutcome');
    
    // Check that values are updated
    await expect(includedTypesInput).toHaveValue('Patient,Observation,Encounter');
    await expect(excludedTypesInput).toHaveValue('Binary,OperationOutcome');
  });

  test('should handle FHIR version migration', async ({ page }) => {
    // Check current FHIR version
    const versionIndicator = page.locator('[data-testid="fhir-version-indicator"]');
    await expect(versionIndicator).toBeVisible();
    
    // Simulate version change (this would normally come from server detection)
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('fhir-version-changed', {
        detail: { fromVersion: 'R4', toVersion: 'R5' }
      }));
    });
    
    // Check that migration dialog appears
    await expect(page.locator('[data-testid="migration-dialog"]')).toBeVisible();
    
    // Check migration impact
    await expect(page.locator('[data-testid="migration-impact"]')).toBeVisible();
    await expect(page.locator('[data-testid="migration-impact"]')).toContainText('R5-specific resource types');
    
    // Confirm migration
    await page.locator('[data-testid="confirm-migration-button"]').click();
    
    // Check that migration completes
    await expect(page.locator('[data-testid="migration-success"]')).toBeVisible();
  });

  test('should reset settings to defaults', async ({ page }) => {
    // Make some changes first
    const structuralToggle = page.locator('[data-testid="aspect-toggle-structural"]');
    await structuralToggle.click();
    
    const maxConcurrentInput = page.locator('[data-testid="max-concurrent-input"]');
    await maxConcurrentInput.clear();
    await maxConcurrentInput.fill('10');
    
    // Click reset to defaults
    await page.locator('[data-testid="reset-defaults-button"]').click();
    
    // Confirm reset
    await page.locator('[data-testid="confirm-reset-button"]').click();
    
    // Check that settings are reset
    await expect(structuralToggle).toBeChecked();
    await expect(maxConcurrentInput).toHaveValue('5');
    
    // Check that changes indicator is cleared
    await expect(page.locator('[data-testid="settings-changed-indicator"]')).not.toBeVisible();
  });

  test('should save and apply settings', async ({ page }) => {
    // Make changes
    const structuralToggle = page.locator('[data-testid="aspect-toggle-structural"]');
    await structuralToggle.click();
    
    const maxConcurrentInput = page.locator('[data-testid="max-concurrent-input"]');
    await maxConcurrentInput.clear();
    await maxConcurrentInput.fill('8');
    
    // Save settings
    await page.locator('[data-testid="save-settings-button"]').click();
    
    // Check that save is successful
    await expect(page.locator('[data-testid="save-success"]')).toBeVisible();
    
    // Check that changes indicator is cleared
    await expect(page.locator('[data-testid="settings-changed-indicator"]')).not.toBeVisible();
  });

  test('should handle save errors gracefully', async ({ page }) => {
    // Mock network error
    await page.route('**/api/validation/settings', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Server error' })
      });
    });
    
    // Make changes
    const structuralToggle = page.locator('[data-testid="aspect-toggle-structural"]');
    await structuralToggle.click();
    
    // Try to save
    await page.locator('[data-testid="save-settings-button"]').click();
    
    // Check that error is displayed
    await expect(page.locator('[data-testid="save-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="save-error"]')).toContainText('Server error');
    
    // Check that changes indicator is still visible
    await expect(page.locator('[data-testid="settings-changed-indicator"]')).toBeVisible();
  });

  test('should validate settings before saving', async ({ page }) => {
    // Set invalid values
    const maxConcurrentInput = page.locator('[data-testid="max-concurrent-input"]');
    await maxConcurrentInput.clear();
    await maxConcurrentInput.fill('25'); // Invalid value
    
    const batchSizeInput = page.locator('[data-testid="batch-size-input"]');
    await batchSizeInput.clear();
    await batchSizeInput.fill('5'); // Invalid value
    
    // Try to save
    await page.locator('[data-testid="save-settings-button"]').click();
    
    // Check that validation errors are displayed
    await expect(page.locator('[data-testid="max-concurrent-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="batch-size-error"]')).toBeVisible();
    
    // Check that save button is disabled
    await expect(page.locator('[data-testid="save-settings-button"]')).toBeDisabled();
  });

  test('should show loading states during operations', async ({ page }) => {
    // Mock slow network response
    await page.route('**/api/validation/settings', route => {
      setTimeout(() => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true })
        });
      }, 1000);
    });
    
    // Make changes
    const structuralToggle = page.locator('[data-testid="aspect-toggle-structural"]');
    await structuralToggle.click();
    
    // Save settings
    await page.locator('[data-testid="save-settings-button"]').click();
    
    // Check that loading state is shown
    await expect(page.locator('[data-testid="save-loading"]')).toBeVisible();
    await expect(page.locator('[data-testid="save-settings-button"]')).toBeDisabled();
    
    // Wait for completion
    await expect(page.locator('[data-testid="save-success"]')).toBeVisible();
  });

  test('should handle concurrent operations', async ({ page }) => {
    // Make changes
    const structuralToggle = page.locator('[data-testid="aspect-toggle-structural"]');
    await structuralToggle.click();
    
    // Start save operation
    await page.locator('[data-testid="save-settings-button"]').click();
    
    // Try to make more changes while saving
    const profileToggle = page.locator('[data-testid="aspect-toggle-profile"]');
    await profileToggle.click();
    
    // Check that new changes are queued
    await expect(page.locator('[data-testid="pending-changes"]')).toBeVisible();
    
    // Wait for save to complete
    await expect(page.locator('[data-testid="save-success"]')).toBeVisible();
    
    // Check that queued changes are applied
    await expect(page.locator('[data-testid="pending-changes"]')).not.toBeVisible();
  });

  test('should persist settings across page reloads', async ({ page }) => {
    // Make changes
    const structuralToggle = page.locator('[data-testid="aspect-toggle-structural"]');
    await structuralToggle.click();
    
    const maxConcurrentInput = page.locator('[data-testid="max-concurrent-input"]');
    await maxConcurrentInput.clear();
    await maxConcurrentInput.fill('12');
    
    // Save settings
    await page.locator('[data-testid="save-settings-button"]').click();
    await expect(page.locator('[data-testid="save-success"]')).toBeVisible();
    
    // Reload page
    await page.reload();
    await page.waitForSelector('[data-testid="validation-settings-tab"]');
    
    // Check that settings are persisted
    await expect(structuralToggle).not.toBeChecked();
    await expect(maxConcurrentInput).toHaveValue('12');
  });
});

