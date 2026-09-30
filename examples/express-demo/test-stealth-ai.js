/**
 * @file test-stealth-ai.js
 * Demonstrates detecting and unmasking a STEALTH AI Agent:
 * - Spoofs navigator.webdriver = false
 * - Attempts to mimic human browsing
 * - AgentShield unmasks prototype tampering + biometric teleportation + CDP markers
 * - Triggers STEALTH_AUTOMATION block
 */

import { chromium } from 'playwright';
import path from 'node:path';

async function runStealthAIDetectionTest() {
  console.log('===============================================================');
  console.log('🛡️  AgentShield: Testing Stealth AI Agent & Evasion Detection');
  console.log('===============================================================\n');

  console.log('🤖 Step 1: Launching AI browser attempting stealth evasion...');
  const browser = await chromium.launch({
    headless: false,
    slowMo: 600,
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 850 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });

  // Inject stealth evasion: pretend webdriver is false
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });

  const page = await context.newPage();

  console.log('🌐 Step 2: Navigating to Live Sandbox (http://localhost:4000)...');
  await page.goto('http://localhost:4000/');
  await page.waitForTimeout(2000);

  console.log('👉 Step 3: Triggering Stealth AI Agent attack simulation...');
  await page.click('#btnStealth');
  await page.waitForTimeout(3000);

  const finalRisk = await page.textContent('#scoreVal');
  const finalAction = await page.textContent('#actionBadge');
  const finalIntent = await page.textContent('#intentVal');
  const terminalLogs = await page.innerText('#terminalLog');

  console.log('===============================================================');
  console.log('📊 LIVE TELEMETRY REPORT: STEALTH AI UNMASKED:');
  console.log('===============================================================');
  console.log(`   Calculated Risk Score: ${finalRisk} / 100`);
  console.log(`   Enforced Shield Action: ${finalAction}`);
  console.log(`   Classified Intent:     ${finalIntent}`);
  console.log('\n📜 Terminal Audit Log Entries:');
  console.log(terminalLogs);
  console.log('===============================================================\n');

  const shotPath = path.resolve('./screenshots/03_stealth_ai_blocked.png');
  await page.screenshot({ path: shotPath, fullPage: true });
  console.log(`📸 Screenshot saved: ${shotPath}\n`);

  await page.waitForTimeout(5000);
  await browser.close();

  console.log('🎉 Stealth AI Agent Detection Test Completed Successfully!');
}

runStealthAIDetectionTest().catch(console.error);
