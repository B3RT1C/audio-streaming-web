/**
 * Validates web API paths against the 0.3 client contract.
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
const playlistModelPath = path.join(root, 'src/app/features/audio/models/playlist.ts');
const catalogServicePath = path.join(root, 'src/app/features/audio/services/catalog-service.ts');
const metadataDialogPath = path.join(root, 'src/app/features/audio/components/metadata-dialog/metadata-dialog.ts');
const apiErrorPath = path.join(root, 'src/app/features/audio/utils/api-error.ts');
const playerPagePath = path.join(root, 'src/app/features/audio/pages/audio-player/audio-player.ts');
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
const artistsMatch = track.match(/artists:\s*'(\/[^']+)'/);
const tagsMatch = track.match(/tags:\s*'(\/[^']+)'/);
if (!artistsMatch || artistsMatch[1] !== '/artists') {
  fail(`API_PATHS.artists must be /artists, got ${artistsMatch?.[1]}`);
}
if (!tagsMatch || tagsMatch[1] !== '/tags') {
  fail(`API_PATHS.tags must be /tags, got ${tagsMatch?.[1]}`);
}
if (!track.includes('secondaryTitle')) fail('track model must keep secondaryTitle');
if (!track.includes('normalizeTagNames')) fail('track model must read tags');

for (const [label, filePath] of [
  ['audio-service', audioServicePath],
  ['playlist-service', playlistServicePath],
  ['catalog-service', catalogServicePath],
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

const audioService = fs.readFileSync(audioServicePath, 'utf8');
if (!audioService.includes(".set('tag'")) fail('GET /audios must send the tag query param');
if (!audioService.includes('/tags')) fail('audio service must call PUT /audios/{id}/tags');

const playlistService = fs.readFileSync(playlistServicePath, 'utf8');
if (!playlistService.includes('audioIds')) {
  fail('reorder must send { audioIds }');
}
if (!playlistService.includes('normalizePlaylistItem')) {
  fail('addItem must read the item payload, not a playlist');
}
if (!playlistService.includes('/tags')) fail('playlist service must call PUT /playlists/{id}/tags');

const catalogService = fs.readFileSync(catalogServicePath, 'utf8');
if (!catalogService.includes('API_PATHS.artists') || !catalogService.includes('API_PATHS.tags')) {
  fail('catalog service must use API_PATHS.artists and API_PATHS.tags');
}
if (!catalogService.includes('/tags')) fail('catalog service must call PUT /artists/{id}/tags');

const playlistModel = fs.readFileSync(playlistModelPath, 'utf8');
if (!playlistModel.includes('itemCount')) fail('playlist model must keep itemCount from list summaries');
if (!playlistModel.includes('position')) fail('playlist items must keep position, which can have gaps');
if (!playlistModel.includes('tags')) fail('playlist model must keep tags on list summaries');

const dialog = fs.readFileSync(metadataDialogPath, 'utf8');
if (!dialog.includes('secondaryTitle')) fail('the song editor must send secondaryTitle');

const errors = fs.readFileSync(apiErrorPath, 'utf8');
for (const code of ['FILE_TOO_LARGE', 'INVALID_ORDER', 'RANGE_NOT_SATISFIABLE']) {
  if (!errors.includes(code)) fail(`missing error code ${code}`);
}

const playerPage = fs.readFileSync(playerPagePath, 'utf8');
if (!playerPage.includes('refreshLibrary()')) {
  fail('the player must reload the library after upload, because POST /audios returns no id');
}

console.log(
  'CONTRACT OK: web client matches backend 0.3.0 (/audios, /playlists, /artists, /tags, secondaryTitle)',
);
