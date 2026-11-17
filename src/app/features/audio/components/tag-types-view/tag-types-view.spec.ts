import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { TagType } from '../../models/catalog';
import { TagTypesView } from './tag-types-view';

describe('TagTypesView', () => {
  const mood: TagType = {
    id: 9,
    key: 'mood',
    name: 'Mood',
    system: false,
    color: '#f9a8d4',
    tagCount: 1,
    audioCount: 2,
    artistCount: 0,
    playlistCount: 0,
  };
  const genre: TagType = {
    id: 2,
    key: 'genre',
    name: 'Género',
    system: true,
    color: null,
    tagCount: 1,
    audioCount: 4,
    artistCount: 0,
    playlistCount: 0,
  };

  let fixture: ComponentFixture<TagTypesView>;
  let component: TagTypesView;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [TagTypesView] }).compileComponents();
    fixture = TestBed.createComponent(TagTypesView);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('types', [mood, genre]);
    fixture.componentRef.setInput('tags', [
      { id: 1, name: 'Rock', type: 'genre', readOnly: true, audioCount: 4, artistCount: 0, playlistCount: 0 },
      { id: 2, name: 'Gym', type: 'mood', readOnly: false, audioCount: 2, artistCount: 0, playlistCount: 0 },
    ]);
    fixture.detectChanges();
  });

  it('locks system types and asks before deleting a custom one', () => {
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('[aria-label="Tipo de sistema"]')).not.toBeNull();
    expect(root.textContent).toContain('Género');
    expect(root.querySelector('.key')).toBeNull();
    const genreCard = root.querySelectorAll('.type-card')[0] as HTMLElement;
    expect(genreCard.textContent).toContain('Género');
    expect(genreCard.textContent).toContain('Rock');
    expect(genreCard.textContent).not.toContain('Borrar');
    const menu = root.querySelector('[aria-label="Opciones de Mood"]') as HTMLButtonElement;
    menu.click();
    fixture.detectChanges();
    expect(root.textContent).toContain('Borrar');

    const deleted: TagType[] = [];
    component.deleteType.subscribe((type) => deleted.push(type));
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    component.remove(genre);
    component.remove(mood);
    expect(deleted).toEqual([]);
    vi.mocked(window.confirm).mockReturnValue(true);
    component.remove(mood);
    expect(deleted).toEqual([mood]);
  });

  it('builds the key from the name and keeps it out of the card', () => {
    const created: { name: string; key: string; color: string }[] = [];
    component.createType.subscribe((draft) => created.push(draft));
    component.onName({ target: { value: 'Estado de ánimo' } } as unknown as Event);
    component.create({ preventDefault() {} } as unknown as Event);
    expect(created).toEqual([{ name: 'Estado de ánimo', key: 'estado-de-animo', color: '#f9a8d4' }]);
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('estado-de-animo');
  });

  it('does not paint every tag of a huge type until the group is opened', () => {
    const year = {
      id: 4,
      key: 'year',
      name: 'Año',
      system: true,
      color: null,
      tagCount: 2700,
      audioCount: 2700,
      artistCount: 0,
      playlistCount: 0,
    };
    const tags = Array.from({ length: 2700 }, (_, index) => ({
      id: index + 1,
      name: `Año ${String(index).padStart(4, '0')}`,
      type: 'year',
      readOnly: true,
      audioCount: 1,
      artistCount: 0,
      playlistCount: 0,
    }));
    fixture.componentRef.setInput('types', [year]);
    fixture.componentRef.setInput('tags', tags);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('2.700 etiquetas');
    expect(root.querySelectorAll('.tag-chip').length).toBe(0);

    (root.querySelector('.fold') as HTMLButtonElement).click();
    fixture.detectChanges();
    const opened = root.querySelectorAll('.tag-chip').length;
    expect(opened).toBeGreaterThan(0);
    expect(opened).toBeLessThan(40);

    (root.querySelectorAll('.fold')[1] as HTMLButtonElement).click();
    fixture.detectChanges();
    const more = root.querySelectorAll('.tag-chip').length;
    expect(more).toBeGreaterThan(opened);
    expect(more).toBeLessThan(80);

    const search = root.querySelector('input[placeholder="Buscar etiqueta"]') as HTMLInputElement;
    search.value = 'Año 2699';
    search.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    const chips = [...root.querySelectorAll('.tag-chip')].map((node) => node.textContent ?? '');
    expect(chips.some((text) => text.includes('Año 2699'))).toBe(true);
    expect(root.querySelectorAll('.tag-chip').length).toBe(1);
  });
});
