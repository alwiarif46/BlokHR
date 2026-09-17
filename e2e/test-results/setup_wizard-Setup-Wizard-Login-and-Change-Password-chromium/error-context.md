# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: setup_wizard.spec.js >> Setup Wizard >> Login and Change Password
- Location: tests\setup_wizard.spec.js:30:3

# Error details

```
Error: expect(locator).toContainText(expected) failed

Locator: locator('.auth-title')
Expected substring: "Sign in to BlokHR"
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toContainText" locator('.auth-title') with timeout 5000ms
  - waiting for locator('.auth-title')

```

```yaml
- button "☀️ 🌙"
- text: Setup Wizard B Platform Setup Configure your workspace in 3 quick steps 1 2 3 Branding Auth License Company Identity * Company Name
- textbox "Acme Corporation"
- text: Tagline
- textbox "Empowering your team"
- text: Logo URL
- textbox "https://...logo.png"
- text: Primary Timezone
- textbox "Asia/Kolkata"
- text: Appearance Primary Color
- textbox: "#f5a623"
- textbox: "#F5A623"
- text: Email From Name
- textbox "Defaults to company name"
- button "Next →" [disabled]
```

# Test source

```ts
  1  | const { test, expect } = require('@playwright/test');
  2  | const fs = require('fs');
  3  | 
  4  | // We'll assume the db is wiped before this test runs
  5  | test.describe('Setup Wizard', () => {
  6  |   test('Complete setup wizard', async ({ page }) => {
  7  |     await page.goto('/');
  8  | 
  9  |     // Step 1: Branding
  10 |     await expect(page.locator('h2')).toContainText('Company & Branding');
  11 |     await page.fill('#setupCompanyName', 'Playwright Inc');
  12 |     await page.fill('#setupTagline', 'Automated Testing');
  13 |     await page.click('button:has-text("Next")');
  14 | 
  15 |     // Step 2: Auth Configuration
  16 |     await expect(page.locator('h2')).toContainText('Authentication Providers');
  17 |     await page.fill('#setupMsalClientId', 'fake-client-id');
  18 |     await page.click('button:has-text("Next")');
  19 | 
  20 |     // Step 3: Admin User
  21 |     await expect(page.locator('h2')).toContainText('License & Admin User');
  22 |     await page.fill('#setupLicenseKey', '12345678');
  23 |     await page.fill('#setupAdminEmail', 'admin@playwright.com');
  24 |     await page.click('button:has-text("Complete Setup")');
  25 | 
  26 |     // Setup finishes and redirects to Login Screen
  27 |     await expect(page.locator('.auth-title')).toContainText('Sign in to BlokHR');
  28 |   });
  29 | 
  30 |   test('Login and Change Password', async ({ page }) => {
  31 |     // Navigate to root (which redirects to login if unauthenticated)
  32 |     await page.goto('/');
> 33 |     await expect(page.locator('.auth-title')).toContainText('Sign in to BlokHR');
     |                                               ^ Error: expect(locator).toContainText(expected) failed
  34 | 
  35 |     // Wait for the local login option to be rendered
  36 |     await page.waitForSelector('#loginProvidersBtnLocal');
  37 |     await page.click('#loginProvidersBtnLocal');
  38 | 
  39 |     await page.fill('#loginEmail', 'admin@playwright.com');
  40 |     await page.fill('#loginPassword', 'admin');
  41 |     await page.click('#btnLogin');
  42 | 
  43 |     // Must change password screen
  44 |     await expect(page.locator('h2')).toContainText('Change Password');
  45 |     await page.fill('#cpOldPass', 'admin');
  46 |     await page.fill('#cpNewPass', 'Playwright123!');
  47 |     await page.click('#btnChangePass');
  48 | 
  49 |     // Should enter app
  50 |     await expect(page.locator('.hdr-title')).toContainText('Playwright Inc');
  51 |   });
  52 | });
  53 | 
```