import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { StatsRank } from '../../models/stats';
import { StatsView } from './stats-view';

describe('StatsView', () => {
  let fixture: ComponentFixture<StatsView>;
  let http: HttpTestingController;

  const summary = {
    plays: 6,
    listenedSeconds: 5400,
    distinctAudios: 4,
    distinctArtists: 2,
    from: '2026-11-11',
    to: '2026-11-17',
  };
  const timeline = [
    { period: '2026-11-16', plays: 2, listenedSeconds: 1800 },
    { period: '2026-11-17', plays: 4, listenedSeconds: 3600 },
  ];
  const top = [
    { id: 8, name: '  Canción   larga  ', secondaryName: 'Artista  raro', plays: 3, listenedSeconds: 400 },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StatsView],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(StatsView);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  function flushOk(): void {
    http.expectOne((request) => request.url.endsWith('/stats/summary')).flush(summary);
    http.expectOne((request) => request.url.endsWith('/stats/timeline')).flush(timeline);
    http.expectOne((request) => request.url.endsWith('/stats/top') && request.params.get('kind') === 'audio').flush(top);
    fixture.detectChanges();
  }

  it('shows the summary, the chart and the ranking with the API names', () => {
    flushOk();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('1 h 30 min');
    expect(text).toContain('6');
    expect(text).toContain('Canción   larga');
    expect(text).toContain('Artista  raro');
    expect(fixture.nativeElement.querySelector('.chart svg')).not.toBeNull();
  });

  it('opens the chosen song and shows an error when the summary fails', () => {
    const chosen: { row: StatsRank | null } = { row: null };
    fixture.componentInstance.openAudio.subscribe((row) => {
      chosen.row = row;
    });
    flushOk();
    (fixture.nativeElement.querySelector('.rank') as HTMLButtonElement).click();
    expect(chosen.row?.name).toBe('  Canción   larga  ');

    fixture.componentInstance.selectPreset('today');
    http.expectOne((request) => request.url.endsWith('/stats/summary')).flush('no', { status: 500, statusText: 'Error' });
    http.expectOne((request) => request.url.endsWith('/stats/timeline')).flush([]);
    http.expectOne((request) => request.url.endsWith('/stats/top')).flush([]);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No se pudieron cargar las estadísticas.');
  });

  it('asks for the tag type and shows the empty ranking', () => {
    flushOk();
    fixture.componentInstance.selectKind('tag');
    const request = http.expectOne((candidate) => candidate.url.endsWith('/stats/top'));
    expect(request.request.params.get('kind')).toBe('tag');
    expect(request.request.params.get('tagType')).toBe('genre');
    request.flush([]);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Nada en este ranking');
  });
});
