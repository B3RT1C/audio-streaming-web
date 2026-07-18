/**
 * Validates web API_PATHS against the v0.1 OpenAPI contract.
 * Run: node scripts/ci/check-api-contract.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const trackPath = path.join(root, 'src/app/features/audio/models/track.ts');
const audioServicePath = path.join(root, 'src/app/features/audio/services/audio-service.ts');
const playbackPath = path.join(root, 'src/app/features/audio/services/playback-resolver.ts');

function fail(msg) {
  console.error(`CONTRACT FAIL: ${msg}`);
  process.exit(1);
}

const track = fs.readFileSync(trackPath, 'utf8');
const audiosMatch = track.match(/audios:\s*'(\/[^']+)'/);
if (!audiosMatch) fail('API_PATHS.audios not found in track.ts');
if (audiosMatch[1] !== '/audios') fail(`API_PATHS.audios must be /audios, got ${audiosMatch[1]}`);

for (const [label, filePath] of [
  ['audio-service', audioServicePath],
  ['playback-resolver', playbackPath],
]) {
  const src = fs.readFileSync(filePath, 'utf8');
  if (!src.includes('API_PATHS')) fail(`${label} must use API_PATHS`);
  if (src.includes('/song')) fail(`${label} still references legacy /song path`);
}

console.log('CONTRACT OK: web API_PATHS match OpenAPI v0.1 (/audios)');
