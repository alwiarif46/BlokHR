const { test, expect } = require('@playwright/test');

test('Setup page loads', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  console.log(await page.content());
});
