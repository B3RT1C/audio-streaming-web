import {
  canonicalType,
  inspectDraft,
  matchingPrefixes,
  parseFilterToken,
  serializeFilterToken,
  tokenForTag,
  uniqueTokens,
} from './filter-tokens';

describe('filter tokens', () => {
  it('parses accented and plain prefixes into the same type', () => {
    expect(parseFilterToken('género:rock')).toEqual({ type: 'genre', value: 'rock' });
    expect(parseFilterToken('genero:Rock')).toEqual({ type: 'genre', value: 'Rock' });
    expect(parseFilterToken('GÉNERO: jazz ')).toEqual({ type: 'genre', value: 'jazz' });
    expect(parseFilterToken('álbum:Azul')).toEqual({ type: 'album', value: 'Azul' });
    expect(parseFilterToken('album:Azul')).toEqual({ type: 'album', value: 'Azul' });
    expect(parseFilterToken('año:2010-2015')).toEqual({ type: 'year', value: '2010-2015' });
    expect(parseFilterToken('ano:2010-2015')).toEqual({ type: 'year', value: '2010-2015' });
    expect(parseFilterToken('Año:2014')).toEqual({ type: 'year', value: '2014' });
    expect(parseFilterToken('artista:Ana López')).toEqual({ type: 'artist', value: 'Ana López' });
    expect(parseFilterToken('artist:Ana')).toEqual({ type: 'artist', value: 'Ana' });
    expect(parseFilterToken('idioma:Español')).toEqual({ type: 'language', value: 'Español' });
    expect(parseFilterToken('language:es')).toEqual({ type: 'language', value: 'es' });
    expect(parseFilterToken('lista:Viaje')).toEqual({ type: 'playlist', value: 'Viaje' });
    expect(parseFilterToken('playlist:Viaje')).toEqual({ type: 'playlist', value: 'Viaje' });
  });

  it('treats a hash and a bare value as free tags, and keeps user type keys', () => {
    expect(parseFilterToken('#gym')).toEqual({ type: 'free', value: 'gym' });
    expect(parseFilterToken('# Gym ')).toEqual({ type: 'free', value: 'Gym' });
    expect(parseFilterToken('gym')).toEqual({ type: 'free', value: 'gym' });
    expect(parseFilterToken('mood:gym', ['mood'])).toEqual({ type: 'mood', value: 'gym' });
    expect(parseFilterToken('Mood:Gym')).toEqual({ type: 'mood', value: 'Gym' });
    expect(parseFilterToken('')).toBeNull();
    expect(parseFilterToken('#')).toBeNull();
    expect(parseFilterToken('género:')).toBeNull();
    expect(parseFilterToken('año:   ')).toBeNull();
  });

  it('serializes back to the accented prefix and the hash form', () => {
    expect(serializeFilterToken(parseFilterToken('genero:rock')!)).toBe('género:rock');
    expect(serializeFilterToken(parseFilterToken('género:rock')!)).toBe('género:rock');
    expect(serializeFilterToken(parseFilterToken('ano:2010-2015')!)).toBe('año:2010-2015');
    expect(serializeFilterToken(parseFilterToken('album:Azul')!)).toBe('álbum:Azul');
    expect(serializeFilterToken(parseFilterToken('artista:Ana López')!)).toBe('artista:Ana López');
    expect(serializeFilterToken(parseFilterToken('gym')!)).toBe('#gym');
    expect(serializeFilterToken(parseFilterToken('#Gym')!)).toBe('#Gym');
    expect(serializeFilterToken(parseFilterToken('mood:gym')!)).toBe('mood:gym');
    expect(serializeFilterToken(parseFilterToken('lista:Viaje')!)).toBe('playlist:Viaje');
    expect(tokenForTag({ type: 'genre', name: 'Rock' })).toEqual({ type: 'genre', value: 'Rock' });
    expect(tokenForTag({ name: 'Gym' })).toEqual({ type: 'free', value: 'Gym' });
    expect(canonicalType('Género')).toBe('genre');
    expect(canonicalType('#')).toBe('free');
  });

  it('drops duplicate tokens and suggests prefixes while the word is unfinished', () => {
    expect(
      uniqueTokens([
        { type: 'genre', value: 'Rock' },
        { type: 'genre', value: ' rock ' },
        { type: 'free', value: 'gym' },
        { type: 'year', value: '' },
      ]),
    ).toEqual([
      { type: 'genre', value: 'Rock' },
      { type: 'free', value: 'gym' },
    ]);
    expect(inspectDraft('  género: ro ').kind).toBe('prefixed');
    expect(inspectDraft('  género: ro ').q).toBe('ro');
    expect(inspectDraft('#gy').prefix).toBe('#');
    expect(matchingPrefixes('gé').map((item) => item.type)).toEqual(['genre']);
    expect(matchingPrefixes('mo', [{ key: 'mood', name: 'Mood' }]).map((item) => item.prefix)).toEqual(['mood']);
    expect(matchingPrefixes('género:r')).toEqual([]);
    expect(matchingPrefixes('#gym')).toEqual([]);
  });
});
