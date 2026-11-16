/**
 * Validates web API paths against the 0.2 client contract.
 * Run: node scripts/ci/check-api-contract.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const trackPath = path.join(root, 'src/app/features/audio/models/track.ts');
const audioServicePath = path.join(root, 'src/app/features/audio/services/audio-service.ts');
const playlistServicePath = path.join(root, 'src/app/features/audio/services/playlist-service.ts');
const playbackPath = path.join(root, 'src/app/features/audio/services/playback-resolver.ts');
const prodEnvPath = path.join(root, 'src/environments/environment.prod.ts');
const configPath = path.join(root, 'public/config.json');

function fail(msg) {
  console.error(`CONTRACT FAIL: ${msg}`);
  process.exit(1);
}

const track = fs.readFileSync(trackPath, 'utf8');
const audiosMatch = track.match(/audios:\s*'(\/[^']+)'/);
const playlistsMatch = track.match(/playlists:\s*'(\/[^']+)'/);
if (!audiosMatch) fail('API_PATHS.audios not found in track.ts');
if (audiosMatch[1] !== '/audios') fail(`API_PATHS.audios must be /audios, got ${audiosMatch[1]}`);
if (!playlistsMatch) fail('API_PATHS.playlists not found in track.ts');
if (playlistsMatch[1] !== '/playlists') {
  fail(`API_PATHS.playlists must be /playlists, got ${playlistsMatch[1]}`);
}

for (const [label, filePath] of [
  ['audio-service', audioServicePath],
  ['playlist-service', playlistServicePath],
  ['playback-resolver', playbackPath],
]) {
  const src = fs.readFileSync(filePath, 'utf8');
  if (!src.includes('API_PATHS')) fail(`${label} must use API_PATHS`);
  if (src.includes('/song')) fail(`${label} still references legacy /song path`);
  if (src.includes('192.168.')) fail(`${label} hardcodes a LAN address`);
}

const prod = fs.readFileSync(prodEnvPath, 'utf8');
if (prod.includes('192.168.') || prod.includes('apiUrl')) {
  fail('production environment must not hardcode an API URL');
}

const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
if (!Object.prototype.hasOwnProperty.call(config, 'apiUrl')) {
  fail('public/config.json must expose apiUrl');
}

console.log('CONTRACT OK: web API paths match the 0.2 client contract (/audios, /playlists)');
