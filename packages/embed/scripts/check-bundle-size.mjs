#!/usr/bin/env node
import { readFile, stat } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = resolve(__dirname, '..', 'dist');
const target = resolve(distDir, 'embed.iife.js');

const HARD_CEILING_KB = 30;
const TARGET_KB = 20;

try {
  await stat(target);
} catch {
  console.error(`bundle-size: ${target} not found. Run "pnpm build" first.`);
  process.exit(2);
}

const buf = await readFile(target);
const gz = gzipSync(buf);
const kb = gz.byteLength / 1024;

const fmt = (n) => `${n.toFixed(2)} KB`;

console.log(`embed.iife.js gzipped: ${fmt(kb)}`);
console.log(`  target: ${TARGET_KB} KB`);
console.log(`  ceiling: ${HARD_CEILING_KB} KB`);

if (kb > HARD_CEILING_KB) {
  console.error(`bundle-size: HARD CEILING EXCEEDED (${fmt(kb)} > ${HARD_CEILING_KB} KB)`);
  process.exit(1);
}
if (kb > TARGET_KB) {
  console.warn(`bundle-size: warning — bundle exceeds ${TARGET_KB} KB target.`);
}
