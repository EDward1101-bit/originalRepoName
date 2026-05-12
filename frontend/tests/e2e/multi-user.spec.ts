import { test, expect } from '@playwright/test';

test.describe('Multi-User Chat Scenarios', () => {
  test('should handle multiple users in same chat room', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    
    const page1 = await context1.newPage();
    const page2 = await context2.newPage();
    
    // User 1 login
    await page1.goto('/');
    await expect(page1.locator('[data-testid="auth-form"]')).toBeVisible({ timeout: 15000 });
    await page1.locator('[data-testid="email-input"]').fill('user1@example.com');
    await page1.locator('[data-testid="password-input"]').fill('password123');
    await page1.locator('[data-testid="submit-button"]').click();
    await expect(page1.locator('[data-testid="chat-interface"]')).toBeVisible({ timeout: 20000 });
    await page1.locator('text=general').first().click();
    
    // User 2 login
    await page2.goto('/');
    await expect(page2.locator('[data-testid="auth-form"]')).toBeVisible({ timeout: 15000 });
    await page2.locator('[data-testid="email-input"]').fill('user2@example.com');
    await page2.locator('[data-testid="password-input"]').fill('password123');
    await page2.locator('[data-testid="submit-button"]').click();
    await expect(page2.locator('[data-testid="chat-interface"]')).toBeVisible({ timeout: 20000 });
    await page2.locator('text=general').first().click();
    
    // Note: In a real app, users would need to navigate to the same chat room or DM.
    // Assuming they are placed in a shared state or we skip the exact navigation for this skeleton:
    
    // User 1 sends a message
    await page1.locator('[data-testid="message-input"]').fill('Hello from User 1!');
    await page1.locator('[data-testid="send-button"]').click();
    
    // User 2 should see the message
    await expect(page2.locator('[data-testid="message-item"]').filter({ hasText: 'Hello from User 1!' })).toBeVisible({ timeout: 10000 });
    
    // User 2 replies
    await page2.locator('[data-testid="message-input"]').fill('Hello from User 2!');
    await page2.locator('[data-testid="send-button"]').click();
    
    // User 1 should see the reply
    await expect(page1.locator('[data-testid="message-item"]').filter({ hasText: 'Hello from User 2!' })).toBeVisible({ timeout: 10000 });
    
    await context1.close();
    await context2.close();
  });

  test('should show typing indicators between users', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    
    const page1 = await context1.newPage();
    const page2 = await context2.newPage();
    
    // Both users login
    for (const [page, email, password] of [
      [page1, 'user1@example.com', 'password123'],
      [page2, 'user2@example.com', 'password123']
    ]) {
      await page.goto('/');
      await expect(page.locator('[data-testid="auth-form"]')).toBeVisible({ timeout: 15000 });
      await page.locator('[data-testid="email-input"]').fill(email);
      await page.locator('[data-testid="password-input"]').fill(password);
      await page.locator('[data-testid="submit-button"]').click();
      await expect(page.locator('[data-testid="chat-interface"]')).toBeVisible({ timeout: 20000 });
      await page.locator('text=general').first().click();
    }
    
    // User 1 starts typing
    await page1.locator('[data-testid="message-input"]').fill('typing...');
    
    // User 2 should see typing indicator
    await expect(page2.locator('[data-testid="typing-indicator"]')).toBeVisible({ timeout: 10000 });
    
    // User 1 stops typing
    await page1.locator('[data-testid="message-input"]').fill('');
    
    await context1.close();
    await context2.close();
  });

  test('should handle concurrent message sending', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    
    const page1 = await context1.newPage();
    const page2 = await context2.newPage();
    
    // Both users login
    for (const [page, email, password] of [
      [page1, 'user1@example.com', 'password123'],
      [page2, 'user2@example.com', 'password123']
    ]) {
      await page.goto('/');
      await expect(page.locator('[data-testid="auth-form"]')).toBeVisible({ timeout: 15000 });
      await page.locator('[data-testid="email-input"]').fill(email);
      await page.locator('[data-testid="password-input"]').fill(password);
      await page.locator('[data-testid="submit-button"]').click();
      await expect(page.locator('[data-testid="chat-interface"]')).toBeVisible({ timeout: 20000 });
      await page.locator('text=general').first().click();
    }
    
    // Both users send messages simultaneously
    const messages1 = Array.from({ length: 3 }, (_, i) => `Concurrent Msg ${i + 1} from User 1`);
    const messages2 = Array.from({ length: 3 }, (_, i) => `Concurrent Msg ${i + 1} from User 2`);
    
    // Send messages concurrently
    await Promise.all([
      ...messages1.map(async (msg) => {
        await page1.locator('[data-testid="message-input"]').fill(msg);
        await page1.locator('[data-testid="send-button"]').click();
      }),
      ...messages2.map(async (msg) => {
        await page2.locator('[data-testid="message-input"]').fill(msg);
        await page2.locator('[data-testid="send-button"]').click();
      })
    ]);
    
    // Wait for all messages to appear
    await page1.waitForTimeout(3000);
    await page2.waitForTimeout(3000);
    
    // Both users should see all messages
    for (const msg of [...messages1, ...messages2]) {
      await expect(page1.locator('[data-testid="message-item"]').filter({ hasText: msg }).first()).toBeVisible();
      await expect(page2.locator('[data-testid="message-item"]').filter({ hasText: msg }).first()).toBeVisible();
    }
    
    await context1.close();
    await context2.close();
  });
});
