/**
 * @file ai-agent-tester.js
 * End-to-end automated AI Agent & Attack Simulation Tester using Playwright.
 * Interacts with the live AgentShield Sandbox, triggers attacks, and captures screenshots.
 */

import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const SCREENSHOT_DIR = path.resolve('./screenshots');
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function runAutonomousAITest() {
  console.log('===============================================================');
  console.log('🛡️  AgentShield End-to-End Autonomous AI Agent Security Test');
  console.log('===============================================================\n');

  console.log('🤖 Step 1: Launching automated Chromium browser (Playwright)...');
  const browser = await chromium.launch({
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/120.0.0.0 Safari/537.36',
  });

  const page = await context.newPage();

  console.log('🌐 Step 2: Navigating to AgentShield Live Sandbox (http://localhost:4000)...');
  const response = await page.goto('http://localhost:4000/');
  console.log(`   Initial Page Status: HTTP ${response.status()}`);
  console.log(`   Initial Risk Header: ${response.headers()['x-agentshield-risk'] || '0'}`);
  console.log(`   Initial Action:      ${response.headers()['x-agentshield-action'] || 'ALLOW'}\n`);

  // Wait for initial render
  await page.waitForTimeout(1000);

  // Take initial screenshot
  const initialShot = path.join(SCREENSHOT_DIR, '01_initial_dashboard.png');
  await page.screenshot({ path: initialShot, fullPage: true });
  console.log(`📸 Screenshot saved: ${initialShot}\n`);

  // 1. TEST NORMAL USER FLOW
  console.log('👉 Step 3: Triggering "Normal Human Flow" button...');
  await page.click('#btnNormal');
  await page.waitForTimeout(1000);
  console.log('   ✓ Normal flow executed.\n');

  // 2. TEST SEQUENTIAL ID SCRAPER ATTACK
  console.log('👉 Step 4: Triggering "Sequential ID Scraper" attack (/api/users/1..8)...');
  await page.click('#btnEnum');
  // Wait for the sequential iterations to finish
  await page.waitForTimeout(2500);
  console.log('   ✓ Sequential ID crawling attack executed.\n');

  // 3. TEST ADMIN / DEBUG PROBING
  console.log('👉 Step 5: Triggering "Admin / Debug Probing" attack (/api/admin/secrets)...');
  await page.click('#btnProbe');
  await page.waitForTimeout(1000);
  console.log('   ✓ Unauthorized admin probe executed.\n');

  // 4. TEST VOLUMETRIC API BURST
  console.log('👉 Step 6: Triggering "API Flooding Burst" attack (20 requests/sec)...');
  await page.click('#btnBurst');
  await page.waitForTimeout(1500);
  console.log('   ✓ Volumetric API burst executed.\n');

  // Read the state from the dashboard UI
  const finalRisk = await page.textContent('#scoreVal');
  const finalAction = await page.textContent('#actionBadge');
  const finalIntent = await page.textContent('#intentVal');
  const terminalLogs = await page.innerText('#terminalLog');

  console.log('===============================================================');
  console.log('📊 FINAL LIVE TELEMETRY REPORT FROM AGENTSHIELD DASHBOARD:');
  console.log('===============================================================');
  console.log(`   Calculated Risk Score: ${finalRisk} / 100`);
  console.log(`   Enforced Shield Action: ${finalAction}`);
  console.log(`   Classified Intent:     ${finalIntent}`);
  console.log('\n📜 Terminal Audit Log Entries:');
  console.log(terminalLogs);
  console.log('===============================================================\n');

  // Take final attack simulation screenshot
  const finalShot = path.join(SCREENSHOT_DIR, '02_attack_simulation_result.png');
  await page.screenshot({ path: finalShot, fullPage: true });
  console.log(`📸 Final Screenshot saved: ${finalShot}\n`);

  await browser.close();

  console.log('🎉 Autonomous AI Agent Security Test Completed Successfully!');
}

runAutonomousAITest().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
