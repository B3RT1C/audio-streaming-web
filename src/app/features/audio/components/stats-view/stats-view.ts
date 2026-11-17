import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, DestroyRef, inject, OnInit, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin, Observable, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { StatsBucket, StatsKind, StatsRank, StatsSummary, StatsTagFilter } from '../../models/stats';
import { CatalogService } from '../../services/catalog-service';
import { StatsService } from '../../services/stats.service';
import { buildTimelineChart, TimelineChart } from '../../utils/stats-chart';
import {
  defaultGranularity,
  formatListened,
  formatPeriodLabel,
  formatRangeLabel,
  normalizeCustomRange,
  rangeForPreset,
  StatsGranularity,
  StatsPreset,
  StatsRange,
} from '../../utils/stats-range';

const RANK_LIMIT = 10;

interface Choice<T extends string> {
  id: T;
  label: string;
}

@Component({
  selector: 'app-stats-view',
  templateUrl: './stats-view.html',
  styleUrl: './stats-view.scss',
})
export class StatsView implements OnInit {
  private readonly stats = inject(StatsService);
  private readonly catalog = inject(CatalogService);
  private readonly destroyRef = inject(DestroyRef);

  readonly openAudio = output<StatsRank>();
  readonly openArtist = output<StatsRank>();
  readonly openTag = output<StatsRank>();
  readonly openPlaylist = output<StatsRank>();

  readonly presets: Choice<StatsPreset>[] = [
    { id: 'today', label: 'Hoy' },
    { id: '7d', label: '7 días' },
    { id: 'month', label: 'Este mes' },
    { id: 'year', label: 'Este año' },
    { id: 'all', label: 'Todo' },
    { id: 'custom', label: 'Rango' },
  ];
  readonly kinds: Choice<StatsKind>[] = [
    { id: 'audio', label: 'Canciones' },
    { id: 'artist', label: 'Artistas' },
    { id: 'tag', label: 'Etiquetas' },
    { id: 'playlist', label: 'Playlists' },
  ];
  readonly tagFilters: Choice<StatsTagFilter>[] = [
    { id: 'genre', label: 'Género' },
    { id: 'album', label: 'Álbum' },
    { id: 'year', label: 'Año' },
    { id: 'language', label: 'Idioma' },
    { id: 'custom', label: 'Propios' },
  ];
  readonly granularities: Choice<StatsGranularity>[] = [
    { id: 'day', label: 'Día' },
    { id: 'month', label: 'Mes' },
    { id: 'year', label: 'Año' },
  ];

  readonly preset = signal<StatsPreset>('7d');
  readonly customFrom = signal('');
  readonly customTo = signal('');
  readonly granularity = signal<StatsGranularity>('day');
  readonly kind = signal<StatsKind>('audio');
  readonly tagFilter = signal<StatsTagFilter>('genre');
  readonly summary = signal<StatsSummary | null>(null);
  readonly timeline = signal<StatsBucket[]>([]);
  readonly ranks = signal<StatsRank[]>([]);
  readonly summaryError = signal('');
  readonly timelineError = signal('');
  readonly rankError = signal('');
  readonly summaryLoading = signal(false);
  readonly timelineLoading = signal(false);
  readonly rankLoading = signal(false);

  readonly rangeLabel = computed(() => formatRangeLabel(this.preset(), this.currentRange()));
  readonly chart = computed<TimelineChart | null>(() =>
    buildTimelineChart(
      this.timeline().map((bucket) => ({
        period: formatPeriodLabel(bucket.period),
        plays: bucket.plays,
        listenedSeconds: bucket.listenedSeconds,
      })),
    ),
  );
  readonly emptySummary = computed(() => {
    const summary = this.summary();
    return !!summary && summary.plays === 0 && summary.listenedSeconds === 0;
  });

  protected readonly listened = formatListened;
  protected readonly periodLabel = formatPeriodLabel;
  protected readonly count = (value: number) => new Intl.NumberFormat('es').format(Math.round(value));

  private summaryGen = 0;
  private timelineGen = 0;
  private rankGen = 0;

  ngOnInit(): void {
    this.reloadAll();
  }

  selectPreset(preset: StatsPreset): void {
    if (preset === 'custom' && (!this.customFrom() || !this.customTo())) {
      const week = rangeForPreset('7d', new Date());
      this.customFrom.set(week.from ?? '');
      this.customTo.set(week.to ?? '');
    }
    this.preset.set(preset);
    this.granularity.set(defaultGranularity(preset, this.currentRange()));
    this.reloadAll();
  }

  selectGranularity(granularity: StatsGranularity): void {
    this.granularity.set(granularity);
    this.loadTimeline(this.currentRange());
  }

  selectKind(kind: StatsKind): void {
    this.kind.set(kind);
    this.loadRanks(this.currentRange());
  }

  selectTagFilter(filter: StatsTagFilter): void {
    this.tagFilter.set(filter);
    this.loadRanks(this.currentRange());
  }

  onCustomFrom(event: Event): void {
    this.customFrom.set((event.target as HTMLInputElement).value);
    this.applyCustom();
  }

  onCustomTo(event: Event): void {
    this.customTo.set((event.target as HTMLInputElement).value);
    this.applyCustom();
  }

  reloadAll(): void {
    const range = this.currentRange();
    this.loadSummary(range);
    this.loadTimeline(range);
    this.loadRanks(range);
  }

  choose(row: StatsRank): void {
    if (this.kind() === 'audio') {
      this.openAudio.emit(row);
      return;
    }
    if (this.kind() === 'artist') {
      this.openArtist.emit(row);
      return;
    }
    if (this.kind() === 'tag') {
      this.openTag.emit(row);
      return;
    }
    this.openPlaylist.emit(row);
  }

  rankLabel(row: StatsRank): string {
    const name = row.name.trim() ? row.name : 'Sin nombre';
    const secondary = row.secondaryName ? `, ${row.secondaryName}` : '';
    return `${name}${secondary}. ${this.count(row.plays)} escuchas, ${formatListened(row.listenedSeconds)}`;
  }

  emptyRank(): string {
    if (this.kind() === 'tag' && this.tagFilter() === 'custom') {
      return 'No hay escuchas de etiquetas propias en este periodo.';
    }
    return 'Nada en este ranking para el periodo elegido.';
  }

  private applyCustom(): void {
    const normalized = normalizeCustomRange(this.customFrom(), this.customTo());
    if (!normalized?.from || !normalized.to) {
      return;
    }
    if (normalized.from !== this.customFrom() || normalized.to !== this.customTo()) {
      this.customFrom.set(normalized.from);
      this.customTo.set(normalized.to);
    }
    this.reloadAll();
  }

  private currentRange(): StatsRange {
    if (this.preset() === 'custom') {
      return normalizeCustomRange(this.customFrom(), this.customTo()) ?? {};
    }
    return rangeForPreset(this.preset(), new Date());
  }

  private loadSummary(range: StatsRange): void {
    if (!this.ready(range)) {
      this.summary.set(null);
      this.summaryError.set('');
      this.summaryLoading.set(false);
      return;
    }
    const generation = ++this.summaryGen;
    this.summaryLoading.set(true);
    this.summaryError.set('');
    this.stats
      .summary(range)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (summary) => {
          if (generation !== this.summaryGen) {
            return;
          }
          this.summary.set(summary);
          this.summaryLoading.set(false);
        },
        error: (err: unknown) => {
          if (generation !== this.summaryGen) {
            return;
          }
          this.summary.set(null);
          this.summaryError.set(statsError(err));
          this.summaryLoading.set(false);
        },
      });
  }

  private loadTimeline(range: StatsRange): void {
    if (!this.ready(range)) {
      this.timeline.set([]);
      this.timelineError.set('');
      this.timelineLoading.set(false);
      return;
    }
    const generation = ++this.timelineGen;
    this.timelineLoading.set(true);
    this.timelineError.set('');
    this.stats
      .timeline(this.granularity(), range)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (buckets) => {
          if (generation !== this.timelineGen) {
            return;
          }
          this.timeline.set(buckets);
          this.timelineLoading.set(false);
        },
        error: (err: unknown) => {
          if (generation !== this.timelineGen) {
            return;
          }
          this.timeline.set([]);
          this.timelineError.set(statsError(err));
          this.timelineLoading.set(false);
        },
      });
  }

  private loadRanks(range: StatsRange): void {
    if (!this.ready(range)) {
      this.ranks.set([]);
      this.rankError.set('');
      this.rankLoading.set(false);
      return;
    }
    const generation = ++this.rankGen;
    this.rankLoading.set(true);
    this.rankError.set('');
    this.rankRequest(range)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (rows) => {
          if (generation !== this.rankGen) {
            return;
          }
          this.ranks.set(rows);
          this.rankLoading.set(false);
        },
        error: (err: unknown) => {
          if (generation !== this.rankGen) {
            return;
          }
          this.ranks.set([]);
          this.rankError.set(statsError(err, 'No se pudo cargar el ranking.'));
          this.rankLoading.set(false);
        },
      });
  }

  private rankRequest(range: StatsRange): Observable<StatsRank[]> {
    if (this.kind() === 'tag' && this.tagFilter() === 'custom') {
      return this.catalog.listTagTypes().pipe(
        switchMap((types) => {
          const custom = types.filter((type) => !type.system && type.key);
          if (custom.length === 0) {
            return of([]);
          }
          return forkJoin(custom.map((type) => this.stats.top('tag', range, RANK_LIMIT, type.key))).pipe(
            map((groups) =>
              groups
                .flat()
                .sort((left, right) => right.plays - left.plays || right.listenedSeconds - left.listenedSeconds)
                .slice(0, RANK_LIMIT),
            ),
          );
        }),
      );
    }
    const tagType = this.kind() === 'tag' ? this.tagFilter() : undefined;
    return this.stats.top(this.kind(), range, RANK_LIMIT, tagType);
  }

  private ready(range: StatsRange): boolean {
    return this.preset() !== 'custom' || (!!range.from && !!range.to);
  }
}

function statsError(err: unknown, fallback = 'No se pudieron cargar las estadísticas.'): string {
  if (err instanceof HttpErrorResponse && err.status === 0) {
    return 'No hay conexión con el servidor.';
  }
  return fallback;
}
