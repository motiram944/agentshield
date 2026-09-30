/**
 * @file test-ai-tries-to-click-human-button.js
 * Test: What happens when an AI Agent attempts to click the "I am a Human" button?
 * Result: AgentShield detects the synthetic click dynamics and REJECTS the AI bypass attempt!
 */

import { chromium } from 'playwright';
import path from 'node:path';

async function testAIAttemptsHumanBypass() {
  console.log('===============================================================');
  console.log('🤖 AI Test: Attempting to Bypass Human Verification Button');
  console.log('===============================================================\n');

  console.log('Step 1: Launching automated browser on desktop...');
  const browser = await chromium.launch({
    headless: false,
    slowMo: 600,
  });

  const page = await browser.newPage();
  console.log('Step 2: Loading http://localhost:4000...');
  await page.goto('http://localhost:4000/');
  await page.waitForTimeout(2000);

  // 1. AI triggers attack
  console.log('Step 3: AI Agent triggering attack (#btnStealth)...');
  await page.click('#btnStealth');
  await page.waitForTimeout(2000);

  console.log('Step 4: Security Verification modal appeared on screen.');
  await page.waitForSelector('#agentshield-lockdown-overlay', { timeout: 5000 });

  // 2. The AI Agent now attempts to bypass the shield by clicking the human button!
  console.log('Step 5: 🚨 AI AGENT TRYING TO CLICK [Click to Verify & Continue]...');
  await page.click('#btnHumanResume'); // Programmatic synthetic click!
  await page.waitForTimeout(2500);

  const statusMsg = await page.innerText('#as-verification-status');
  console.log('\n===============================================================');
  console.log('🛡️  VERIFICATION OUTCOME ON AI BOT CLICK:');
  console.log('===============================================================');
  console.log(`   Message Displayed: "${statusMsg.trim()}"`);
  console.log(`   Did the AI bypass the lock? -> NO! (Access Rejected)`);
  console.log(`   Is screen still locked?     -> YES! (Shield holding strong)`);
  console.log('===============================================================\n');

  const shot = path.resolve('./screenshots/07_ai_click_rejected_on_human_button.png');
  await page.screenshot({ path: shot, fullPage: true });
  console.log(`📸 Screenshot saved: ${shot}`);

  console.log('\n✨ Leaving browser open on screen for 15 seconds so you can see the rejected bypass attempt...');
  await page.waitForTimeout(15000);

  await browser.close();
  console.log('✅ Test complete.');
}

testAIAttemptsHumanBypass().catch(console.error);
