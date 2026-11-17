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
    const genreCard = root.querySelectorAll('.type-card')[0] as HTMLElement;
    expect(genreCard.textContent).toContain('Género');
    expect(genreCard.textContent).not.toContain('Borrar');
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
});
