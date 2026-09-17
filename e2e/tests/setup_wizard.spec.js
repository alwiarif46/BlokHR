const { test, expect } = require('@playwright/test');
const fs = require('fs');

// We'll assume the db is wiped before this test runs
test.describe('Setup Wizard', () => {
  test('Complete setup wizard', async ({ page }) => {
    await page.goto('/');

    // Step 1: Branding
    await expect(page.locator('h2')).toContainText('Company & Branding');
    await page.fill('#setupCompanyName', 'Playwright Inc');
    await page.fill('#setupTagline', 'Automated Testing');
    await page.click('button:has-text("Next")');

    // Step 2: Auth Configuration
    await expect(page.locator('h2')).toContainText('Authentication Providers');
    await page.fill('#setupMsalClientId', 'fake-client-id');
    await page.click('button:has-text("Next")');

    // Step 3: Admin User
    await expect(page.locator('h2')).toContainText('License & Admin User');
    await page.fill('#setupLicenseKey', '12345678');
    await page.fill('#setupAdminEmail', 'admin@playwright.com');
    await page.click('button:has-text("Complete Setup")');

    // Setup finishes and redirects to Login Screen
    await expect(page.locator('.auth-title')).toContainText('Sign in to BlokHR');
  });

  test('Login and Change Password', async ({ page }) => {
    // Navigate to root (which redirects to login if unauthenticated)
    await page.goto('/');
    await expect(page.locator('.auth-title')).toContainText('Sign in to BlokHR');

    // Wait for the local login option to be rendered
    await page.waitForSelector('#loginProvidersBtnLocal');
    await page.click('#loginProvidersBtnLocal');

    await page.fill('#loginEmail', 'admin@playwright.com');
    await page.fill('#loginPassword', 'admin');
    await page.click('#btnLogin');

    // Must change password screen
    await expect(page.locator('h2')).toContainText('Change Password');
    await page.fill('#cpOldPass', 'admin');
    await page.fill('#cpNewPass', 'Playwright123!');
    await page.click('#btnChangePass');

    // Should enter app
    await expect(page.locator('.hdr-title')).toContainText('Playwright Inc');
  });
});
