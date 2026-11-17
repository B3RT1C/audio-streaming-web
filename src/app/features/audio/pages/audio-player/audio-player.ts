import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, DestroyRef, ElementRef, inject, OnInit, signal, ViewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { switchMap } from 'rxjs/operators';
import { AudioList } from '../../components/audio-list/audio-list';
import { FacetSearch } from '../../components/facet-search/facet-search';
import { FilterPanel } from '../../components/filter-panel/filter-panel';
import { MetadataDialog } from '../../components/metadata-dialog/metadata-dialog';
import { PlayerBar } from '../../components/player-bar/player-bar';
import { PlaylistPicker } from '../../components/playlist-picker/playlist-picker';
import { StatsView } from '../../components/stats-view/stats-view';
import { TagTypesView } from '../../components/tag-types-view/tag-types-view';
import { TagsDialog } from '../../components/tags-dialog/tags-dialog';
import { UploadDialog } from '../../components/upload-dialog/upload-dialog';
import { Artist, FilterSuggestion, TagSummary, TagType } from '../../models/catalog';
import { createUploadDraft, UploadDraft } from '../../models/upload-draft';
import { Playlist, PlaylistItem } from '../../models/playlist';
import { Track, TrackEdit, TrackRow } from '../../models/track';
import { StatsRank } from '../../models/stats';
import { AudioService } from '../../services/audio-service';
import { CatalogService } from '../../services/catalog-service';
import { PlayerService } from '../../services/player.service';
import { PlaylistService } from '../../services/playlist-service';
import { toUserMessage } from '../../utils/api-error';
import { coverArt } from '../../utils/cover-art';
import { FilterToken, tokenForTag, uniqueTokens } from '../../utils/filter-tokens';
import { PlayOrigin } from '../../utils/listen-clock';
import {
  emptyLibraryFilters,
  emptyNameTagFilters,
  libraryFiltersActive,
  libraryTextOnlyChange,
  LibraryFilters,
  NameTagFilters,
  nameTagFiltersActive,
  sameLibraryFilters,
  sameNameTagFilters,
  uniqueTags,
  viewFromSearch,
  writeViewSearch,
} from '../../utils/library-filters';
import { AssignedTag, namesToAssigned, TagWrite } from '../../utils/tag-assignment';
import { randomSeed } from '../../utils/playback-queue';
import { SEARCH_DEBOUNCE_MS } from '../../utils/search-query';
import { UPLOAD_ACCEPT, validateUploadFile } from '../../utils/upload-rules';

type Section = 'home' | 'search' | 'playlists' | 'artists' | 'tags' | 'stats';

interface TagEditTarget {
  kind: 'artist' | 'playlist';
  id: number;
  title: string;
  tags: string[];
  assigned: AssignedTag[];
}

@Component({
  selector: 'app-audio-player',
  imports: [AudioList, UploadDialog, MetadataDialog, PlaylistPicker, PlayerBar, TagsDialog, FilterPanel, FacetSearch, TagTypesView, StatsView],
  templateUrl: './audio-player.html',
  styleUrl: './audio-player.scss',
})
export class AudioPlayer implements OnInit {
  private readonly audioService = inject(AudioService);
  private readonly playlistService = inject(PlaylistService);
  private readonly catalogService = inject(CatalogService);
  private readonly destroyRef = inject(DestroyRef);
  readonly player = inject(PlayerService);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  readonly accept = UPLOAD_ACCEPT;
  readonly section = signal<Section>('home');
  readonly playlistMenu = signal(false);
  readonly cover = coverArt;
  readonly query = signal('');
  readonly facetTokens = signal<FilterToken[]>([]);
  readonly facetSuggestions = signal<FilterSuggestion[]>([]);
  readonly tagTypes = signal<TagType[]>([]);
  readonly typesLoading = signal(false);
  readonly titleFilter = signal('');
  readonly artistFilter = signal('');
  readonly songTags = signal<string[]>([]);
  readonly artistTags = signal<string[]>([]);
  readonly playlistTags = signal<string[]>([]);
  readonly results = signal<Track[]>([]);
  readonly catalog = signal<Track[]>([]);
  readonly playlists = signal<Playlist[]>([]);
  readonly playlistQuery = signal('');
  readonly playlistTagFilters = signal<string[]>([]);
  readonly playlistResults = signal<Playlist[] | null>(null);
  readonly artistQuery = signal('');
  readonly artistTagFilters = signal<string[]>([]);
  readonly artists = signal<Artist[]>([]);
  readonly tags = signal<TagSummary[]>([]);
  readonly artistsLoading = signal(false);
  readonly tagsLoading = signal(false);
  readonly tagsLoaded = signal(false);
  readonly activePlaylist = signal<Playlist | null>(null);
  readonly firstLoad = signal(true);
  readonly searching = signal(false);
  readonly libraryError = signal('');
  readonly playlistError = signal('');
  readonly artistsError = signal('');
  readonly tagsError = signal('');
  readonly actionError = signal('');
  readonly uploadMessage = signal('');
  readonly uploading = signal(false);
  readonly uploadPercent = signal<number | null>(null);
  readonly uploadStatus = signal('');
  readonly isDragging = signal(false);
  readonly uploadDrafts = signal<UploadDraft[] | null>(null);
  readonly editing = signal<Track | null>(null);
  readonly savingMeta = signal(false);
  readonly editingTags = signal<TagEditTarget | null>(null);
  readonly savingTags = signal(false);
  readonly addingTrack = signal<Track | null>(null);
  readonly newPlaylistName = signal('');
  readonly creatingPlaylist = signal(false);
  readonly renaming = signal(false);
  readonly renameValue = signal('');

  private libraryTimer = 0;
  private playlistTimer = 0;
  private artistTimer = 0;
  private libraryGeneration = 0;
  private suggestGeneration = 0;
  private artistOrigin = false;
  private holdingArtistOrigin = false;

  readonly tagNames = computed(() => this.tags().map((tag) => tag.name));

  readonly libraryFilters = computed<LibraryFilters>(() => ({
    q: this.query(),
    title: this.titleFilter(),
    artist: this.artistFilter(),
    tags: this.songTags(),
    artistTags: this.artistTags(),
    playlistTags: this.playlistTags(),
    tokens: this.facetTokens(),
  }));

  readonly playlistFilters = computed<NameTagFilters>(() => ({
    q: this.playlistQuery(),
    tags: this.playlistTagFilters(),
  }));

  readonly artistFilters = computed<NameTagFilters>(() => ({
    q: this.artistQuery(),
    tags: this.artistTagFilters(),
  }));

  readonly filtersActive = computed(() => libraryFiltersActive(this.libraryFilters()));
  readonly playlistFiltersActive = computed(() => nameTagFiltersActive(this.playlistFilters()));
  readonly artistFiltersActive = computed(() => nameTagFiltersActive(this.artistFilters()));

  readonly shownTracks = computed(() => (this.filtersActive() ? this.results() : this.catalog()));

  readonly visiblePlaylists = computed(() => this.playlistResults() ?? this.playlists());

  readonly homeEntries = computed<TrackRow[]>(() =>
    this.shownTracks().map((track) => ({ audioId: track.id, track })),
  );

  readonly searchEntries = computed<TrackRow[]>(() =>
    this.shownTracks().map((track) => ({ audioId: track.id, track })),
  );

  readonly playlistEntries = computed<TrackRow[]>(() => {
    const playlist = this.activePlaylist();
    if (!playlist?.items) {
      return [];
    }
    const byId = new Map(this.catalog().map((track) => [track.id, track]));
    return playlist.items.map((item) => ({
      audioId: item.audioId,
      track: item.audio ?? byId.get(item.audioId) ?? null,
    }));
  });

  readonly trackCountLabel = computed(() => {
    const playlist = this.activePlaylist();
    const count = playlist
      ? (playlist.items?.length ?? playlist.itemCount)
      : this.section() === 'search'
        ? this.searchEntries().length
        : this.homeEntries().length;
    return count === 1 ? '1 canción' : `${count} canciones`;
  });

  constructor() {
    this.destroyRef.onDestroy(() => {
      window.clearTimeout(this.libraryTimer);
      window.clearTimeout(this.playlistTimer);
      window.clearTimeout(this.artistTimer);
    });
  }

  ngOnInit(): void {
    const restored = viewFromSearch(location.search);
    this.query.set(restored.library.q);
    this.titleFilter.set(restored.library.title);
    this.artistFilter.set(restored.library.artist);
    this.songTags.set(restored.library.tags);
    this.artistTags.set(restored.library.artistTags);
    this.playlistTags.set(restored.library.playlistTags);
    this.facetTokens.set(restored.library.tokens ?? []);
    this.playlistQuery.set(restored.playlists.q);
    this.playlistTagFilters.set(restored.playlists.tags);
    this.artistQuery.set(restored.artists.q);
    this.artistTagFilters.set(restored.artists.tags);
    if (restored.view !== 'home') {
      this.section.set(restored.view);
    }
    this.loadCatalog();
    if (libraryFiltersActive(restored.library)) {
      this.loadLibraryNow();
    }
    this.reloadPlaylists();
    if (nameTagFiltersActive(restored.playlists)) {
      this.loadPlaylistResults();
    }
    if (restored.view === 'artists') {
      this.loadArtists();
    }
    if (restored.view === 'tags') {
      this.loadTags();
    }
    if (restored.playlistId != null) {
      this.openPlaylist(restored.playlistId);
    }
  }

  onSearchInput(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
    this.writeUrl();
    this.scheduleLibrary();
  }

  onFacetQuery(value: string): void {
    this.onSearchInput({ target: { value } } as unknown as Event);
  }

  onFacetCommit(next: { q: string; tokens: FilterToken[] }): void {
    this.query.set(next.q);
    this.facetTokens.set(uniqueTokens(next.tokens));
    this.writeUrl();
    this.loadLibraryNow();
  }

  onFacetSuggest(request: { prefix: string; q: string }): void {
    const generation = ++this.suggestGeneration;
    this.catalogService
      .suggestFilters(request.prefix, request.q)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (rows) => {
          if (generation === this.suggestGeneration) {
            this.facetSuggestions.set(rows);
          }
        },
        error: () => {
          if (generation === this.suggestGeneration) {
            this.facetSuggestions.set([]);
          }
        },
      });
  }

  openTag(tag: TagSummary): void {
    const token = tokenForTag(tag, this.tagTypes().map((type) => type.key));
    this.activePlaylist.set(null);
    this.renaming.set(false);
    this.playlistMenu.set(false);
    this.section.set(this.query().trim() ? 'search' : 'home');
    this.facetTokens.set(uniqueTokens([...this.facetTokens(), token]));
    this.writeUrl();
    this.loadLibraryNow();
  }

  onLibraryFilters(next: LibraryFilters): void {
    if (!this.holdingArtistOrigin) {
      this.artistOrigin = false;
    }
    const previous = this.libraryFilters();
    this.applyLibrary(next);
    if (sameLibraryFilters(previous, this.libraryFilters())) {
      return;
    }
    this.writeUrl();
    if (libraryTextOnlyChange(previous, this.libraryFilters())) {
      this.scheduleLibrary();
      return;
    }
    this.loadLibraryNow();
  }

  clearLibraryFilters(): void {
    this.onLibraryFilters(emptyLibraryFilters());
  }

  onPlaylistFilters(next: NameTagFilters): void {
    const previous = this.playlistFilters();
    const normalized = { q: next.q, tags: uniqueTags(next.tags) };
    if (sameNameTagFilters(previous, normalized)) {
      return;
    }
    this.playlistQuery.set(normalized.q);
    this.playlistTagFilters.set(normalized.tags);
    this.writeUrl();
    if (sameNameTagFilters({ q: previous.q, tags: normalized.tags }, previous)) {
      this.schedulePlaylists();
      return;
    }
    this.loadPlaylistResults();
  }

  clearPlaylistFilters(): void {
    this.onPlaylistFilters(emptyNameTagFilters());
  }

  onArtistFilters(next: NameTagFilters): void {
    const previous = this.artistFilters();
    const normalized = { q: next.q, tags: uniqueTags(next.tags) };
    if (sameNameTagFilters(previous, normalized)) {
      return;
    }
    this.artistQuery.set(normalized.q);
    this.artistTagFilters.set(normalized.tags);
    this.writeUrl();
    if (sameNameTagFilters({ q: previous.q, tags: normalized.tags }, previous)) {
      this.scheduleArtists();
      return;
    }
    this.loadArtists();
  }

  clearArtistFilters(): void {
    this.onArtistFilters(emptyNameTagFilters());
  }

  showLibrary(): void {
    this.showSection('home');
  }

  showSection(section: Section): void {
    this.section.set(section);
    this.playlistMenu.set(false);
    if (section !== 'playlists') {
      this.activePlaylist.set(null);
      this.renaming.set(false);
    }
    if (section === 'artists') {
      this.loadArtists();
    }
    if (section === 'tags') {
      this.loadTags();
    }
    this.writeUrl();
  }

  applyTag(name: string): void {
    this.addLibraryTag(name, 'tags');
  }

  applyArtistTag(name: string): void {
    this.addLibraryTag(name, 'artistTags');
  }

  applyPlaylistTag(name: string): void {
    this.addLibraryTag(name, 'playlistTags');
  }

  searchArtist(name: string): void {
    const artist = name.trim();
    if (!artist) {
      return;
    }
    this.activePlaylist.set(null);
    this.renaming.set(false);
    this.playlistMenu.set(false);
    this.section.set('home');
    this.artistOrigin = true;
    this.holdingArtistOrigin = true;
    this.onLibraryFilters({ ...this.libraryFilters(), artist });
    this.holdingArtistOrigin = false;
  }

  playFilteredRandom(): void {
    this.playShuffledList(this.shownTracks());
  }

  playActivePlaylistRandom(): void {
    const tracks = this.playlistEntries()
      .map((entry) => entry.track)
      .filter((entry): entry is Track => entry != null);
    this.playShuffledList(tracks);
  }

  openEdit(track: Track): void {
    this.editing.set(track);
    this.ensureTagCatalog();
  }

  editArtist(artist: Artist): void {
    this.editingTags.set({
      kind: 'artist',
      id: artist.id,
      title: `Etiquetas de ${artist.name}`,
      tags: artist.tags,
      assigned: artist.tagItems?.length ? artist.tagItems : namesToAssigned(artist.tags),
    });
    this.ensureTagCatalog();
  }

  editPlaylistTags(): void {
    const playlist = this.activePlaylist();
    if (!playlist) {
      return;
    }
    this.playlistMenu.set(false);
    this.editingTags.set({
      kind: 'playlist',
      id: playlist.id,
      title: `Etiquetas de ${playlist.name}`,
      tags: playlist.tags,
      assigned: playlist.tagItems?.length ? playlist.tagItems : namesToAssigned(playlist.tags),
    });
    this.ensureTagCatalog();
  }

  label(count: number, singular: string, plural: string): string {
    return `${count} ${count === 1 ? singular : plural}`;
  }

  openPlaylist(id: number): void {
    this.playlistService
      .get(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (playlist) => {
          if (!playlist) {
            this.playlistError.set('No se pudo leer la lista.');
            return;
          }
          this.section.set('playlists');
          this.activePlaylist.set(playlist);
          this.playlists.update((lists) =>
            lists.map((item) =>
              item.id === playlist.id
                ? { ...item, name: playlist.name, itemCount: playlist.itemCount, tags: playlist.tags }
                : item,
            ),
          );
          this.playlistError.set('');
          this.renaming.set(false);
          this.writeUrl();
        },
        error: (err: unknown) => this.playlistError.set(toUserMessage('playlist', err)),
      });
  }

  onNewPlaylistName(event: Event): void {
    this.newPlaylistName.set((event.target as HTMLInputElement).value);
  }

  createPlaylist(event: Event): void {
    event.preventDefault();
    const name = this.newPlaylistName().trim();
    if (!name || this.creatingPlaylist()) {
      return;
    }
    this.creatingPlaylist.set(true);
    this.playlistService
      .create(name)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (created) => {
          this.creatingPlaylist.set(false);
          this.newPlaylistName.set('');
          this.actionError.set('');
          this.reloadPlaylists();
          if (created) {
            this.openPlaylist(created.id);
          }
        },
        error: (err: unknown) => {
          this.creatingPlaylist.set(false);
          this.actionError.set(toUserMessage('playlist', err));
        },
      });
  }

  startRename(): void {
    this.renameValue.set(this.activePlaylist()?.name ?? '');
    this.renaming.set(true);
  }

  onRenameInput(event: Event): void {
    this.renameValue.set((event.target as HTMLInputElement).value);
  }

  saveRename(event: Event): void {
    event.preventDefault();
    const playlist = this.activePlaylist();
    const name = this.renameValue().trim();
    if (!playlist || !name) {
      return;
    }
    this.playlistService
      .rename(playlist.id, name)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.renaming.set(false);
          this.actionError.set('');
          this.reloadPlaylists();
          this.openPlaylist(playlist.id);
        },
        error: (err: unknown) => this.actionError.set(toUserMessage('playlist', err)),
      });
  }

  deletePlaylist(): void {
    const playlist = this.activePlaylist();
    if (!playlist || !confirm(`¿Eliminar la lista "${playlist.name}"?`)) {
      return;
    }
    this.playlistService
      .delete(playlist.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.activePlaylist.set(null);
          this.renaming.set(false);
          this.writeUrl();
          this.reloadPlaylists();
        },
        error: (err: unknown) => this.actionError.set(toUserMessage('playlist', err)),
      });
  }

  playVisible(track: Track): void {
    const source = this.activePlaylist()
      ? this.playlistEntries()
      : this.section() === 'search'
        ? this.searchEntries()
        : this.homeEntries();
    const tracks = source
      .map((entry) => entry.track)
      .filter((entry): entry is Track => entry != null);
    const queue = this.player.queue();
    const sameQueue =
      queue.length === tracks.length && queue.every((item, index) => item.id === tracks[index]?.id);
    if (sameQueue && this.player.current()?.id === track.id) {
      this.player.toggle();
      return;
    }
    this.player.playTracks(tracks, track.id, this.playOrigin());
  }

  playActivePlaylist(): void {
    const playlist = this.activePlaylist();
    const tracks = this.playlistEntries()
      .map((entry) => entry.track)
      .filter((entry): entry is Track => entry != null);
    if (tracks.length === 0 || !playlist) {
      this.actionError.set('Esta lista no tiene canciones reproducibles.');
      return;
    }
    this.actionError.set('');
    this.player.playTracks(tracks, tracks[0].id, { source: 'playlist', playlistId: playlist.id });
  }

  openStatsAudio(row: StatsRank): void {
    const track = this.catalog().find((item) => item.id === row.id);
    const title = track?.title || track?.name || row.name;
    const artist = track?.artist ?? '';
    this.activePlaylist.set(null);
    this.section.set('home');
    this.onLibraryFilters({ ...emptyLibraryFilters(), title, artist });
  }

  openStatsArtist(row: StatsRank): void {
    this.searchArtist(row.name);
  }

  openStatsTag(row: StatsRank): void {
    const type = row.tagType?.trim();
    if (!type || !row.name) {
      return;
    }
    this.activePlaylist.set(null);
    this.section.set('home');
    this.onLibraryFilters({ ...emptyLibraryFilters(), tokens: [{ type, value: row.name }] });
  }

  openStatsPlaylist(row: StatsRank): void {
    this.openPlaylist(row.id);
  }

  moveEntry(change: { audioId: number; direction: -1 | 1 }): void {
    const playlist = this.activePlaylist();
    if (!playlist) {
      return;
    }
    const items = playlist.items ?? [];
    const index = items.findIndex((item) => item.audioId === change.audioId);
    const target = index + change.direction;
    if (index < 0 || target < 0 || target >= items.length) {
      return;
    }
    const next = items.slice();
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);
    this.applyOrder(playlist, next);
  }

  reorderPlaylist(audioIds: number[]): void {
    const playlist = this.activePlaylist();
    if (!playlist?.items) {
      return;
    }
    const byId = new Map(playlist.items.map((item) => [item.audioId, item]));
    const next = audioIds
      .map((audioId) => byId.get(audioId))
      .filter((item): item is PlaylistItem => item != null);
    if (next.length !== playlist.items.length) {
      return;
    }
    this.applyOrder(playlist, next);
  }

  private applyOrder(playlist: Playlist, items: PlaylistItem[]): void {
    const ordered = items.map((item, position) => ({ ...item, position: position + 1 }));
    this.activePlaylist.set({
      ...playlist,
      itemCount: ordered.length,
      items: ordered,
    });
    this.playlistService
      .reorder(
        playlist.id,
        ordered.map((item) => item.audioId),
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          if (updated) {
            this.activePlaylist.set(updated);
          }
        },
        error: (err: unknown) => {
          this.actionError.set(toUserMessage('playlist', err));
          this.openPlaylist(playlist.id);
        },
      });
  }

  removeFromPlaylist(audioId: number): void {
    const playlist = this.activePlaylist();
    if (!playlist) {
      return;
    }
    this.playlistService
      .removeItem(playlist.id, audioId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.openPlaylist(playlist.id),
        error: (err: unknown) => this.actionError.set(toUserMessage('playlist', err)),
      });
  }

  addTrackToPlaylist(playlist: Playlist): void {
    const track = this.addingTrack();
    if (!track) {
      return;
    }
    this.playlistService
      .addItem(playlist.id, track.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.addingTrack.set(null);
          this.actionError.set('');
          this.reloadPlaylists();
          if (this.activePlaylist()?.id === playlist.id) {
            this.openPlaylist(playlist.id);
          }
        },
        error: (err: unknown) => this.actionError.set(toUserMessage('playlist', err)),
      });
  }

  saveMetadata(edit: TrackEdit): void {
    const track = this.editing();
    if (!track || this.savingMeta()) {
      return;
    }
    this.savingMeta.set(true);
    this.audioService
      .updateMetadata(track.id, edit.patch)
      .pipe(
        switchMap(() => this.audioService.replaceTags(track.id, edit.assignments ?? edit.tags)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.savingMeta.set(false);
          this.editing.set(null);
          this.actionError.set('');
          this.refreshLibrary();
          const playlist = this.activePlaylist();
          if (playlist) {
            this.openPlaylist(playlist.id);
          }
          if (this.tagsLoaded()) {
            this.loadTags();
          }
        },
        error: (err: unknown) => {
          this.savingMeta.set(false);
          this.actionError.set(toUserMessage('metadata', err));
        },
      });
  }

  saveTags(tags: readonly TagWrite[]): void {
    const target = this.editingTags();
    if (!target || this.savingTags()) {
      return;
    }
    this.savingTags.set(true);
    if (target.kind === 'playlist') {
      this.playlistService
        .replaceTags(target.id, tags)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (updated) => {
            if (updated) {
              this.activePlaylist.set(updated);
              this.playlists.update((lists) =>
                lists.map((item) =>
                  item.id === updated.id
                    ? { ...item, name: updated.name, itemCount: updated.itemCount, tags: updated.tags }
                    : item,
                ),
              );
            }
            this.finishTagSave();
          },
          error: (err: unknown) => {
            this.savingTags.set(false);
            this.actionError.set(toUserMessage('playlist', err));
          },
        });
      return;
    }
    this.catalogService
      .replaceArtistTags(target.id, tags)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          if (updated) {
            this.artists.update((list) => list.map((artist) => (artist.id === updated.id ? updated : artist)));
          }
          this.finishTagSave();
        },
        error: (err: unknown) => {
          this.savingTags.set(false);
          this.actionError.set(toUserMessage('metadata', err));
        },
      });
  }

  deleteTrack(track: Track): void {
    this.audioService
      .delete(track.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.player.removeTrack(track.id);
          this.refreshLibrary();
          const playlist = this.activePlaylist();
          if (playlist) {
            this.openPlaylist(playlist.id);
          }
        },
        error: (err: unknown) => this.actionError.set(toUserMessage('delete', err)),
      });
  }

  openFilePicker(): void {
    this.fileInput.nativeElement.click();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      this.openUploadDialog(Array.from(input.files));
      input.value = '';
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(false);
    this.openUploadDialog(Array.from(event.dataTransfer?.files ?? []));
  }

  cancelUploadDialog(): void {
    if (this.uploading()) {
      return;
    }
    this.uploadDrafts.set(null);
  }

  confirmUploadDialog(drafts: UploadDraft[]): void {
    void this.submitUploads(drafts);
  }

  private openUploadDialog(files: File[]): void {
    if (files.length === 0 || this.uploading()) {
      return;
    }
    const valid: File[] = [];
    const errors: string[] = [];
    for (const file of files) {
      const problem = validateUploadFile(file);
      if (problem) {
        errors.push(`${file.name}: ${problem}`);
      } else {
        valid.push(file);
      }
    }
    this.actionError.set(errors.join(' '));
    this.uploadMessage.set('');
    if (valid.length > 0) {
      this.uploadDrafts.set(valid.map(createUploadDraft));
    }
  }

  private async submitUploads(drafts: UploadDraft[]): Promise<void> {
    if (drafts.length === 0) {
      return;
    }
    this.uploading.set(true);
    this.uploadPercent.set(0);
    this.actionError.set('');
    let completed = 0;
    let failed = 0;
    let firstFailure: string | null = null;

    for (let index = 0; index < drafts.length; index += 1) {
      const draft = drafts[index];
      this.uploadStatus.set(`Subiendo ${index + 1} de ${drafts.length}: ${draft.name}`);
      try {
        await this.uploadOne(draft, index, drafts.length);
        completed += 1;
      } catch (err: unknown) {
        failed += 1;
        firstFailure ??= toUserMessage('upload', err);
      }
    }

    this.uploading.set(false);
    this.uploadDrafts.set(null);
    this.uploadPercent.set(null);
    this.uploadStatus.set('');
    if (failed === 0) {
      this.uploadMessage.set(completed === 1 ? '1 canción añadida.' : `${completed} canciones añadidas.`);
    } else if (completed === 0) {
      this.uploadMessage.set('');
      this.actionError.set(firstFailure ?? toUserMessage('upload', null));
    } else {
      this.uploadMessage.set(`${completed} de ${drafts.length} canciones añadidas.`);
      this.actionError.set(firstFailure ?? `Fallaron ${failed} subidas.`);
    }
    if (completed > 0) {
      // 201 is only { message } and has no id, so the new track comes from a fresh list.
      this.refreshLibrary();
    }
  }

  private uploadOne(draft: UploadDraft, index: number, total: number): Promise<void> {
    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (error?: unknown) => {
        if (settled) {
          return;
        }
        settled = true;
        if (error === undefined) {
          resolve();
        } else {
          reject(error);
        }
      };
      this.audioService
        .upload(draft.file, draft.name)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (event) => {
            const fraction = (event.percent ?? 0) / 100;
            this.uploadPercent.set(Math.round(((index + fraction) / total) * 100));
            if (event.done) {
              finish();
            }
          },
          error: (err: unknown) => finish(err),
          complete: () => finish(),
        });
    });
  }

  private addLibraryTag(name: string, key: 'tags' | 'artistTags' | 'playlistTags'): void {
    const tag = name.trim();
    if (!tag) {
      return;
    }
    const current = this.libraryFilters();
    this.activePlaylist.set(null);
    this.renaming.set(false);
    this.playlistMenu.set(false);
    this.section.set(current.q.trim() ? 'search' : 'home');
    this.onLibraryFilters({ ...current, [key]: uniqueTags([...current[key], tag]) });
  }

  private playShuffledList(tracks: Track[]): void {
    if (tracks.length === 0) {
      this.actionError.set('No hay canciones para reproducir.');
      return;
    }
    this.actionError.set('');
    const playlistId = this.activePlaylist()?.id;
    const origin: PlayOrigin = playlistId != null ? { source: 'shuffle', playlistId } : { source: 'shuffle' };
    this.player.playShuffled(tracks, randomSeed(), origin);
  }

  private playOrigin(): PlayOrigin {
    const playlist = this.activePlaylist();
    if (playlist) {
      return { source: 'playlist', playlistId: playlist.id };
    }
    if (this.section() === 'search') {
      return { source: 'search' };
    }
    if (this.artistOrigin && this.section() === 'home') {
      return { source: 'artist' };
    }
    return { source: 'library' };
  }

  private applyLibrary(next: LibraryFilters): void {
    this.query.set(next.q);
    this.titleFilter.set(next.title);
    this.artistFilter.set(next.artist);
    this.songTags.set(uniqueTags(next.tags));
    this.artistTags.set(uniqueTags(next.artistTags));
    this.playlistTags.set(uniqueTags(next.playlistTags));
    this.facetTokens.set(uniqueTokens(next.tokens));
  }

  private scheduleLibrary(): void {
    window.clearTimeout(this.libraryTimer);
    this.libraryTimer = window.setTimeout(() => this.loadLibraryNow(), SEARCH_DEBOUNCE_MS);
  }

  private schedulePlaylists(): void {
    window.clearTimeout(this.playlistTimer);
    this.playlistTimer = window.setTimeout(() => this.loadPlaylistResults(), SEARCH_DEBOUNCE_MS);
  }

  private scheduleArtists(): void {
    window.clearTimeout(this.artistTimer);
    this.artistTimer = window.setTimeout(() => this.loadArtists(), SEARCH_DEBOUNCE_MS);
  }

  private loadCatalog(): void {
    this.audioService
      .list('')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (tracks) => {
          this.catalog.set(tracks);
          if (!this.filtersActive()) {
            this.results.set(tracks);
          }
          this.player.syncCatalog(tracks);
          this.searching.set(false);
          this.firstLoad.set(false);
          this.libraryError.set('');
        },
        error: (err: unknown) => {
          this.searching.set(false);
          this.firstLoad.set(false);
          this.libraryError.set(toUserMessage('list', err));
        },
      });
  }

  private loadLibraryNow(): void {
    window.clearTimeout(this.libraryTimer);
    const filters = this.libraryFilters();
    const generation = ++this.libraryGeneration;
    if (!libraryFiltersActive(filters)) {
      this.results.set(this.catalog());
      this.searching.set(false);
      return;
    }
    this.searching.set(true);
    this.libraryError.set('');
    this.audioService
      .list(filters)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (tracks) => {
          if (generation !== this.libraryGeneration) {
            return;
          }
          this.results.set(tracks);
          this.searching.set(false);
          this.firstLoad.set(false);
        },
        error: (err: unknown) => {
          if (generation !== this.libraryGeneration) {
            return;
          }
          this.searching.set(false);
          this.firstLoad.set(false);
          this.libraryError.set(toUserMessage('list', err));
        },
      });
  }

  private refreshLibrary(): void {
    this.loadCatalog();
    if (this.filtersActive()) {
      this.loadLibraryNow();
    }
  }

  private reloadPlaylists(): void {
    this.playlistService
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (playlists) => {
          this.playlists.set(playlists);
          this.playlistError.set('');
          const activeId = this.activePlaylist()?.id;
          if (activeId != null && !playlists.some((playlist) => playlist.id === activeId)) {
            this.activePlaylist.set(null);
          }
        },
        error: (err: unknown) => this.playlistError.set(toUserMessage('playlist', err)),
      });
    if (this.playlistFiltersActive()) {
      this.loadPlaylistResults();
    }
  }

  private loadPlaylistResults(): void {
    window.clearTimeout(this.playlistTimer);
    const filters = this.playlistFilters();
    if (!nameTagFiltersActive(filters)) {
      this.playlistResults.set(null);
      return;
    }
    this.playlistService
      .list(filters.q, filters.tags)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (playlists) => {
          this.playlistResults.set(playlists);
          this.playlistError.set('');
        },
        error: (err: unknown) => this.playlistError.set(toUserMessage('playlist', err)),
      });
  }

  private loadArtists(): void {
    window.clearTimeout(this.artistTimer);
    const filters = this.artistFilters();
    this.artistsLoading.set(true);
    this.artistsError.set('');
    this.catalogService
      .listArtists(filters.q, filters.tags)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (artists) => {
          this.artists.set(artists);
          this.artistsLoading.set(false);
        },
        error: (err: unknown) => {
          this.artistsLoading.set(false);
          this.artistsError.set(toUserMessage('list', err));
        },
      });
  }

  private loadTags(): void {
    this.tagsLoading.set(true);
    this.tagsError.set('');
    this.catalogService
      .listTags()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (tags) => {
          this.tags.set(tags);
          this.tagsLoaded.set(true);
          this.tagsLoading.set(false);
        },
        error: (err: unknown) => {
          this.tagsLoading.set(false);
          this.tagsError.set(toUserMessage('list', err));
        },
      });
    this.loadTagTypes();
  }

  private loadTagTypes(): void {
    if (this.typesLoading()) {
      return;
    }
    this.typesLoading.set(true);
    this.catalogService
      .listTagTypes()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (types) => {
          this.tagTypes.set(types);
          this.typesLoading.set(false);
        },
        error: (err: unknown) => {
          this.typesLoading.set(false);
          this.tagsError.set(this.typeError(err));
        },
      });
  }

  createTagType(draft: { name: string; key: string; color: string }): void {
    this.catalogService
      .createTagType(draft)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.tagsError.set('');
          this.typesLoading.set(false);
          this.loadTags();
        },
        error: (err: unknown) => this.tagsError.set(this.typeError(err)),
      });
  }

  renameTagType(change: { type: TagType; name: string }): void {
    if (change.type.system) {
      return;
    }
    this.catalogService
      .updateTagType(change.type.id, { name: change.name })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.tagsError.set('');
          this.typesLoading.set(false);
          this.loadTags();
        },
        error: (err: unknown) => this.tagsError.set(this.typeError(err)),
      });
  }

  deleteTagType(type: TagType): void {
    if (type.system) {
      return;
    }
    this.catalogService
      .deleteTagType(type.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.tagsError.set('');
          this.typesLoading.set(false);
          this.loadTags();
        },
        error: (err: unknown) => this.tagsError.set(this.typeError(err)),
      });
  }

  private typeError(err: unknown): string {
    if (err instanceof HttpErrorResponse && err.status === 409) {
      return 'Los tipos de sistema no se pueden modificar.';
    }
    return toUserMessage('metadata', err);
  }

  private writeUrl(): void {
    writeViewSearch({
      view: this.section(),
      playlistId: this.activePlaylist()?.id ?? null,
      library: this.libraryFilters(),
      playlists: this.playlistFilters(),
      artists: this.artistFilters(),
    });
  }

  ensureTagCatalog(): void {
    if (!this.tagsLoaded() && !this.tagsLoading()) {
      this.loadTags();
      return;
    }
    if (this.tagTypes().length === 0 && !this.typesLoading()) {
      this.loadTagTypes();
    }
  }

  private finishTagSave(): void {
    this.savingTags.set(false);
    this.editingTags.set(null);
    this.actionError.set('');
    if (this.tagsLoaded()) {
      this.loadTags();
    }
  }
}
