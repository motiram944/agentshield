/**
 * @file test-normal-flow.js
 * Demonstrates:
 * 1. Genuine Human Browsing (webdriver = false) -> HTTP 200, Risk: 0, ALLOW
 * 2. Automated AI/Bot Browser (webdriver = true)  -> HTTP 428, Risk: 65, CHALLENGE
 */

import { chromium } from 'playwright';

async function runTest() {
  console.log('===============================================================');
  console.log('🔍 Testing "Normal Human Flow" vs "AI / Automation Detection"');
  console.log('===============================================================\n');

  // Test Case A: Real Human Simulation (bypassing webdriver flag)
  console.log('👤 [Test 1] Simulating Genuine Human User (navigator.webdriver = false)...');
  const browser1 = await chromium.launch({ headless: false, slowMo: 500 });
  const context1 = await browser1.newContext();
  
  // Inject script to ensure webdriver is false like a real human
  await context1.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });

  const page1 = await context1.newPage();
  await page1.goto('http://localhost:4000/');
  await page1.waitForTimeout(1500);

  console.log('   👉 Clicking [Normal Human Flow] as a Human...');
  await page1.click('#btnNormal');
  await page1.waitForTimeout(2000);

  const humanRisk = await page1.textContent('#scoreVal');
  const humanAction = await page1.textContent('#actionBadge');
  console.log(`   ✅ Human Result: Risk Score = ${humanRisk}, Action = ${humanAction}\n`);

  await page1.waitForTimeout(3000);
  await browser1.close();

  // Test Case B: Automated Bot / AI Agent (webdriver = true)
  console.log('🤖 [Test 2] Simulating Automated AI Bot / Driver (navigator.webdriver = true)...');
  const browser2 = await chromium.launch({ headless: false, slowMo: 500 });
  const context2 = await browser2.newContext();
  
  const page2 = await context2.newPage();
  await page2.goto('http://localhost:4000/');
  await page2.waitForTimeout(1500);

  console.log('   👉 Clicking [Normal Human Flow] as an Automated Bot...');
  await page2.click('#btnNormal');
  await page2.waitForTimeout(2000);

  const botRisk = await page2.textContent('#scoreVal');
  const botAction = await page2.textContent('#actionBadge');
  console.log(`   🛡️ Bot Result: Risk Score = ${botRisk}, Action = ${botAction} (CHALLENGE issued)\n`);

  await page2.waitForTimeout(4000);
  await browser2.close();

  console.log('===============================================================');
  console.log('✨ Summary:');
  console.log(`   - Genuine Human:   Risk ${humanRisk} -> ${humanAction} (Allowed directly)`);
  console.log(`   - Automated Driver: Risk ${botRisk} -> ${botAction} (Challenged as AI/Bot)`);
  console.log('===============================================================');
}

runTest().catch(console.error);
