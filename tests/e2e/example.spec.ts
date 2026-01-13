/**
 * Example E2E Test
 * Tests critical user flows
 */

import { test, expect } from '@playwright/test';

test.describe('GA-AppLocker Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to app (assuming Electron app opens on localhost:3000 in dev mode)
    await page.goto('/');
  });

  test('should load dashboard', async ({ page }) => {
    // Wait for app to load
    await page.waitForSelector('h2', { timeout: 10000 });
    
    // Check if dashboard title is visible
    const title = page.locator('h2').first();
    await expect(title).toBeVisible();
  });

  test('should navigate to Policy Lab', async ({ page }) => {
    // Click on Policy Lab navigation
    const policyLink = page.locator('text=Policy Lab').first();
    await policyLink.click();
    
    // Verify Policy Lab page loaded
    await expect(page.locator('text=Policy Lab')).toBeVisible();
  });

  test('should open rule generator', async ({ page }) => {
    // Navigate to Policy Lab
    await page.goto('/');
    const policyLink = page.locator('text=Policy Lab').first();
    await policyLink.click();
    
    // Click Rule Generator button
    const generatorButton = page.locator('text=Rule Generator').first();
    await generatorButton.click();
    
    // Verify modal opened
    await expect(page.locator('text=Rule Generation Engine')).toBeVisible();
  });

  test('should display loading state', async ({ page }) => {
    // Navigate to a module that loads data
    await page.goto('/');
    
    // Check for loading indicators (if any)
    const loadingIndicator = page.locator('[role="status"]').first();
    // Loading should eventually disappear
    await expect(loadingIndicator).not.toBeVisible({ timeout: 10000 });
  });
});
