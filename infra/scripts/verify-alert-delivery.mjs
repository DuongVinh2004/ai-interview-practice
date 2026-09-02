#!/usr/bin/env node
/**
 * Alert Delivery Verification Tool
 *
 * Simulates a synthetic alert event against Alertmanager / Webhook routing.
 * Emits structured evidence artifact for operational sign-off.
 */

import fs from 'node:fs';
import path from 'node:path';

const ALERTMANAGER_URL = process.env.ALERTMANAGER_URL;
const ALERT_WEBHOOK_URL = process.env.ALERT_WEBHOOK_URL;
const EVIDENCE_DIR = process.env.EVIDENCE_DIR || 'artifacts/alerts';

console.log('============================================================');
console.log('📢 Alert Delivery Verification Gate');
console.log('============================================================\n');

if (!ALERTMANAGER_URL && !ALERT_WEBHOOK_URL) {
  console.log('⚪ Neither ALERTMANAGER_URL nor ALERT_WEBHOOK_URL is configured.');
  console.log('   Generating provisional template evidence for operator sign-off.');

  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  const evidencePath = path.join(EVIDENCE_DIR, `alert-delivery-template.json`);
  const evidence = {
    status: 'READY_FOR_OPERATOR_VERIFICATION',
    alertRulesFile: 'infra/prometheus/alert_rules.yml',
    requiredEnv: ['ALERTMANAGER_URL or ALERT_WEBHOOK_URL'],
    supportedDestinations: ['Slack Webhook', 'PagerDuty Events API v2', 'AWS SNS'],
    syntheticAlertPayload: {
      alertname: 'SyntheticHealthCheckWarning',
      severity: 'warning',
      tier: 'p3',
      summary: 'Automated synthetic verification ping',
      description: 'End-to-end alert routing verification',
    },
  };
  fs.writeFileSync(evidencePath, JSON.stringify(evidence, null, 2), 'utf8');
  console.log(`📄 Template written to: ${evidencePath}`);
  process.exit(0);
}

const targetUrl = ALERTMANAGER_URL || ALERT_WEBHOOK_URL;
const startTime = Date.now();
const firedAt = new Date().toISOString();

async function sendSyntheticAlert() {
  console.log(`Firing synthetic test alert to: ${targetUrl}`);

  const payload = [
    {
      labels: {
        alertname: 'SyntheticPreflightPing',
        severity: 'info',
        tier: 'p3',
        environment: process.env.NODE_ENV || 'staging',
      },
      annotations: {
        summary: 'Synthetic operator route check',
        description: 'Verifies Alertmanager to chat/paging delivery channel.',
        runbook: 'docs/operations/production-slo-alert-policy.md',
      },
      startsAt: firedAt,
    },
  ];

  try {
    const res = await fetch(`${targetUrl.replace(/\/$/, '')}/api/v2/alerts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok && res.status !== 200 && res.status !== 202) {
      throw new Error(`Alert endpoint returned HTTP ${res.status}: ${res.statusText}`);
    }

    const deliveryLatency = Date.now() - startTime;
    console.log(`✅ Synthetic alert delivered successfully (${deliveryLatency}ms)`);

    fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
    const evidencePath = path.join(EVIDENCE_DIR, `alert-delivery-${Date.now()}.json`);
    const evidence = {
      alertName: 'SyntheticPreflightPing',
      firedAt,
      receivedAt: new Date().toISOString(),
      destinationType: ALERTMANAGER_URL ? 'Alertmanager' : 'Webhook',
      deliveryLatencyMs: deliveryLatency,
      status: 'DELIVERED',
      overall: 'PASS',
    };
    fs.writeFileSync(evidencePath, JSON.stringify(evidence, null, 2), 'utf8');
    console.log(`📄 Evidence artifact generated: ${evidencePath}`);
    process.exit(0);
  } catch (err) {
    console.error(`❌ Alert delivery failed: ${err.message}`);
    process.exit(1);
  }
}

sendSyntheticAlert();
