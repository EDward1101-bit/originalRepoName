import { chromium, FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting Playwright global setup...');
  
  // You can set up test data here, like creating test users in Supabase
  // For now, we'll just verify the environment is ready
  
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    // Check if the app is accessible
    await page.goto(config.webServer?.url || 'http://localhost:5173');
    console.log('✅ Frontend server is accessible');
  } catch (error) {
    console.error('❌ Frontend server not accessible:', error);
    throw error;
  } finally {
    await browser.close();
  }
  
  console.log('✅ Playwright global setup completed');
}

export default globalSetup;
