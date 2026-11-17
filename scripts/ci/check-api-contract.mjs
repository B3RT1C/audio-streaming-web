/**
 * Validates web API paths against the 0.4.1 client contract.
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
const filtersPath = path.join(root, 'src/app/features/audio/utils/library-filters.ts');
const tokensPath = path.join(root, 'src/app/features/audio/utils/filter-tokens.ts');
const assignmentPath = path.join(root, 'src/app/features/audio/utils/tag-assignment.ts');
const originPath = path.join(root, 'src/app/core/api-origin.ts');
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
const tagTypesMatch = track.match(/tagTypes:\s*'(\/[^']+)'/);
const suggestMatch = track.match(/filterSuggest:\s*'(\/[^']+)'/);
if (!tagTypesMatch || tagTypesMatch[1] !== '/tag-types') {
  fail(`API_PATHS.tagTypes must be /tag-types, got ${tagTypesMatch?.[1]}`);
}
if (!suggestMatch || suggestMatch[1] !== '/filter/suggest') {
  fail(`API_PATHS.filterSuggest must be /filter/suggest, got ${suggestMatch?.[1]}`);
}
if (!track.includes('secondaryTitle')) fail('track model must keep secondaryTitle');
if (!track.includes('normalizeAssignedTags')) fail('track model must read tags');

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
if (!audioService.includes('audioSearchParams')) fail('GET /audios must build filters with audioSearchParams');
if (!audioService.includes('listShuffled')) fail('GET /audios must support shuffle and seed');
if (!audioService.includes('/tags')) fail('audio service must call PUT /audios/{id}/tags');

const filters = fs.readFileSync(filtersPath, 'utf8');
for (const key of ['q', 'title', 'artist', 'tag', 'artistTag', 'playlistTag', 'shuffle', 'seed', 'f']) {
  if (!filters.includes(`'${key}'`)) fail(`library filters must send ${key}`);
}
const tokens = fs.readFileSync(tokensPath, 'utf8');
for (const prefix of ['artista', 'género', 'álbum', 'año', 'idioma', 'playlist']) {
  if (!tokens.includes(`'${prefix}'`)) fail(`filter tokens must serialize ${prefix}`);
}
if (!tokens.includes("return `#${value}`")) fail('free tags must serialize with a hash');
const assignment = fs.readFileSync(assignmentPath, 'utf8');
if (!assignment.includes('isDerivedType') || !assignment.includes('assignmentPayload')) {
  fail('tag assignment must omit derived tags from PUT bodies');
}
if (!filters.includes('viewToSearch') || !filters.includes('viewFromSearch')) {
  fail('filters must round-trip through the page query string');
}

const origin = fs.readFileSync(originPath, 'utf8');
if (!origin.includes('DEFAULT_API_PORT = 8080')) fail('default API port must stay 8080');

const playlistService = fs.readFileSync(playlistServicePath, 'utf8');
if (!playlistService.includes('audioIds')) {
  fail('reorder must send { audioIds }');
}
if (!playlistService.includes('normalizePlaylistItem')) {
  fail('addItem must read the item payload, not a playlist');
}
if (!playlistService.includes('/tags')) fail('playlist service must call PUT /playlists/{id}/tags');
if (!playlistService.includes('catalogSearchParams')) {
  fail('GET /playlists must send q and repeated tag');
}

const catalogService = fs.readFileSync(catalogServicePath, 'utf8');
if (!catalogService.includes('API_PATHS.artists') || !catalogService.includes('API_PATHS.tags')) {
  fail('catalog service must use API_PATHS.artists and API_PATHS.tags');
}
if (!catalogService.includes('/tags')) fail('catalog service must call PUT /artists/{id}/tags');
if (!catalogService.includes('catalogSearchParams')) {
  fail('GET /artists must send q and repeated tag');
}
if (!catalogService.includes('API_PATHS.tagTypes')) fail('catalog service must call /tag-types');
if (!catalogService.includes('suggestFilters') || !catalogService.includes('API_PATHS.filterSuggest')) {
  fail('catalog service must call GET /filter/suggest');
}
if (!catalogService.includes(".set('prefix'") || !catalogService.includes(".set('q'")) {
  fail('GET /filter/suggest must send prefix and q');
}

const playlistModel = fs.readFileSync(playlistModelPath, 'utf8');
if (!playlistModel.includes('itemCount')) fail('playlist model must keep itemCount from list summaries');
if (!playlistModel.includes('position')) fail('playlist items must keep position, which can have gaps');
if (!playlistModel.includes('tags')) fail('playlist model must keep tags on list summaries');

const dialog = fs.readFileSync(metadataDialogPath, 'utf8');
if (!dialog.includes('secondaryTitle')) fail('the song editor must send secondaryTitle');

const errors = fs.readFileSync(apiErrorPath, 'utf8');
for (const code of ['FILE_TOO_LARGE', 'INVALID_ORDER', 'INVALID_QUERY', 'RANGE_NOT_SATISFIABLE']) {
  if (!errors.includes(code)) fail(`missing error code ${code}`);
}

const playerPage = fs.readFileSync(playerPagePath, 'utf8');
if (!playerPage.includes('refreshLibrary()')) {
  fail('the player must reload the library after upload, because POST /audios returns no id');
}
if (!playerPage.includes('playShuffled')) {
  fail('the player must be able to start a shuffled queue');
}

console.log(
  'CONTRACT OK: web client matches backend 0.4.1 (/audios?f, /filter/suggest, /tag-types, /playlists, /artists, /tags)',
);
