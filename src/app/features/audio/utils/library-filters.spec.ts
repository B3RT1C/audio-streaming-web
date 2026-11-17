import {
  audioSearchParams,
  catalogSearchParams,
  emptyLibraryFilters,
  emptyNameTagFilters,
  emptyViewState,
  libraryChips,
  libraryTextOnlyChange,
  viewFromSearch,
  viewToSearch,
  withoutLibraryChip,
  writeViewSearch,
} from './library-filters';

describe('library filters', () => {
  const full = {
    q: ' luna ',
    title: 'Noche',
    artist: 'Sol',
    tags: ['Live', ' live ', 'Pop'],
    artistTags: ['Jazz'],
    playlistTags: ['Viaje', ''],
  };

  it('builds the audio query and drops blanks, duplicates and missing shuffle', () => {
    const params = audioSearchParams(full);
    expect(params.get('q')).toBe('luna');
    expect(params.get('title')).toBe('Noche');
    expect(params.get('artist')).toBe('Sol');
    expect(params.getAll('tag')).toEqual(['Live', 'Pop']);
    expect(params.getAll('artistTag')).toEqual(['Jazz']);
    expect(params.getAll('playlistTag')).toEqual(['Viaje']);
    expect(params.has('shuffle')).toBe(false);
    expect(params.toString()).not.toContain('tag=&');

    const shuffled = audioSearchParams(emptyLibraryFilters(), { seed: 42 });
    expect(shuffled.get('shuffle')).toBe('true');
    expect(shuffled.get('seed')).toBe('42');
    expect(audioSearchParams(emptyLibraryFilters(), {}).has('seed')).toBe(false);
  });

  it('builds playlist and artist queries with repeated tags', () => {
    const params = catalogSearchParams({ q: '  ', tags: ['Pop', 'Pop', 'Jazz'] });
    expect(params.has('q')).toBe(false);
    expect(params.getAll('tag')).toEqual(['Pop', 'Jazz']);
    expect(catalogSearchParams(emptyNameTagFilters()).toString()).toBe('');
  });

  it('round-trips the view through the query string', () => {
    const state = {
      ...emptyViewState(),
      view: 'artists' as const,
      library: full,
      playlists: { q: 'Viaje', tags: ['Noche'] },
      artists: { q: 'Sol', tags: ['Jazz', 'Pop'] },
    };
    const search = viewToSearch(state);
    const restored = viewFromSearch(search);
    expect(restored.view).toBe('artists');
    expect(restored.library.q).toBe('luna');
    expect(restored.library.tags).toEqual(['Live', 'Pop']);
    expect(restored.library.artistTags).toEqual(['Jazz']);
    expect(restored.library.playlistTags).toEqual(['Viaje']);
    expect(restored.playlists).toEqual({ q: 'Viaje', tags: ['Noche'] });
    expect(restored.artists).toEqual({ q: 'Sol', tags: ['Jazz', 'Pop'] });
    expect(viewToSearch(restored)).toBe(search);
  });

  it('writes the query string and reads an open playlist back', () => {
    const previous = `${location.pathname}${location.search}`;
    try {
      const search = writeViewSearch({
        ...emptyViewState(),
        view: 'playlists',
        playlistId: 7,
        library: { ...emptyLibraryFilters(), title: 'Rio', tags: ['Live'] },
      });
      expect(location.search).toBe(`?${search}`);
      expect(search).toContain('playlist=7');
      expect(search).toContain('title=Rio');
      expect(search).toContain('tag=Live');
      const fromWindow = viewFromSearch(location.search);
      expect(fromWindow.view).toBe('playlists');
      expect(fromWindow.playlistId).toBe(7);
      expect(fromWindow.library.title).toBe('Rio');
      expect(viewToSearch(emptyViewState())).toBe('');
    } finally {
      history.replaceState(history.state, '', previous);
    }
  });

  it('removes one chip and tells text edits apart from tag edits', () => {
    const filters = {
      ...emptyLibraryFilters(),
      q: 'luna',
      title: 'Noche',
      tags: ['Live', 'Pop'],
      artistTags: ['Jazz'],
    };
    const [searchChip, , liveChip] = libraryChips(filters);
    expect(withoutLibraryChip(filters, searchChip).q).toBe('');
    expect(withoutLibraryChip(filters, liveChip).tags).toEqual(['Pop']);
    expect(libraryTextOnlyChange(filters, { ...filters, artist: 'Sol' })).toBe(true);
    expect(libraryTextOnlyChange(filters, { ...filters, tags: ['Pop'] })).toBe(false);
  });
});
