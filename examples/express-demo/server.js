import express from 'express';
import { agentShield } from 'agentshield-core';

const app = express();
const PORT = 4000;

// Apply AgentShield runtime behavior firewall
app.use(
  agentShield({
    mode: 'protect',
    sensitivity: 'balanced',
    scoreThresholds: {
      challenge: 60,
      restrict: 75,
      block: 85,
    },
  })
);

app.get('/', (req, res) => {
  res.json({
    status: 'success',
    message: 'Welcome! You passed AgentShield verification.',
    security: {
      riskScore: res.getHeader('X-AgentShield-Risk'),
      action: res.getHeader('X-AgentShield-Action'),
      sessionId: res.getHeader('X-AgentShield-Session'),
    },
  });
});

app.get('/api/users/:id', (req, res) => {
  res.json({
    userId: req.params.id,
    name: `User ${req.params.id}`,
    action: res.getHeader('X-AgentShield-Action'),
    risk: res.getHeader('X-AgentShield-Risk'),
  });
});

app.listen(PORT, () => {
  console.log(`AgentShield Test Server running at http://localhost:${PORT}`);
});
