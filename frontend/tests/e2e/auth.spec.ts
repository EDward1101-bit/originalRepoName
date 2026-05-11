import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for any warm-up screens to disappear and auth form to appear
    await expect(page.locator('[data-testid="auth-form"]')).toBeVisible({ timeout: 15000 });
  });

  test('should show login form by default', async ({ page }) => {
    await expect(page.locator('[data-testid="email-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="password-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="username-input"]')).toBeHidden(); // Only for signup
    await expect(page.locator('[data-testid="submit-button"]')).toBeVisible();
  });

  test('should switch to sign up form', async ({ page }) => {
    // Click register button text - locating it via text or simply clicking the button that switches mode
    await page.getByRole('button', { name: /Register/i }).click();
    
    // Now username should be visible
    await expect(page.locator('[data-testid="username-input"]')).toBeVisible();
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.locator('[data-testid="email-input"]').fill('nonexistent@example.com');
    await page.locator('[data-testid="password-input"]').fill('wrongpassword123');
    await page.locator('[data-testid="submit-button"]').click();
    
    await expect(page.locator('[data-testid="auth-error"]')).toBeVisible();
  });

  // Note: Creating a new user works, but testing successful login/signup requires 
  // either real credentials or mocked network. For now, we assume if the form works,
  // we can test the error state. A real E2E test with test users would need the 
  // TASK-3 (Test Data Management) implemented completely.
});
