#!/usr/bin/env node
/**
 * VAPID Keypair Generator for Web Push Notifications (Plan C5)
 *
 * Generates ECDSA P-256 base64url-encoded public and private keypair
 * compliant with RFC 8292.
 */

import { createRequire } from 'node:module';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const repositoryRoot = resolve(fileURLToPath(new URL('../../', import.meta.url)));

let webpush;
try {
  webpush = require(resolve(repositoryRoot, 'apps/api/node_modules/web-push'));
} catch {
  try {
    webpush = require('web-push');
  } catch (err) {
    console.error('❌ Failed to load web-push dependency:', err.message);
    process.exit(1);
  }
}

const args = process.argv.slice(2);
const isJson = args.includes('--json');
const shouldWrite = args.includes('--write');

const vapidKeys = webpush.generateVAPIDKeys();

if (isJson) {
  console.log(JSON.stringify(vapidKeys, null, 2));
  process.exit(0);
}

console.log('============================================================');
console.log('🔑  Web Push VAPID Keypair Generator (RFC 8292)');
console.log('============================================================\n');
console.log('VAPID_PUBLIC_KEY:');
console.log(vapidKeys.publicKey);
console.log('\nVAPID_PRIVATE_KEY:');
console.log(vapidKeys.privateKey);
console.log('\n--- [.env format] ---');
console.log(`VAPID_PUBLIC_KEY="${vapidKeys.publicKey}"`);
console.log(`VAPID_PRIVATE_KEY="${vapidKeys.privateKey}"`);
console.log('VAPID_SUBJECT="mailto:admin@ai-interview.dev"');

if (shouldWrite) {
  const envPath = resolve(repositoryRoot, '.env');
  if (existsSync(envPath)) {
    let content = readFileSync(envPath, 'utf-8');
    const pubRegex = /^VAPID_PUBLIC_KEY=.*$/m;
    const privRegex = /^VAPID_PRIVATE_KEY=.*$/m;
    const subRegex = /^VAPID_SUBJECT=.*$/m;

    if (pubRegex.test(content)) {
      content = content.replace(pubRegex, `VAPID_PUBLIC_KEY="${vapidKeys.publicKey}"`);
    } else {
      content += `\nVAPID_PUBLIC_KEY="${vapidKeys.publicKey}"`;
    }

    if (privRegex.test(content)) {
      content = content.replace(privRegex, `VAPID_PRIVATE_KEY="${vapidKeys.privateKey}"`);
    } else {
      content += `\nVAPID_PRIVATE_KEY="${vapidKeys.privateKey}"`;
    }

    if (!subRegex.test(content)) {
      content += `\nVAPID_SUBJECT="mailto:admin@ai-interview.dev"`;
    }

    writeFileSync(envPath, content, 'utf-8');
    console.log(`\n✅ Successfully updated VAPID keys in ${envPath}`);
  } else {
    console.log(`\n⚠️  .env file not found at ${envPath}, skipped write.`);
  }
}

console.log('\n============================================================');
