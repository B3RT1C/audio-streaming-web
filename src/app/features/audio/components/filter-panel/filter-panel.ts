import { Component, computed, input, output, signal } from '@angular/core';
import { TagEditor } from '../tag-editor/tag-editor';
import { typeColor } from '../../utils/filter-tokens';
import {
  emptyLibraryFilters,
  emptyNameTagFilters,
  FilterChip,
  LibraryFilters,
  libraryChips,
  libraryFiltersActive,
  NameTagFilters,
  nameTagChips,
  nameTagFiltersActive,
  withoutLibraryChip,
  withoutNameTagChip,
} from '../../utils/library-filters';

@Component({
  selector: 'app-filter-panel',
  imports: [TagEditor],
  templateUrl: './filter-panel.html',
  styleUrl: './filter-panel.scss',
})
export class FilterPanel {
  readonly mode = input<'library' | 'catalog'>('library');
  readonly library = input<LibraryFilters>(emptyLibraryFilters());
  readonly catalog = input<NameTagFilters>(emptyNameTagFilters());
  readonly suggestions = input<string[]>([]);
  readonly namePlaceholder = input('Nombre');

  readonly libraryChange = output<LibraryFilters>();
  readonly catalogChange = output<NameTagFilters>();
  readonly cleared = output<void>();
  readonly suggestionsNeeded = output<void>();

  readonly expanded = signal(false);

  readonly chips = computed(() =>
    this.mode() === 'library' ? libraryChips(this.library()) : nameTagChips(this.catalog(), 'playlists'),
  );

  readonly active = computed(() =>
    this.mode() === 'library' ? libraryFiltersActive(this.library()) : nameTagFiltersActive(this.catalog()),
  );

  readonly combinesWithSearch = computed(() => {
    const filters = this.library();
    return this.mode() === 'library' && Boolean(filters.q.trim()) && this.chips().length > 1;
  });

  tone(type: string): string {
    return typeColor(type);
  }

  toggle(): void {
    const next = !this.expanded();
    this.expanded.set(next);
    if (next) {
      this.suggestionsNeeded.emit();
    }
  }

  askSuggestions(): void {
    this.suggestionsNeeded.emit();
  }

  onTitle(event: Event): void {
    this.libraryChange.emit({ ...this.library(), title: (event.target as HTMLInputElement).value });
  }

  onArtist(event: Event): void {
    this.libraryChange.emit({ ...this.library(), artist: (event.target as HTMLInputElement).value });
  }

  onName(event: Event): void {
    this.catalogChange.emit({ ...this.catalog(), q: (event.target as HTMLInputElement).value });
  }

  onSongTags(tags: string[]): void {
    this.libraryChange.emit({ ...this.library(), tags });
  }

  onArtistTags(tags: string[]): void {
    this.libraryChange.emit({ ...this.library(), artistTags: tags });
  }

  onPlaylistTags(tags: string[]): void {
    this.libraryChange.emit({ ...this.library(), playlistTags: tags });
  }

  onCatalogTags(tags: string[]): void {
    this.catalogChange.emit({ ...this.catalog(), tags });
  }

  remove(chip: FilterChip): void {
    if (this.mode() === 'library') {
      this.libraryChange.emit(withoutLibraryChip(this.library(), chip));
      return;
    }
    this.catalogChange.emit(withoutNameTagChip(this.catalog(), chip));
  }
}
