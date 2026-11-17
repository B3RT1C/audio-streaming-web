import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AssignedTag } from '../../utils/tag-assignment';
import { TypedTagEditor } from './typed-tag-editor';

describe('TypedTagEditor', () => {
  const initial: AssignedTag[] = [
    { name: 'Rock', type: 'genre', readOnly: true },
    { name: 'Azul', type: 'album', readOnly: true },
    { name: '2014', type: 'year', readOnly: true },
    { name: 'Español', type: 'language', readOnly: false },
    { name: 'Gym', type: 'free', readOnly: false },
    { name: 'Noche', type: 'mood', readOnly: false },
  ];

  let fixture: ComponentFixture<TypedTagEditor>;
  let component: TypedTagEditor;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TypedTagEditor],
    }).compileComponents();
    fixture = TestBed.createComponent(TypedTagEditor);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('tags', initial);
    fixture.componentRef.setInput('types', [
      { id: 1, key: 'genre', name: 'Género', system: true, color: null, tagCount: 1, audioCount: 1, artistCount: 0, playlistCount: 0 },
      { id: 2, key: 'album', name: 'Álbum', system: true, color: null, tagCount: 1, audioCount: 1, artistCount: 0, playlistCount: 0 },
      { id: 3, key: 'year', name: 'Año', system: true, color: null, tagCount: 1, audioCount: 1, artistCount: 0, playlistCount: 0 },
      { id: 4, key: 'language', name: 'Idioma', system: true, color: null, tagCount: 1, audioCount: 1, artistCount: 0, playlistCount: 0 },
      { id: 5, key: 'free', name: 'Libre', system: true, color: null, tagCount: 1, audioCount: 1, artistCount: 0, playlistCount: 0 },
      { id: 6, key: 'mood', name: 'Mood', system: false, color: '#f9a8d4', tagCount: 1, audioCount: 1, artistCount: 0, playlistCount: 0 },
    ]);
    fixture.componentRef.setInput('catalog', [
      { id: 8, name: 'Jazz', type: 'genre', readOnly: true, audioCount: 2, artistCount: 0, playlistCount: 0 },
      { id: 9, name: 'Inglés', type: 'language', readOnly: false, audioCount: 1, artistCount: 0, playlistCount: 0 },
    ]);
    fixture.detectChanges();
  });

  it('shows derived tags without a way to remove or extend them', () => {
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('[aria-label="Quitar Rock"]')).toBeNull();
    expect(root.querySelector('[aria-label="Quitar Azul"]')).toBeNull();
    expect(root.querySelector('[aria-label="Quitar 2014"]')).toBeNull();
    expect(root.querySelector('[data-type="genre"] input')).toBeNull();
    expect(root.querySelector('[data-type="album"] input')).toBeNull();
    expect(root.querySelector('[data-type="year"] input')).toBeNull();
    expect(root.querySelector('[aria-label="Quitar Gym"]')).not.toBeNull();
    expect(root.querySelector('[aria-label="Quitar Español"]')).not.toBeNull();
    expect(root.querySelector('[aria-label="Quitar Noche"]')).not.toBeNull();

    const emitted: AssignedTag[][] = [];
    component.tagsChange.subscribe((tags) => emitted.push(tags));
    component.remove(initial[0]);
    component.remove(initial[1]);
    component.remove(initial[2]);
    component.add('genre', 'Jazz');
    component.add('album', 'Rojo');
    component.add('year', '2015');
    expect(emitted).toEqual([]);
  });

  it('adds and removes language, free and user tags and keeps the derived ones', () => {
    const emitted: AssignedTag[][] = [];
    component.tagsChange.subscribe((tags) => emitted.push(tags));
    component.add('language', 'inglés');
    component.add('free', 'Directo');
    component.add('free', 'gym');
    component.remove(initial[4]);

    expect(emitted).toHaveLength(3);
    expect(emitted[0]?.some((tag) => tag.type === 'language' && tag.name === 'Inglés')).toBe(true);
    expect(emitted[0]?.some((tag) => tag.type === 'genre' && tag.name === 'Rock')).toBe(true);
    expect(emitted[1]?.some((tag) => tag.type === 'free' && tag.name === 'Directo')).toBe(true);
    expect(emitted[2]?.some((tag) => tag.type === 'free' && tag.name === 'Gym')).toBe(false);
    expect(emitted[2]?.some((tag) => tag.type === 'year' && tag.name === '2014')).toBe(true);
    expect(emitted[2]?.some((tag) => tag.type === 'album' && tag.name === 'Azul')).toBe(true);
  });
});
