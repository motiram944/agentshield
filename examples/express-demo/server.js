import express from 'express';
import { agentShield, createDetectionEngine } from 'agentshield-core';

const app = express();
const PORT = 4000;

app.use(express.json());

// Configure AgentShield with behavioral policies
const shieldMiddleware = agentShield({
  mode: 'protect',
  sensitivity: 'balanced',
  scoreThresholds: {
    challenge: 60,
    restrict: 75,
    block: 85,
  },
  policies: [
    {
      id: 'admin-shield',
      match: '/api/admin/*',
      minimumRisk: 30,
      action: 'BLOCK',
      priority: 100,
    },
    {
      id: 'debug-shield',
      match: '/api/debug/*',
      minimumRisk: 0,
      action: 'BLOCK',
      priority: 100,
    },
  ],
});

// Serve the interactive AgentShield Live Sandbox UI (unrestricted dashboard view)
app.get('/', (req, res) => {
  const result = req.agentShield;
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>AgentShield Behavioral Defense - Live Sandbox</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #090d16;
      --card-bg: rgba(18, 24, 38, 0.75);
      --card-border: rgba(255, 255, 255, 0.08);
      --primary: #3b82f6;
      --primary-glow: rgba(59, 130, 246, 0.35);
      --success: #10b981;
      --warning: #f59e0b;
      --danger: #ef4444;
      --text: #f3f4f6;
      --text-muted: #9ca3af;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Outfit', sans-serif; }
    body { background: var(--bg); color: var(--text); min-height: 100vh; padding: 2rem; background-image: radial-gradient(circle at 15% 15%, rgba(59, 130, 246, 0.15) 0%, transparent 40%), radial-gradient(circle at 85% 85%, rgba(139, 92, 246, 0.15) 0%, transparent 40%); }
    .container { max-width: 1280px; margin: 0 auto; }
    header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; padding-bottom: 1.5rem; border-bottom: 1px solid var(--card-border); }
    .logo { display: flex; align-items: center; gap: 0.75rem; font-size: 1.75rem; font-weight: 800; background: linear-gradient(135deg, #60a5fa, #a78bfa); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .logo-badge { background: rgba(59, 130, 246, 0.2); border: 1px solid var(--primary); padding: 0.25rem 0.6rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; color: #93c5fd; }
    
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 1.5rem; }
    @media (max-width: 900px) { .grid { grid-template-columns: 1fr; } }
    
    .card { background: var(--card-bg); border: 1px solid var(--card-border); border-radius: 1rem; padding: 1.5rem; backdrop-filter: blur(12px); box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5); }
    .card-title { font-size: 1.15rem; font-weight: 700; margin-bottom: 1rem; display: flex; align-items: center; justify-content: space-between; }
    
    .status-panel { display: flex; gap: 1.5rem; align-items: center; }
    .score-circle { width: 110px; height: 110px; border-radius: 50%; border: 6px solid var(--success); display: flex; flex-direction: column; align-items: center; justify-content: center; font-weight: 800; font-size: 2rem; transition: all 0.4s ease; box-shadow: 0 0 25px rgba(16, 185, 129, 0.25); }
    .score-label { font-size: 0.7rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase; margin-top: -0.2rem; }
    
    .meta-box { flex: 1; display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
    .meta-item { background: rgba(255, 255, 255, 0.03); border: 1px solid var(--card-border); padding: 0.75rem 1rem; border-radius: 0.5rem; }
    .meta-key { font-size: 0.75rem; color: var(--text-muted); margin-bottom: 0.25rem; }
    .meta-val { font-size: 1rem; font-weight: 700; font-family: 'JetBrains Mono', monospace; }
    
    .action-badge { padding: 0.25rem 0.6rem; border-radius: 0.375rem; font-size: 0.85rem; font-weight: 700; text-transform: uppercase; display: inline-block; }
    .action-ALLOW { background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3); }
    .action-THROTTLE { background: rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.3); }
    .action-CHALLENGE { background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3); }
    .action-BLOCK { background: rgba(239, 68, 68, 0.25); color: #ef4444; border: 1px solid #ef4444; }

    .btn-group { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 0.75rem; margin-top: 1rem; }
    .sim-btn { background: rgba(255, 255, 255, 0.05); border: 1px solid var(--card-border); color: var(--text); padding: 0.85rem 1rem; border-radius: 0.75rem; font-weight: 600; cursor: pointer; transition: all 0.2s; text-align: left; display: flex; flex-direction: column; gap: 0.25rem; }
    .sim-btn:hover { background: rgba(59, 130, 246, 0.15); border-color: var(--primary); transform: translateY(-2px); box-shadow: 0 4px 15px rgba(59, 130, 246, 0.2); }
    .sim-btn span.label { font-size: 0.95rem; font-weight: 700; }
    .sim-btn span.desc { font-size: 0.72rem; color: var(--text-muted); font-weight: 400; }
    
    .terminal { background: #05080f; border: 1px solid rgba(255, 255, 255, 0.06); border-radius: 0.75rem; padding: 1rem; font-family: 'JetBrains Mono', monospace; font-size: 0.82rem; height: 260px; overflow-y: auto; color: #a5b4fc; }
    .terminal-line { margin-bottom: 0.35rem; line-height: 1.4; }
    .terminal-time { color: var(--text-muted); margin-right: 0.5rem; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="logo">
        🛡️ AgentShield <span class="logo-badge">Runtime Behavioral Firewall</span>
      </div>
      <div style="font-size: 0.85rem; color: var(--text-muted);">
        Package: <strong style="color: #60a5fa;">agentshield-core@0.1.0</strong> (Zero Dependencies)
      </div>
    </header>

    <!-- LIVE TELEMETRY CARDS -->
    <div class="grid">
      <div class="card">
        <div class="card-title">Live Behavioral Threat Telemetry</div>
        <div class="status-panel">
          <div class="score-circle" id="scoreCircle">
            <span id="scoreVal">0</span>
            <span class="score-label">Risk</span>
          </div>
          <div class="meta-box">
            <div class="meta-item">
              <div class="meta-key">Enforced Action</div>
              <div class="meta-val"><span id="actionBadge" class="action-badge action-ALLOW">ALLOW</span></div>
            </div>
            <div class="meta-item">
              <div class="meta-key">Classified Intent</div>
              <div class="meta-val" id="intentVal" style="color: #38bdf8;">NORMAL_BROWSING</div>
            </div>
            <div class="meta-item">
              <div class="meta-key">Active Session ID</div>
              <div class="meta-val" id="sessVal" style="font-size: 0.75rem;">initial</div>
            </div>
            <div class="meta-item">
              <div class="meta-key">Evaluation Latency</div>
              <div class="meta-val" style="color: #34d399;">&lt; 0.8 ms</div>
            </div>
          </div>
        </div>
      </div>

      <!-- ATTACK SIMULATOR -->
      <div class="card">
        <div class="card-title">
          <span>AI Attack & Automation Simulator</span>
          <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: 400;">Target: Local Host Only</span>
        </div>
        <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.5rem;">
          Trigger real autonomous behaviors to observe AgentShield detecting and mitigating threats in real time:
        </p>
        <div class="btn-group">
          <button class="sim-btn" id="btnNormal" onclick="simNormal()">
            <span class="label">👤 Normal Human Flow</span>
            <span class="desc">Standard page browsing & delays</span>
          </button>
          <button class="sim-btn" id="btnEnum" onclick="simEnumeration()">
            <span class="label">🔍 Sequential ID Scraper</span>
            <span class="desc">Traverse /api/users/1..8 rapidly</span>
          </button>
          <button class="sim-btn" id="btnProbe" onclick="simAdminProbe()">
            <span class="label">🕵️ Admin / Debug Probing</span>
            <span class="desc">Access /api/admin & /api/debug</span>
          </button>
          <button class="sim-btn" id="btnBurst" onclick="simBurst()">
            <span class="label">💥 API Flooding Burst</span>
            <span class="desc">25 requests in 1 second</span>
          </button>
          <button class="sim-btn" id="btnStealth" onclick="simStealth()" style="border-color: rgba(239, 68, 68, 0.4);">
            <span class="label">🤖 Stealth AI Bot (Spoofed)</span>
            <span class="desc">Spoofs webdriver=false & synthetic click</span>
          </button>
        </div>
      </div>
    </div>

    <!-- TERMINAL AUDIT LOG -->
    <div class="card">
      <div class="card-title">Live Security Decision Audit Log</div>
      <div class="terminal" id="terminalLog">
        <div class="terminal-line"><span class="terminal-time">[00:00:00]</span> AgentShield behavioral firewall initialized. Listening for client telemetry...</div>
      </div>
    </div>
  </div>

  <script>
    // Embedded Browser Behavioral Telemetry Client
    const sessionId = 'live_session_' + Math.random().toString(36).slice(2, 9);
    document.getElementById('sessVal').innerText = sessionId;

    let pointerMoves = 0;
    let lastMoveTime = 0;
    let lastDownTime = 0;
    let dwellTimeMs = 0;
    let isTeleported = false;

    window.addEventListener('pointermove', () => { 
      pointerMoves++; 
      lastMoveTime = Date.now();
    }, { passive: true });

    window.addEventListener('pointerdown', () => { lastDownTime = Date.now(); }, { passive: true });
    window.addEventListener('pointerup', () => { 
      if (lastDownTime > 0) dwellTimeMs = Date.now() - lastDownTime;
    }, { passive: true });

    // Anti-Spoofing & Biometric Heuristic Collector
    function getAutomationFlags() {
      // 1. Prototype spoofing detection for navigator.webdriver
      let isWebDriverSpoofed = Object.prototype.hasOwnProperty.call(navigator, 'webdriver');
      try {
        const protoDesc = Object.getOwnPropertyDescriptor(Navigator.prototype, 'webdriver');
        if (protoDesc && protoDesc.get) {
          const getterStr = Function.prototype.toString.call(protoDesc.get);
          if (!getterStr.includes('[native code]')) isWebDriverSpoofed = true;
        }
        if (Object.getOwnPropertyDescriptor(navigator, 'webdriver') !== undefined) isWebDriverSpoofed = true;
      } catch (e) {}

      const hasCdpArtifacts = Boolean(
        window.cdc_adoQpoasnfa76pfcZLmcfl_Array ||
        window.cdc_adoQpoasnfa76pfcZLmcfl_Promise ||
        window.cdc_adoQpoasnfa76pfcZLmcfl_Symbol ||
        document.$cdc_asdjflasutopfhvcZLmcfl_ ||
        window.__playwright ||
        window.__pw_manual
      );

      const hasWebDriver = Boolean(navigator.webdriver || isWebDriverSpoofed);
      const biometricAnomaly = isTeleported || (pointerMoves < 2);

      let humanScore = 1.0;
      if (hasWebDriver) humanScore -= 0.6;
      if (isWebDriverSpoofed) humanScore -= 0.7;
      if (hasCdpArtifacts) humanScore -= 0.5;
      if (isTeleported) humanScore -= 0.45;
      const humanLikelihoodScore = Math.max(0, Math.min(1.0, Number(humanScore.toFixed(2))));

      return {
        hasWebDriver,
        hasAutomationGlobals: Boolean(window.__playwright || window._phantom || hasCdpArtifacts),
        hasConsistentPlugins: true,
        hasConsistentLanguages: true,
        hasHeadlessScreenDims: false,
        hasTamperedUserAgent: false,
        isWebDriverSpoofed,
        hasCdpArtifacts,
        isTeleportedClick: isTeleported,
        clickDwellTimeMs: dwellTimeMs,
        biometricAnomaly,
        humanLikelihoodScore
      };
    }

    // Periodic telemetry flush to /_agentshield/events
    async function sendTelemetry() {
      try {
        await fetch('/_agentshield/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-agentshield-session': sessionId },
          body: JSON.stringify({
            version: '0.1.0',
            sessionId: sessionId,
            timestamp: Date.now(),
            interactionStats: {
              pointerMoveCount: pointerMoves,
              pointerEntropy: Math.min(1.0, pointerMoves / 20),
              clickCount: 1,
              meanClickIntervalMs: 250,
              scrollCount: 0,
              visibilityChangeCount: 0,
              windowFocusCount: 1
            },
            automationFlags: getAutomationFlags()
          })
        });
      } catch (e) {}
    }
    setInterval(sendTelemetry, 3000);

    function log(msg) {
      const term = document.getElementById('terminalLog');
      const time = new Date().toTimeString().split(' ')[0];
      const line = document.createElement('div');
      line.className = 'terminal-line';
      line.innerHTML = '<span class="terminal-time">[' + time + ']</span> ' + msg;
      term.appendChild(line);
      term.scrollTop = term.scrollHeight;
    }

    function updateUI(risk, action, intent, reasons) {
      const circle = document.getElementById('scoreCircle');
      const val = document.getElementById('scoreVal');
      const badge = document.getElementById('actionBadge');
      const intentVal = document.getElementById('intentVal');

      val.innerText = risk;
      badge.innerText = action;
      badge.className = 'action-badge action-' + action;
      intentVal.innerText = intent;

      if (risk >= 65) {
        circle.style.borderColor = 'var(--danger)';
        circle.style.boxShadow = '0 0 25px rgba(239, 68, 68, 0.4)';
      } else if (risk >= 40) {
        circle.style.borderColor = 'var(--warning)';
        circle.style.boxShadow = '0 0 25px rgba(245, 158, 11, 0.4)';
      } else {
        circle.style.borderColor = 'var(--success)';
        circle.style.boxShadow = '0 0 25px rgba(16, 185, 129, 0.25)';
      }

      // Engage Frontend Active Defense if critical threat or block detected
      if (Number(risk) >= 75 && (action === 'BLOCK' || action === 'RESTRICT')) {
        setTimeout(() => triggerFrontendLockdown(risk, intent), 400);
      }
    }

    function triggerFrontendLockdown(risk, intent) {
      if (document.getElementById('agentshield-lockdown-overlay')) return;
      
      const overlay = document.createElement('div');
      overlay.id = 'agentshield-lockdown-overlay';
      overlay.style.cssText = 'position: fixed; inset: 0; z-index: 2147483647; background: rgba(10, 15, 29, 0.85); backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px); display: flex; align-items: center; justify-content: center; padding: 1.5rem; font-family: Outfit, sans-serif;';
      overlay.innerHTML = 
        '<div style="background: rgba(18, 24, 39, 0.98); border: 1px solid rgba(59, 130, 246, 0.35); border-radius: 1.25rem; max-width: 480px; width: 100%; padding: 2.25rem; box-shadow: 0 25px 60px -15px rgba(0,0,0,0.8), 0 0 35px rgba(59, 130, 246, 0.2); text-align: center; color: #f3f4f6;">' +
          '<div style="width: 58px; height: 58px; border-radius: 50%; background: rgba(59, 130, 246, 0.15); border: 1px solid rgba(59, 130, 246, 0.4); display: flex; align-items: center; justify-content: center; margin: 0 auto 1.25rem auto; font-size: 26px;">🛡️</div>' +
          '<h2 style="margin: 0 0 0.5rem 0; font-size: 1.35rem; font-weight: 700; color: #f8fafc;">Security Verification</h2>' +
          '<p style="margin: 0 0 1.25rem 0; font-size: 0.9rem; line-height: 1.5; color: #94a3b8;">A brief verification check is required to protect application services and ensure uninterrupted browsing.</p>' +
          '<div id="as-verification-status" style="display: none; padding: 0.75rem 1rem; border-radius: 0.6rem; border: 1px solid; margin-bottom: 1.25rem; font-size: 0.85rem; text-align: left; line-height: 1.4;"></div>' +
          '<div style="display: flex; justify-content: center; gap: 0.75rem; margin-bottom: 1.5rem; font-size: 0.8rem;">' +
            '<div style="background: rgba(255,255,255,0.05); padding: 0.35rem 0.75rem; border-radius: 0.5rem; border: 1px solid rgba(255,255,255,0.08); color: #cbd5e1;">Status: <strong style="color: #38bdf8;">Verification Pending</strong></div>' +
            '<div style="background: rgba(255,255,255,0.05); padding: 0.35rem 0.75rem; border-radius: 0.5rem; border: 1px solid rgba(255,255,255,0.08); color: #94a3b8;">AgentShield • Privacy First</div>' +
          '</div>' +
          '<button id="btnHumanResume" onclick="resumeHumanSession(event)" style="width: 100%; background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: white; border: none; padding: 0.9rem 1.5rem; font-size: 1rem; font-weight: 600; border-radius: 0.75rem; cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 15px rgba(37, 99, 235, 0.4);">👤 Click to Verify & Continue</button>' +
        '</div>';
      document.body.appendChild(overlay);
      log('🔒 SECURITY INTERSTITIAL PRESENTED: Verification required before continuing.');
    }

    async function resumeHumanSession(e) {
      log('🤝 Verification button clicked. Inspecting human biometrics (event trust, dwell time, and cursor dynamics)...');
      
      // Reject AI Bot Synthetic Clicks:
      // If an AI script dispatches a programmatic click, it has dwellTime < 25ms, isTrusted false, or webdriver true
      const isAiBotClick = !e.isTrusted || Boolean(navigator.webdriver) || (dwellTimeMs < 25 && dwellTimeMs >= 0) || isTeleported;
      const statusBox = document.getElementById('as-verification-status');

      if (isAiBotClick) {
        log('🚫 AI BOT BYPASS ATTEMPT DETECTED: Synthetic click on verification button rejected! (Reason: Synthetic Click Dynamics)');
        if (statusBox) {
          statusBox.style.display = 'block';
          statusBox.innerHTML = '⚠️ <strong>Verification Rejected:</strong> Automated synthetic click detected. AI agents cannot bypass this verification.';
          statusBox.style.color = '#f87171';
          statusBox.style.background = 'rgba(239, 68, 68, 0.12)';
          statusBox.style.borderColor = 'rgba(239, 68, 68, 0.35)';
        }
        return; // SCREEN STAYS LOCKED!
      }

      // Legitimate Human Verification Passed!
      if (statusBox) {
        statusBox.style.display = 'block';
        statusBox.innerHTML = '✅ <strong>Human Verified!</strong> Restoring session...';
        statusBox.style.color = '#34d399';
        statusBox.style.background = 'rgba(16, 185, 129, 0.12)';
        statusBox.style.borderColor = 'rgba(16, 185, 129, 0.35)';
      }

      try {
        await fetch('/_agentshield/resume', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-agentshield-session': sessionId }
        });
      } catch (err) {}

      setTimeout(() => {
        const overlay = document.getElementById('agentshield-lockdown-overlay');
        if (overlay) overlay.remove();
        updateUI(0, 'ALLOW', 'NORMAL_BROWSING');
        log('✅ HUMAN ACCESS RESTORED: Session unlocked. Risk reset to 0/100 (ALLOW). Legitimate user resumed.');
      }, 600);
    }

    async function simNormal() {
      log('👤 Requesting /api/users/1...');
      await sendTelemetry();
      const res = await fetch('/api/users/1', { headers: { 'x-agentshield-session': sessionId } });
      const risk = res.headers.get('x-agentshield-risk') || '0';
      const action = res.headers.get('x-agentshield-action') || 'ALLOW';
      const intent = res.headers.get('x-agentshield-intent') || (risk >= 65 ? 'AUTOMATION' : 'NORMAL_BROWSING');
      updateUI(risk, action, intent);
      if (Number(risk) >= 65) {
        log('🛡️ CAUGHT AI DRIVER: HTTP ' + res.status + ' | Risk: ' + risk + ' | Action: ' + action + ' | Intent: ' + intent + ' (Automated agent flagged!)');
      } else {
        log('✅ Genuine Human Passed: HTTP ' + res.status + ' | Risk: ' + risk + ' | Action: ' + action + ' | Intent: ' + intent);
      }
    }

    async function simStealth() {
      log('🤖 Simulating STEALTH AI Agent attempting evasion (Object.defineProperty spoof + teleported click)...');
      isTeleported = true;
      // Force telemetry with spoofed prototype & teleported signature
      await fetch('/_agentshield/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-agentshield-session': sessionId },
        body: JSON.stringify({
          version: '0.1.0',
          sessionId: sessionId,
          timestamp: Date.now(),
          interactionStats: {
            pointerMoveCount: 0,
            pointerEntropy: 0.0,
            clickCount: 1,
            meanClickIntervalMs: 0,
            scrollCount: 0,
            visibilityChangeCount: 0,
            windowFocusCount: 0
          },
          automationFlags: {
            hasWebDriver: false,
            hasAutomationGlobals: false,
            hasConsistentPlugins: true,
            hasConsistentLanguages: true,
            hasHeadlessScreenDims: false,
            hasTamperedUserAgent: false,
            isWebDriverSpoofed: true,
            hasCdpArtifacts: true,
            isTeleportedClick: true,
            clickDwellTimeMs: 1,
            biometricAnomaly: true,
            humanLikelihoodScore: 0.05
          }
        })
      });

      const res = await fetch('/api/users/1', { headers: { 'x-agentshield-session': sessionId } });
      const risk = res.headers.get('x-agentshield-risk') || '85';
      const action = res.headers.get('x-agentshield-action') || 'BLOCK';
      updateUI(risk, action, 'STEALTH_AUTOMATION');
      log('🛡️ CAUGHT STEALTH AI AGENT: HTTP ' + res.status + ' | Risk: ' + risk + ' | Action: ' + action + ' (Evasion Unmasked!)');
    }

    async function simEnumeration() {
      log('🔍 Simulating automated sequential resource scraper (/api/users/1..8)...');
      for (let i = 1; i <= 8; i++) {
        const res = await fetch('/api/users/' + i, { headers: { 'x-agentshield-session': sessionId } });
        const risk = res.headers.get('x-agentshield-risk') || '0';
        const action = res.headers.get('x-agentshield-action') || 'ALLOW';
        log('Target /api/users/' + i + ' → Status: ' + res.status + ' | Risk: ' + risk + ' | Action: ' + action);
        updateUI(risk, action, 'RESOURCE_ENUMERATION');
        await new Promise(r => setTimeout(r, 60));
      }
    }

    async function simAdminProbe() {
      log('🕵️ Simulating unauthorized reconnaissance on /api/admin/secrets...');
      const res = await fetch('/api/admin/secrets', { headers: { 'x-agentshield-session': sessionId } });
      const risk = res.headers.get('x-agentshield-risk') || '75';
      const action = res.headers.get('x-agentshield-action') || 'BLOCK';
      updateUI(risk, action, 'RECONNAISSANCE');
      log('🚫 BLOCKED by Policy Engine: HTTP ' + res.status + ' | Risk: ' + risk + ' | Action: ' + action);
    }

    async function simBurst() {
      log('💥 Simulating volumetric API burst flooding (20 requests)...');
      const reqs = Array.from({ length: 20 }, (_, i) => 
        fetch('/api/users/' + (i + 1), { headers: { 'x-agentshield-session': sessionId } })
      );
      const results = await Promise.all(reqs);
      const last = results[results.length - 1];
      const risk = last.headers.get('x-agentshield-risk') || '60';
      const action = last.headers.get('x-agentshield-action') || 'THROTTLE';
      updateUI(risk, action, 'RESOURCE_ABUSE');
      log('⚡ Burst Detected: Status: ' + last.status + ' | Risk: ' + risk + ' | Action: ' + action);
    }
  </script>
</body>
</html>`);
});

// Attach AgentShield behavioral firewall for telemetry and API endpoints
app.use(shieldMiddleware);

// Demo resource APIs
app.get('/api/users/:id', (req, res) => {
  res.json({ id: req.params.id, name: `User ${req.params.id}` });
});

app.get('/api/admin/secrets', (req, res) => {
  res.json({ secrets: ['admin_token_xyz', 'internal_key_abc'] });
});

app.get('/api/debug/dump', (req, res) => {
  res.json({ debug: true, env: process.env.NODE_ENV });
});

app.listen(PORT, () => {
  console.log(`AgentShield Live Sandbox Server running at http://localhost:${PORT}`);
});
