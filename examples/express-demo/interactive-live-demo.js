/**
 * @file interactive-live-demo.js
 * Launches a visible Chrome browser window directly on the user's desktop,
 * and interacts with the AgentShield Live Sandbox buttons live with visual delays.
 */

import { chromium } from 'playwright';

async function runLiveVisualDemo() {
  console.log('🚀 Opening visible browser window on your desktop...');
  
  // Launch in HEADED mode (visible window on user's Mac screen)
  const browser = await chromium.launch({
    headless: false,
    slowMo: 600, // Smooth human-like pacing so user can observe everything
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 850 },
  });

  const page = await context.newPage();

  console.log('🌐 Loading http://localhost:4000...');
  await page.goto('http://localhost:4000/');
  await page.waitForTimeout(2000);

  // 1. Click Normal Human Flow
  console.log('👉 Clicking [Normal Human Flow]...');
  await page.click('#btnNormal');
  await page.waitForTimeout(2000);

  // 2. Click Sequential ID Scraper
  console.log('👉 Clicking [Sequential ID Scraper] (/api/users/1..8)...');
  await page.click('#btnEnum');
  await page.waitForTimeout(3000);

  // 3. Click Admin / Debug Probing
  console.log('👉 Clicking [Admin / Debug Probing] (/api/admin/secrets)...');
  await page.click('#btnProbe');
  await page.waitForTimeout(2000);

  // 4. Click API Flooding Burst
  console.log('👉 Clicking [API Flooding Burst] (20 requests)...');
  await page.click('#btnBurst');
  await page.waitForTimeout(4000);

  console.log('✨ Live interaction complete! Leaving the window open for 10 seconds for you to inspect...');
  await page.waitForTimeout(10000);

  await browser.close();
  console.log('✅ Demo browser closed.');
}

runLiveVisualDemo().catch(err => {
  console.error('Error running live demo:', err);
});
