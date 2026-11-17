import { Component, computed, DestroyRef, ElementRef, inject, OnInit, signal, ViewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { merge, of, Subject } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, map, skip, switchMap, take, tap } from 'rxjs/operators';
import { AudioList } from '../../components/audio-list/audio-list';
import { MetadataDialog } from '../../components/metadata-dialog/metadata-dialog';
import { PlayerBar } from '../../components/player-bar/player-bar';
import { PlaylistPicker } from '../../components/playlist-picker/playlist-picker';
import { TagsDialog } from '../../components/tags-dialog/tags-dialog';
import { UploadDialog } from '../../components/upload-dialog/upload-dialog';
import { Artist, TagSummary } from '../../models/catalog';
import { createUploadDraft, UploadDraft } from '../../models/upload-draft';
import { Playlist, PlaylistItem } from '../../models/playlist';
import { Track, TrackEdit, TrackRow } from '../../models/track';
import { AudioService } from '../../services/audio-service';
import { CatalogService } from '../../services/catalog-service';
import { PlayerService } from '../../services/player.service';
import { PlaylistService } from '../../services/playlist-service';
import { toUserMessage } from '../../utils/api-error';
import { coverArt } from '../../utils/cover-art';
import { SEARCH_DEBOUNCE_MS } from '../../utils/search-query';
import { UPLOAD_ACCEPT, validateUploadFile } from '../../utils/upload-rules';

type Section = 'home' | 'search' | 'playlists' | 'artists' | 'tags';

interface TagEditTarget {
  kind: 'artist' | 'playlist';
  id: number;
  title: string;
  tags: string[];
}

@Component({
  selector: 'app-audio-player',
  imports: [AudioList, UploadDialog, MetadataDialog, PlaylistPicker, PlayerBar, TagsDialog],
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
  readonly tagFilter = signal('');
  readonly results = signal<Track[]>([]);
  readonly tagged = signal<Track[]>([]);
  readonly catalog = signal<Track[]>([]);
  readonly playlists = signal<Playlist[]>([]);
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

  private readonly searchTerms = new Subject<string>();

  readonly tagNames = computed(() => this.tags().map((tag) => tag.name));

  readonly homeEntries = computed<TrackRow[]>(() => {
    const source = this.tagFilter().trim() ? this.tagged() : this.catalog();
    return source.map((track) => ({ audioId: track.id, track }));
  });

  readonly searchEntries = computed<TrackRow[]>(() => {
    const query = this.query().trim();
    const tag = this.tagFilter().trim();
    const source = !query && tag ? this.tagged() : this.results();
    return source.map((track) => ({ audioId: track.id, track }));
  });

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
    const immediate = this.searchTerms.pipe(take(1));
    const later = this.searchTerms.pipe(
      skip(1),
      debounceTime(SEARCH_DEBOUNCE_MS),
      map((term) => term.trim()),
      distinctUntilChanged(),
    );
    merge(immediate, later)
      .pipe(
        switchMap((term) => this.loadLibrary(term)),
        takeUntilDestroyed(),
      )
      .subscribe();
  }

  ngOnInit(): void {
    this.searchTerms.next('');
    this.reloadPlaylists();
  }

  onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.query.set(value);
    this.searchTerms.next(value);
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
  }

  applyTag(name: string): void {
    const tag = name.trim();
    if (!tag) {
      return;
    }
    this.tagFilter.set(tag);
    this.activePlaylist.set(null);
    this.renaming.set(false);
    this.playlistMenu.set(false);
    const query = this.query().trim();
    this.section.set(query ? 'search' : 'home');
    this.loadLibrary('').pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
    if (query) {
      this.loadLibrary(query).pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
    }
  }

  clearTag(): void {
    if (!this.tagFilter()) {
      return;
    }
    this.tagFilter.set('');
    this.tagged.set([]);
    this.loadLibrary(this.query().trim()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
  }

  searchArtist(name: string): void {
    this.query.set(name);
    this.activePlaylist.set(null);
    this.section.set('search');
    this.searchTerms.next(name);
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
    this.player.playTracks(tracks, track.id);
  }

  playActivePlaylist(): void {
    const tracks = this.playlistEntries()
      .map((entry) => entry.track)
      .filter((entry): entry is Track => entry != null);
    if (tracks.length === 0) {
      this.actionError.set('Esta lista no tiene canciones reproducibles.');
      return;
    }
    this.actionError.set('');
    this.player.playTracks(tracks, tracks[0].id);
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
        switchMap(() => this.audioService.replaceTags(track.id, edit.tags)),
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

  saveTags(tags: string[]): void {
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

  private loadLibrary(term: string) {
    const tag = this.tagFilter().trim();
    this.searching.set(true);
    this.libraryError.set('');
    return this.audioService.list(term, tag).pipe(
      tap((tracks) => {
        if (!term && !tag) {
          this.catalog.set(tracks);
          this.results.set(tracks);
        } else if (!term && tag) {
          this.tagged.set(tracks);
        } else {
          this.results.set(tracks);
        }
        this.player.syncCatalog(this.catalog());
        this.searching.set(false);
        this.firstLoad.set(false);
      }),
      catchError((err: unknown) => {
        this.searching.set(false);
        this.firstLoad.set(false);
        this.libraryError.set(toUserMessage('list', err));
        return of(null);
      }),
    );
  }

  private refreshLibrary(): void {
    const term = this.query().trim();
    const tag = this.tagFilter().trim();
    if (!term && !tag) {
      this.loadLibrary('').pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
      return;
    }
    this.audioService
      .list('')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((tracks) => {
        this.catalog.set(tracks);
        this.player.syncCatalog(tracks);
      });
    if (tag) {
      this.loadLibrary('').pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
    }
    if (term) {
      this.loadLibrary(term).pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
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
  }

  private loadArtists(): void {
    this.artistsLoading.set(true);
    this.artistsError.set('');
    this.catalogService
      .listArtists()
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
  }

  private ensureTagCatalog(): void {
    if (this.tagsLoaded() || this.tagsLoading()) {
      return;
    }
    this.loadTags();
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
