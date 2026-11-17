import { assignmentPayload, isTagLocked, normalizeAssignedTags } from './tag-assignment';

describe('tag assignment', () => {
  const mixed = normalizeAssignedTags([
    'Gym',
    { type: 'genre', name: 'Rock' },
    { type: 'album', name: 'Azul', readOnly: true },
    { type: 'year', name: '2014' },
    { type: 'language', name: 'Español' },
    { type: 'mood', name: 'Noche' },
    { type: 'artist', name: 'Luna' },
    { type: 'free', name: 'Directo', readOnly: false },
  ]);

  it('locks derived tags and the virtual artist type', () => {
    const byName = Object.fromEntries(mixed.map((tag) => [tag.name, tag]));
    expect(isTagLocked(byName['Rock'])).toBe(true);
    expect(isTagLocked(byName['Azul'])).toBe(true);
    expect(isTagLocked(byName['2014'])).toBe(true);
    expect(isTagLocked(byName['Luna'])).toBe(true);
    expect(isTagLocked(byName['Español'])).toBe(false);
    expect(isTagLocked(byName['Gym'])).toBe(false);
    expect(isTagLocked(byName['Noche'])).toBe(false);
    expect(byName['Rock'].readOnly).toBe(true);
    expect(byName['Gym'].type).toBe('free');
  });

  it('sends free names and typed objects, and never the derived tags', () => {
    expect(assignmentPayload(mixed)).toEqual([
      'Gym',
      { type: 'language', name: 'Español' },
      { type: 'mood', name: 'Noche' },
      'Directo',
    ]);
  });

  it('reads a nested type object the same way as a key', () => {
    expect(
      normalizeAssignedTags([
        {
          name: 'Rock',
          readOnly: true,
          type: { id: 2, key: 'genre', name: 'Género', system: true },
        },
      ]),
    ).toEqual([{ name: 'Rock', type: 'genre', readOnly: true }]);
  });

  it('ignores a read-only tag even when its type would otherwise be editable', () => {
    expect(
      assignmentPayload([
        { name: 'Clásico', type: 'language', readOnly: true },
        { name: 'Pop', type: 'language', readOnly: false },
      ]),
    ).toEqual([{ type: 'language', name: 'Pop' }]);
  });
});
