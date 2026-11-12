#!/usr/bin/env node

/**
 * AnyF Engineering Arena — Challenge Pack Seeder CLI
 *
 * Usage:
 *   node infra/scripts/arena-seed.mjs
 *   node infra/scripts/arena-seed.mjs --dir ./challenges/pack-001-profile-bola
 */

import path from 'node:path';
import process from 'node:process';
import { findChallengeDirs, seedChallengePack, parseArgs } from './arena-validate.mjs';

async function main() {
  const { targetDir } = parseArgs();
  const rootDir = process.cwd();
  const scanTarget = targetDir
    ? path.resolve(rootDir, targetDir)
    : path.resolve(rootDir, 'challenges');

  console.log('\n==============================================================================');
  console.log('🌱  [AnyF Engineering Arena] Automated Challenge Pack Seeder');
  console.log(`📁 Target Directory: ${scanTarget}`);
  console.log('==============================================================================\n');

  const challengeDirs = findChallengeDirs(scanTarget);
  if (challengeDirs.length === 0) {
    console.error(`❌ No challenge directories with manifest.json found in: ${scanTarget}`);
    process.exit(1);
  }

  let seededCount = 0;
  for (const dir of challengeDirs) {
    await seedChallengePack(dir);
    seededCount++;
  }

  console.log('\n==============================================================================');
  console.log(`🎉 Successfully seeded ${seededCount} challenge packs into catalog.`);
  console.log('==============================================================================\n');
}

main().catch((err) => {
  console.error('Fatal seeder error:', err);
  process.exit(1);
});
