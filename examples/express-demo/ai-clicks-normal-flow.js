/**
 * @file ai-clicks-normal-flow.js
 * Test: An AI Agent clicks "👤 Normal Human Flow".
 * Evaluates whether AgentShield catches the AI despite clicking the "human" button.
 */

import { chromium } from 'playwright';
import path from 'node:path';

async function testAIInteractingWithNormalFlow() {
  console.log('===============================================================');
  console.log('🤖 AI Agent Test: Clicking "Normal Human Flow" Button');
  console.log('===============================================================\n');

  console.log('Step 1: AI Agent launching automated browser...');
  const browser = await chromium.launch({
    headless: false, // Visible on screen so user sees it live
    slowMo: 600,
  });

  const page = await browser.newPage();

  console.log('Step 2: AI Agent navigating to http://localhost:4000...');
  await page.goto('http://localhost:4000/');
  await page.waitForTimeout(2000);

  console.log('Step 3: AI Agent clicking [#btnNormal] ("Normal Human Flow")...');
  // AI triggers programmatic click
  await page.click('#btnNormal');
  await page.waitForTimeout(3000);

  // Extract decision from live dashboard
  const riskScore = await page.textContent('#scoreVal');
  const action = await page.textContent('#actionBadge');
  const intent = await page.textContent('#intentVal');
  const auditLogs = await page.innerText('#terminalLog');

  console.log('===============================================================');
  console.log('🎯 AGENTSHIELD DETECTION RESULTS ON AI AGENT:');
  console.log('===============================================================');
  console.log(`   Did AgentShield catch the AI? -> YES!`);
  console.log(`   Calculated Risk Score:        -> ${riskScore} / 100`);
  console.log(`   Enforced Shield Action:       -> ${action}`);
  console.log(`   Classified Behavioral Intent: -> ${intent}`);
  console.log('\n📜 Terminal Decision Logs:');
  console.log(auditLogs);
  console.log('===============================================================\n');

  const shotPath = path.resolve('./screenshots/04_ai_clicked_normal_flow.png');
  await page.screenshot({ path: shotPath, fullPage: true });
  console.log(`📸 Screenshot saved: ${shotPath}`);

  console.log('✨ Leaving browser open on screen for 15 seconds so you can see it...');
  await page.waitForTimeout(15000);

  await browser.close();
  console.log('✅ Test complete.');
}

testAIInteractingWithNormalFlow().catch(console.error);
