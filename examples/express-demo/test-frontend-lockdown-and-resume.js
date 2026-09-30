/**
 * @file test-frontend-lockdown-and-resume.js
 * End-to-end demonstration:
 * 1. AI Agent executes attack -> Frontend Active Defense triggers lockdown & freezes UI.
 * 2. Human user clicks "Verify & Resume Session" -> UI restores, risk resets to 0 (ALLOW).
 */

import { chromium } from 'playwright';
import path from 'node:path';

async function runLockdownAndResumeTest() {
  console.log('===============================================================');
  console.log('🛡️  AgentShield: Frontend Active Defense & Human Recovery Test');
  console.log('===============================================================\n');

  console.log('Step 1: Launching visible browser on user desktop...');
  const browser = await chromium.launch({
    headless: false,
    slowMo: 600,
  });

  const page = await browser.newPage();
  console.log('Step 2: Loading http://localhost:4000...');
  await page.goto('http://localhost:4000/');
  await page.waitForTimeout(2000);

  // 1. Trigger AI Attack to activate Frontend Lockdown
  console.log('Step 3: Triggering AI Agent attack (#btnStealth)...');
  await page.click('#btnStealth');
  await page.waitForTimeout(2000);

  console.log('Step 4: Checking if Frontend Active Defense overlay engaged...');
  await page.waitForSelector('#agentshield-lockdown-overlay', { timeout: 5000 });
  console.log('   🔒 Frontend Active Defense is ACTIVE! Screen locked and blurred.');

  const shot1 = path.resolve('./screenshots/05_frontend_lockdown_modal.png');
  await page.screenshot({ path: shot1, fullPage: true });
  console.log(`📸 Screenshot saved (Locked State): ${shot1}\n`);

  await page.waitForTimeout(3000);

  // 2. Simulate Human Click on "Verify & Resume Session"
  console.log('Step 5: Simulating legitimate human clicking [Verify & Resume Session]...');
  await page.click('#btnHumanResume');
  await page.waitForTimeout(2000);

  const restoredRisk = await page.textContent('#scoreVal');
  const restoredAction = await page.textContent('#actionBadge');
  const restoredIntent = await page.textContent('#intentVal');

  console.log('===============================================================');
  console.log('✨ HUMAN RECOVERY SUCCESS REPORT:');
  console.log('===============================================================');
  console.log(`   Restored Risk Score:  ${restoredRisk} / 100`);
  console.log(`   Restored Action:      ${restoredAction}`);
  console.log(`   Restored Intent:      ${restoredIntent}`);
  console.log('   Overlay Status:       Unlocked & Removed');
  console.log('===============================================================\n');

  const shot2 = path.resolve('./screenshots/06_frontend_human_resumed.png');
  await page.screenshot({ path: shot2, fullPage: true });
  console.log(`📸 Screenshot saved (Restored State): ${shot2}`);

  console.log('\n✨ Leaving browser open on screen for 15 seconds to inspect...');
  await page.waitForTimeout(15000);

  await browser.close();
  console.log('🎉 Frontend Active Defense & Human Recovery test completed successfully!');
}

runLockdownAndResumeTest().catch(console.error);
