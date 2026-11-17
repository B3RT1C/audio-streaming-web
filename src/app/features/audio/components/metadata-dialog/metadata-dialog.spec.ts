import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Track } from '../../models/track';
import { MetadataDialog } from './metadata-dialog';

describe('MetadataDialog', () => {
  const track: Track = {
    id: 1,
    name: 'file.mp3',
    path: '',
    extension: 'mp3',
    title: 'Viejo',
    secondaryTitle: 'Old',
    artist: 'Sol',
    album: 'Noche',
    durationSeconds: 10,
    trackNumber: 4,
    tags: ['Pop'],
  };

  let fixture: ComponentFixture<MetadataDialog>;
  let component: MetadataDialog;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MetadataDialog],
    }).compileComponents();
    fixture = TestBed.createComponent(MetadataDialog);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('track', track);
    fixture.detectChanges();
  });

  it('emits the edited metadata', () => {
    const saved: unknown[] = [];
    component.saved.subscribe((patch) => saved.push(patch));
    component.title.set('Nuevo');
    component.trackNumber.set('');
    component.save();
    expect(saved).toEqual([
      {
        patch: {
          title: 'Nuevo',
          secondaryTitle: 'Old',
          artist: 'Sol',
          album: 'Noche',
          trackNumber: null,
        },
        tags: ['Pop'],
        assignments: ['Pop'],
      },
    ]);
  });

  it('omits an unchanged title and clears a blank secondary title', () => {
    const saved: { patch: { title?: string; secondaryTitle?: string | null }; tags: string[] }[] = [];
    component.saved.subscribe((edit) => saved.push(edit));
    component.secondary.set('   ');
    component.assigned.set([]);
    component.save();
    expect(saved[0]?.patch.title).toBeUndefined();
    expect(saved[0]?.patch.secondaryTitle).toBeNull();
    expect(saved[0]?.tags).toEqual([]);
  });

  it('rejects a track number that is not a positive integer', () => {
    component.trackNumber.set('1.5');
    component.save();
    expect(component.formError()).toContain('entero positivo');
  });
});
